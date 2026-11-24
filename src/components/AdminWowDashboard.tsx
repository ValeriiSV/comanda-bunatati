import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, PackageCheck, RefreshCw, ShoppingBag, Truck, Users, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getAdminSession, getDocument, listCollection, setDocument } from '@/lib/firebaseRest';
import { effectiveRound, roundMeta, groupRoundOrders, groupStage, ORDER_STAGES } from '@/lib/orderRounds';



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
  phone?: string;
  totalBani?: number;
  discountBani?: number;
  paid?: boolean;
  receivedBani?: number;
  status?: string;
  createdAt?: Date | string | null;
  scheduledOrderDates?: string[];
  roundId?: string;
  roundLabel?: string;
  roundSequence?: number;
  items?: OrderItem[];
};

function customerGroups(orders: Order[]) { return groupRoundOrders(orders).map(group => group.entries); }

function orderDate(order: Order) {
  const value = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt || 0);
  return Number.isNaN(value.getTime()) ? new Date(0) : value;
}

function lei(bani = 0) {
  return new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 2 }).format(bani / 100);
}

export default function AdminWowDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeRound, setActiveRound] = useState(() => roundMeta(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`, 1));

  const publishPublicMeta = async (allOrders: Order[], currentRound = activeRound) => {
    const visible = allOrders.filter((order) => effectiveRound(order).roundId === currentRound.roundId);
    const statuses = Object.fromEntries(
      allOrders
        .filter((order) => order.orderCode)
                .map((order) => [String(order.orderCode).toUpperCase(), order.status || 'Trimisă']),
    );

    const productTotals = new Map<string, { name: string; amount: number; unit: string; orders: number; bani: number }>();
    let totalGrams = 0;

    groupRoundOrders(visible).forEach((order) => order.items.forEach((item) => {
      const id = item.productId || item.productName || 'produs';
      const current = productTotals.get(id) || {
        name: item.productName || 'Produs',
        amount: 0,
        unit: item.quantityUnit || 'g',
        orders: 0,
        bani: 0,
      };
      current.amount += Number(item.grams) || 0;
      current.orders += 1;
      current.bani += Number(item.lineTotalBani) || 0;
      productTotals.set(id, current);
      if ((item.quantityUnit || 'g') === 'g') totalGrams += Number(item.grams) || 0;
    }));

    const top = [...productTotals.values()].sort((a, b) => b.bani - a.bani)[0];
    const last = [...visible].sort((a, b) => orderDate(b).getTime() - orderDate(a).getTime())[0];

    await Promise.all([
      setDocument('settings/publicStats', {
        orderCount: customerGroups(visible).length,
        totalBani: visible.reduce((sum, order) => sum + (Number(order.totalBani) || 0), 0),
        paidCount: groupRoundOrders(visible).filter(group=>group.paid).length,
        roundLabel: currentRound.roundLabel,
        totalGrams,
        lastOrderAt: last ? orderDate(last) : null,
        topProductName: top?.name || '',
        topProductAmount: top?.amount || 0,
        topProductUnit: top?.unit || '',
        productTotals: Object.fromEntries(productTotals),
        updatedAt: new Date(),
      }),
      setDocument('settings/publicStatuses', { statuses, updatedAt: new Date() }),
    ]);
  };

  const load = async (silent = false) => {
    const session = await getAdminSession();
    if (!session) {
      setAuthorized(false);
      return;
    }
    setAuthorized(true);
    if (!silent) setBusy(true);
    try {
      const [loaded, schedule] = await Promise.all([
        listCollection('groupOrders') as Promise<Order[]>,
        getDocument('settings/orderSchedule'),
      ]);
      const sorted = loaded.sort((a, b) => orderDate(b).getTime() - orderDate(a).getTime());
      const month = typeof schedule?.roundMonth === 'string' && schedule.roundMonth
        ? schedule.roundMonth
        : Array.isArray(schedule?.dates) && typeof schedule.dates[0] === 'string'
          ? schedule.dates[0].slice(0, 7)
          : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const sequence = Number(schedule?.roundSequence) || 1;
      const fallback = roundMeta(month, sequence);
      const currentRound = {
        roundId: typeof schedule?.roundId === 'string' && schedule.roundId ? schedule.roundId : fallback.roundId,
        roundLabel: typeof schedule?.roundLabel === 'string' && schedule.roundLabel ? schedule.roundLabel : fallback.roundLabel,
        roundSequence: sequence,
        roundMonth: month,
      };
      setActiveRound(currentRound);
      setOrders(sorted);
      await publishPublicMeta(sorted, currentRound);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nu am putut încărca dashboardul.');
    } finally {
      if (!silent) setBusy(false);
    }
  };

  useEffect(() => {
    void load(true);
    const timer = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const roundOrders = useMemo(
    () => orders.filter((order) => effectiveRound(order).roundId === activeRound.roundId),
    [orders, activeRound.roundId],
  );

  const stats = useMemo(() => {
    const groups = groupRoundOrders(roundOrders);
    const totalBani = groups.reduce((sum,g)=>sum+g.totalBani,0);
    const paidBani = groups.reduce((sum,g)=>sum+g.paidBani,0);
    const discountBani = groups.reduce((sum,g)=>sum+g.discountBani,0);
    return {
      totalBani,
      paidBani,
      discountBani,
      unpaid: groups.filter(g=>g.totalBani>g.paidBani).length,
      ready: customerGroups(roundOrders).filter(group => groupStage(group) === 'Gata de ridicare').length,
      delivered: customerGroups(roundOrders).filter(group => groupStage(group) === 'Predată').length,
    };
  }, [roundOrders]);

  const topProducts = useMemo(() => {
    const totals = new Map<string, { name: string; bani: number }>();
    roundOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = item.productId || item.productName || 'produs';
        const current = totals.get(key) || { name: item.productName || 'Produs', bani: 0 };
        current.bani += Number(item.lineTotalBani) || 0;
        totals.set(key, current);
      });
    });
    return [...totals.values()].sort((a, b) => b.bani - a.bani).slice(0, 5);
  }, [roundOrders]);

  const stageCounts = useMemo(
    () => ORDER_STAGES.map((stage) => ({
      stage,
      count: customerGroups(roundOrders).filter(group => groupStage(group) === stage).length,
    })),
    [roundOrders],
  );

  const orderCount = customerGroups(roundOrders).length;
  const completion = orderCount ? Math.round((stats.ready + stats.delivered) / orderCount * 100) : 0;
  const maxTop = Math.max(1, ...topProducts.map((product) => product.bani));

  if (!authorized) return null;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#8b6b3f]">Control center</p>
          <h2 className="font-serif text-3xl font-semibold">{activeRound.roundLabel}</h2>
          <p className="mt-1 text-sm text-[#74837b]">Doar sumar. Administrarea se face din meniurile dedicate.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={busy}>
          <RefreshCw className={busy ? 'animate-spin' : ''} /> Actualizează
        </Button>
      </div>

      {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#173d2c] to-[#315b32] p-5 text-white shadow-lg sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-14 size-52 rounded-full border-[25px] border-white/5"/>
        <p className="text-sm font-medium text-white/70">Valoarea finală a comenzilor</p>
        <strong className="mt-2 block text-4xl font-semibold tracking-tight tabular-nums">{lei(stats.totalBani)} <span className="text-xl text-white/65">MDL</span></strong>
        {stats.discountBani>0&&<p className="mt-2 text-xs text-white/75">Reduceri acordate: {lei(stats.discountBani)} lei</p>}
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
          <div><p className="text-xs text-white/65">Încasat</p><strong className="mt-1 block text-xl tabular-nums">{lei(stats.paidBani)} lei</strong></div>
          <div><p className="text-xs text-white/65">Rest de încasat</p><strong className="mt-1 block text-xl text-[#f4cf93] tabular-nums">{lei(stats.totalBani-stats.paidBani)} lei</strong></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={<Users />} label="Comenzi unice" value={String(orderCount)} />
        <Stat icon={<PackageCheck />} label="Gata de ridicare" value={String(stats.ready)} />
        <Stat icon={<Truck />} label="Predate" value={String(stats.delivered)} />
        <Stat icon={<WalletCards />} label="Cu rest de plată" value={String(stats.unpaid)} />
      </div>
      <section className="rounded-[24px] border bg-white p-5">
        <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Progresul pregătirii</h3><strong className="text-xl tabular-nums">{completion}%</strong></div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#e8efe3]" role="progressbar" aria-label="Progresul pregătirii" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}><div className="manager-progress h-full rounded-full bg-[#63865d]" style={{width:`${completion}%`}}/></div>
        <p className="mt-2 text-xs text-[#74837b]">{stats.ready+stats.delivered} din {orderCount} comenzi pregătite sau predate</p>
      </section>

      <div className="manager-two-columns">
        <section className="rounded-[26px] border bg-white p-5">
          <div className="mb-4 flex items-center gap-2"><BarChart3 className="size-5" /><h3 className="font-serif text-xl font-semibold">Top produse</h3></div>
          {topProducts.length ? <div className="space-y-3">{topProducts.map((product) => (
            <div key={product.name}>
              <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{product.name}</span><strong>{lei(product.bani)} lei</strong></div>
              <div className="h-2 overflow-hidden rounded-full bg-[#dfe8dc]"><div className="manager-progress h-full rounded-full bg-[#63865d]" style={{ width: `${Math.max(8, product.bani / maxTop * 100)}%` }} /></div>
            </div>
          ))}</div> : <p className="text-sm text-[#74837b]">Încă nu sunt comenzi în runda curentă.</p>}
        </section>

        <section className="rounded-[26px] border bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h3 className="font-serif text-xl font-semibold">Fluxul comenzilor</h3><p className="text-xs text-[#74837b]">Situație pe stadii, fără editare aici.</p></div>
            <Truck className="size-5 text-[#607269]" />
          </div>
          <div className="space-y-2">
            {stageCounts.map(({ stage, count }) => (
              <div key={stage} className="flex items-center justify-between rounded-2xl bg-[#f4f7f1] px-4 py-3 text-sm">
                <span>{stage}</span><strong>{count}</strong>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#74837b]">{stats.unpaid} neachitate · {stats.delivered} predate</p>
        </section>
      </div>

      <section className="rounded-[26px] border bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-[#7b8981]">Acțiuni rapide</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QuickLink to="/admin/comenzi" icon={<ShoppingBag className="size-4" />} title="Comenzi" text="Editare și plăți" />
          <QuickLink to="/admin/pregatire" icon={<PackageCheck className="size-4" />} title="Pregătire" text="QR și predare" />
          <QuickLink to="/admin/program" icon={<CheckCircle2 className="size-4" />} title="Program" text="Termen și rundă" />
          <QuickLink to="/admin/viber" icon={<Users className="size-4" />} title="Viber" text="Mesaj pentru grup" />
        </div>
      </section>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="manager-stat rounded-[24px] border bg-white p-4 sm:p-5"><div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-[#edf3e8] text-[#315b32]">{icon}</div><p className="text-xs uppercase tracking-[.08em] text-[#7b8981]">{label}</p><strong className="mt-1 block font-serif text-3xl tabular-nums">{value}</strong></div>;
}

function QuickLink({ to, icon, title, text }: { to: string; icon: React.ReactNode; title: string; text: string }) {
  return <Link to={to} className="rounded-2xl border bg-[#f7faf4] p-4 transition hover:border-[#bfcfbb] hover:bg-[#eef4e9]"><div className="flex items-center gap-2 font-semibold">{icon}{title}</div><p className="mt-1 text-xs text-[#74837b]">{text}</p></Link>;
}
