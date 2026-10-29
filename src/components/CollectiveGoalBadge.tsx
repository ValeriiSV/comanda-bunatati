import { Target } from 'lucide-react';
import { quantityLabel, type Product } from '@/lib/products';
import type { CollectiveGoal, PublicProductTotal } from '@/hooks/usePublicOrderMeta';

export default function CollectiveGoalBadge({ product, goal, total }: { product: Product; goal?: CollectiveGoal; total?: PublicProductTotal }) {
  if (!goal?.goalAmount) return null;
  const current=Math.max(0,Number(total?.amount||0));
  const progress=Math.min(100,Math.round(current/goal.goalAmount*100));
  const reached=current>=goal.goalAmount;
  return <div className={`mt-3 rounded-2xl border p-3 ${reached?'border-[#bcd9b5] bg-[#eef8e9]':'border-[#eadbbf] bg-[#fff9ed]'}`}>
    <div className="flex items-center justify-between gap-2 text-xs"><span className="inline-flex items-center gap-1.5 font-bold"><Target className="size-3.5"/>{reached?'Preț de grup activ':'Prag colectiv'}</span><strong>{progress}%</strong></div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/8"><div className={`h-full rounded-full ${reached?'bg-[#4d7a46]':'bg-[#d89a3d]'}`} style={{width:`${Math.max(4,progress)}%`}}/></div>
    <div className="mt-2 flex justify-between gap-2 text-[11px] text-[#6e7a72]"><span>{quantityLabel(product,current)} / {quantityLabel(product,goal.goalAmount)}</span><span>{reached?`${goal.goalPriceLei} lei · activ`:`la prag: ${goal.goalPriceLei} lei`}</span></div>
  </div>;
}
