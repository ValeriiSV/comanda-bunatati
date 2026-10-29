import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { quantityLabel, type Product } from '@/lib/products';

type HistoryItem={cart:Record<string,number>};

export default function SmartBasketCard({history,products,onApply}:{history:HistoryItem[];products:Product[];onApply:(cart:Record<string,number>)=>void}){
  if(!history.length)return null;
  const totals=new Map<string,{sum:number;count:number}>();
  history.slice(0,6).forEach(order=>Object.entries(order.cart||{}).forEach(([id,amount])=>{if(!amount)return;const current=totals.get(id)||{sum:0,count:0};current.sum+=Number(amount);current.count+=1;totals.set(id,current);}));
  const suggested=[...totals.entries()].map(([id,value])=>{const product=products.find(item=>item.id===id);if(!product)return null;const raw=value.sum/value.count;const amount=Math.max(product.stepGrams,Math.round(raw/product.stepGrams)*product.stepGrams);return{product,amount,frequency:value.count};}).filter(Boolean).sort((a,b)=>b!.frequency-a!.frequency).slice(0,5) as Array<{product:Product;amount:number;frequency:number}>;
  if(!suggested.length)return null;
  const cart=Object.fromEntries(suggested.map(entry=>[entry.product.id,entry.amount]));
  return <section className="glass glass-shine mb-5 rounded-[26px] p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#8b6b3f]">Valera îți pregătește coșul</p><h2 className="mt-1 font-serif text-2xl font-semibold">Coșul tău obișnuit ✨</h2><div className="mt-2 flex flex-wrap gap-1.5">{suggested.map(({product,amount})=><span key={product.id} className="rounded-full bg-white/70 px-2.5 py-1 text-xs">{product.name} · {quantityLabel(product,amount)}</span>)}</div></div><Button onClick={()=>onApply(cart)} className="shrink-0 rounded-xl bg-[#173d2c]"><Sparkles/>Pregătește coșul</Button></div></section>;
}
