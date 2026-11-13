import { useState } from 'react';
import { Archive, CheckCircle2, GitBranch, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDocument, listCollection, setDocument, updateDocument } from '@/lib/firebaseRest';
import { effectiveRound, roundMeta, type RoundMeta } from '@/lib/orderRounds';

type OrderItem = {
  productId?: string;
  productName?: string;
  grams?: number;
  quantityUnit?: string;
  lineTotalBani?: number;
};
type Order = {
  id: string;
  orderCode?: string;
  customerName?: string;
  paid?: boolean;
  status?: string;
  createdAt?: Date | string | null;
  scheduledOrderDates?: string[];
  totalBani?: number;
  roundId?: string;
  roundLabel?: string;
  roundSequence?: number;
  items?: OrderItem[];
};
type Schedule = {
  dates?: string[];
  roundId?: string;
  roundMonth?: string;
  roundSequence?: number;
  closed?: boolean;
};

const TARGET_DATE = '2026-11-20';
const TARGET_MONTH = '2026-11';

function isDelivered(order: Order) {
  // "Predată" is the final status used by Packing Mode.
  return (order.status || '').trim().toLocaleLowerCase('ro-MD') === 'predată';
}

function belongsToMonth(order: Order, month: string) {
  const created = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt || 0);
  const createdMonth = Number.isNaN(created.getTime())
    ? ''
    : `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
  return effectiveRound(order).roundMonth === month || createdMonth === month;
}

function splitOrders(orders: Order[]) {
  const matching = orders.filter((order) => belongsToMonth(order, TARGET_MONTH));
  return {
    history: matching.filter((order) => order.paid === true && isDelivered(order)),
    open: matching.filter((order) => !(order.paid === true && isDelivered(order))),
    total: matching.length,
  };
}

function publicStats(orders: Order[], round: RoundMeta) {
  const productTotals = new Map<string, { name: string; amount: number; unit: string; orders: number; bani: number }>();
  let totalGrams = 0;
  orders.forEach((order) => (order.items || []).forEach((item) => {
    const id = item.productId || item.productName || 'produs';
    const current = productTotals.get(id) || {
      name: item.productName || 'Produs', amount: 0,
      unit: item.quantityUnit || 'g', orders: 0, bani: 0,
    };
    current.amount += Number(item.grams) || 0;
    current.orders += 1;
    current.bani += Number(item.lineTotalBani) || 0;
    productTotals.set(id, current);
    if ((item.quantityUnit || 'g') === 'g') totalGrams += Number(item.grams) || 0;
  }));
  const top = [...productTotals.values()].sort((a, b) => b.bani - a.bani)[0];
  const latest = [...orders].sort((a, b) =>
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
  return {
    orderCount: orders.length,
    totalBani: orders.reduce((sum, order) => sum + (Number(order.totalBani) || 0), 0),
    paidCount: orders.filter((order) => order.paid).length,
    roundLabel: round.roundLabel,
    totalGrams,
    lastOrderAt: latest ? new Date(latest.createdAt || 0) : null,
    topProductName: top?.name || '',
    topProductAmount: top?.amount || 0,
    topProductUnit: top?.unit || '',
    productTotals: Object.fromEntries(productTotals),
    updatedAt: new Date(),
  };
}

export default function RoundSeparationPanel({
  orders,
  activeRoundId,
  onComplete,
}: {
  orders: Order[];
  activeRoundId: string;
  onComplete: (nextRoundId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const history = roundMeta(TARGET_MONTH, 1);
  const current = roundMeta(TARGET_MONTH, 2);
  const preview = splitOrders(orders);

  if (activeRoundId === current.roundId) {
    return <div className="rounded-[22px] border border-[#cfe0cf] bg-[#f5faf2] p-4 text-sm text-[#315b32]">
      <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="size-5" /> Runda nouă este activă</div>
      <p className="mt-1">Runda #1 este în istoric. Runda #2 primește comenzile noi până la 20 noiembrie, ora configurată în Program.</p>
    </div>;
  }

  const ready = preview.history.length > 0 && preview.open.length === 2 && preview.total === preview.history.length + 2;

  const separate = async () => {
    if (busy || !ready) return;
    if (!window.confirm(`Separi ${preview.history.length} comenzi achitate și predate în Runda #1 (istoric) și cele 2 comenzi noi în Runda #2? Nu se șterg și nu se modifică plățile.`)) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      // Reload immediately before writing: never rely solely on the UI's cached preview.
      const [latestOrders, schedule] = await Promise.all([
        listCollection('groupOrders') as Promise<Order[]>,
        getDocument('settings/orderSchedule') as Promise<Schedule | null>,
      ]);
      if (!schedule?.dates?.includes(TARGET_DATE) || schedule.closed === true) {
        throw new Error('Programul nu mai este deschis până la 20 noiembrie. Nu am schimbat comenzile.');
      }
      if (schedule.roundId && schedule.roundId !== history.roundId) {
        throw new Error('Runda curentă a fost deja schimbată. Reîncarcă panoul înainte de a continua.');
      }
      if (Number(schedule.roundSequence || 1) !== 1) {
        throw new Error('Această operațiune este doar pentru separarea inițială a rundelor din noiembrie.');
      }
      const next = splitOrders(latestOrders);
      if (next.history.length === 0 || next.open.length !== 2) {
        throw new Error(`Sunt ${next.history.length} comenzi achitate și predate și ${next.open.length} comenzi încă active. Separarea necesită exact 2 comenzi noi; nu am mutat nimic.`);
      }

      // Persist round assignment on each order so its history never changes
      // when a later order becomes paid or delivered.
      for (const order of next.history) {
        await updateDocument(`groupOrders/${order.id}`, {
          roundId: history.roundId,
          roundLabel: history.roundLabel,
          roundSequence: history.roundSequence,
          updatedAt: new Date(),
        });
      }
      for (const order of next.open) {
        await updateDocument(`groupOrders/${order.id}`, {
          roundId: current.roundId,
          roundLabel: current.roundLabel,
          roundSequence: current.roundSequence,
          updatedAt: new Date(),
        });
      }

      // updateMask preserves the original 20 November deadline, its cutoff
      // time and public message; only the active round changes.
      await updateDocument('settings/orderSchedule', {
        roundId: current.roundId,
        roundLabel: current.roundLabel,
        roundSequence: current.roundSequence,
        roundMonth: current.roundMonth,
        closed: false,
        updatedAt: new Date(),
      });
      await setDocument('settings/publicStats', publicStats(next.open, current));
      setSuccess(`Separarea este gata: ${next.history.length} comenzi în istoric și 2 în runda activă.`);
      await onComplete(current.roundId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Separarea nu a reușit. Reîncarcă panoul și încearcă din nou.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[24px] border border-[#d9e3d7] bg-[#f7faf4] p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e4eddd] text-[#315b32]"><GitBranch className="size-5" /></span>
        <div className="min-w-0">
          <h3 className="font-serif text-xl font-semibold">Separarea rundelor · Noiembrie 2026</h3>
          <p className="mt-1 text-sm text-[#74837b]">Arhivăm comenzile deja achitate și predate. Cele două comenzi noi rămân în runda deschisă până la 20 noiembrie, ora 12:00.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#74837b]">Runda #1 · Închisă</p>
          <strong className="mt-1 block text-2xl">{preview.history.length} comenzi</strong>
          <p className="text-xs text-[#74837b]">Achitate + predate · păstrate în istoric</p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#74837b]">Runda #2 · Activă</p>
          <strong className="mt-1 block text-2xl">{preview.open.length} comenzi</strong>
          <p className="text-xs text-[#74837b]">Comenzile noi și următoarele până pe 20.11</p>
        </div>
      </div>
      {!ready && <p className="mt-3 text-sm text-[#9b632e]">Nu pot separa automat decât dacă există exact două comenzi noi. Verifică statusurile de predare și plată din panou.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void separate()} disabled={!ready || busy} className="bg-[#173d2c]">
          {busy ? <LoaderCircle className="animate-spin" /> : <Archive />} {busy ? 'Se separă comenzile…' : 'Separă și activează Runda #2'}
        </Button>
        <span className="text-xs text-[#74837b]">Fără ștergeri și fără schimbarea sumelor sau a plăților</span>
      </div>
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p className="mt-3 rounded-xl bg-[#e8f3df] p-3 text-sm text-[#315b32]">{success}</p>}
    </section>
  );
}
