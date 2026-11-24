import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupRoundOrders, normalizedOrderPhone, stageRank } from '../src/lib/orderRounds.ts';

const first = { id:'a', orderCode:'CMD-000001', roundId:'2026-11-r2', phone:'069 123 456', totalBani:15000, paid:true, status:'Predată', items:[{productId:'nuci',grams:500,quantityUnit:'g',lineTotalBani:15000}] };
const second = { id:'b', orderCode:'CMD-000002', roundId:'2026-11-r2', phone:'+37369123456', totalBani:20000, paid:false, status:'Trimisă', items:[{productId:'nuci',grams:250,quantityUnit:'g',lineTotalBani:7500},{productId:'miere',grams:1,quantityUnit:'borcan',lineTotalBani:12500}] };

test('same phone and round merges products, totals and payments without losing codes', () => {
  const [group] = groupRoundOrders([first,second]);
  assert.equal(groupRoundOrders([first,second]).length,1);
  assert.equal(group.items.length,2);
  assert.equal(group.items[0].grams,750);
  assert.equal(group.items[0].lineTotalBani,22500);
  assert.equal(group.totalBani,35000);
  assert.equal(group.paidBani,15000);
  assert.equal(group.paid,false);
  assert.equal(group.status,'Trimisă');
  assert.deepEqual(group.entries.map(o=>o.orderCode),['CMD-000001','CMD-000002']);
  assert.equal(first.items[0].grams,500);
});
test('different rounds and missing or malformed phones remain separate', () => {
  assert.equal(groupRoundOrders([first,{...second,roundId:'2026-11-r3'}]).length,2);
  assert.equal(groupRoundOrders([{...first,phone:''},{...second,phone:''}]).length,2);
  assert.equal(groupRoundOrders([{...first,phone:'bad'},{...second,phone:'bad'}]).length,2);
});
test('telephone formats and stage progression', () => {
  for(const phone of ['069123456','+373 69 123 456','0037369123456','69123456']) assert.equal(normalizedOrderPhone(phone),'37369123456');
  assert.equal(groupRoundOrders([first,{...second,status:'Predată',paid:true}])[0].status,'Predată');
  assert.equal(groupRoundOrders([first,{...second,status:'Predată',paid:true}])[0].paid,true);
  assert.ok(stageRank('Predată')>stageRank('Gata de ridicare'));
});
test('products with different units are not combined', () => {
  const group=groupRoundOrders([first,{...second,items:[{productId:'nuci',grams:1,quantityUnit:'buc',lineTotalBani:20000}]}])[0];
  assert.equal(group.items.length,2);
});


test('manual discounts respect existing payments and group totals', async () => {
  const {allocateGroupDiscount,parseDiscountLei,netOrderBani}=await import('../src/lib/orderRounds.ts');
  const rows=[{id:'a',phone:'069123456',roundId:'2026-11-r2',totalBani:15000,paid:true,discountBani:1000},{id:'b',phone:'+37369123456',roundId:'2026-11-r2',totalBani:20000,paid:false}];
  const allocations=allocateGroupDiscount(rows,3000);
  assert.deepEqual(allocations,[{id:'b',discountBani:2000}]);
  const group=groupRoundOrders([rows[0],{...rows[1],discountBani:2000}])[0];
  assert.equal(group.grossBani,35000);
  assert.equal(group.discountBani,3000);
  assert.equal(group.totalBani,32000);
  assert.equal(group.paidBani,14000);
  assert.equal(group.totalBani-group.paidBani,18000);
  assert.throws(()=>allocateGroupDiscount(rows,500));
  assert.throws(()=>allocateGroupDiscount(rows,22000));
  assert.equal(parseDiscountLei('12,50'),1250);
  assert.equal(parseDiscountLei('-2'),null);
  assert.equal(netOrderBani({id:'x',totalBani:100,discountBani:999}),0);
});
