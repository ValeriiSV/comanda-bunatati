import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toFireValue} from '../src/lib/firebaseRest.ts';
import {readFileSync} from 'node:fs';

test('Firestore encodes valid nested numbers and rejects nonfinite values',()=>{
  assert.deepEqual(toFireValue({amount:500,orders:2,rate:1.25}),{mapValue:{fields:{amount:{integerValue:'500'},orders:{integerValue:'2'},rate:{doubleValue:1.25}}}});
  for(const value of [NaN,Infinity,-Infinity]) assert.throws(()=>toFireValue({nested:[value]}),/Valoare numerică invalidă/);
});
test('product count belongs only to the chart accumulator',()=>{
  const source=readFileSync(new URL('../src/components/AdminWowDashboard.tsx',import.meta.url),'utf8');
  const publicMeta=source.slice(source.indexOf('const publishPublicMeta'),source.indexOf('const load ='));
  const chart=source.slice(source.indexOf('const topProducts ='),source.indexOf('const stageCounts ='));
  assert.doesNotMatch(publicMeta,/current\.count/);
  assert.match(chart,/current\.count\s*\+=\s*1/);
});
