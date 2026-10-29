import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, PackageCheck, RefreshCw, ShoppingBag, Truck, Users, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getAdminSession, listCollection, setDocument } from '@/lib/firebaseRest';

const ORDER_STAGES = ['Trimisă', 'Confirmată', 'Comandată furnizorului', 'Gata de ridicare', 'Predată'] as const;

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
  totalBani?: number;
  paid?: boolean;
  status?: string;
  createdAt?: Date | string | null;
  items?: OrderItem[];
};

function orderDate(order: Order) {
  const value = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt || 0);
  return Number.isNaN(value.getTime()) ? new Date(0) : value;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function roundLabel() {
  const now = new Date();
  const month = new Intl.DateTimeFormat('ro-MD', { month: 'long' }).format(now);
  return `Comanda #${String(now.getMonth() + 1).padStart(2, '0')} · ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
}

function lei(bani = 0) {
  return new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 0 }).format(bani / 100);
}

export default function AdminWowDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const publishPublicMeta = async (allOrders: Order[]) => {
    const month = currentMonthKey();
    const visible = allOrders.filter((order) => monthKey(orderDate(order)) === month);
    const statuses = Object.fromEntries(
      allOrders
        .filter((order) => order.orderCode)
        .slice(0, 300)
        .map((order) => [String(order.orderCode).toUpperCase(), order.status || 'Trimisă']),
    );

    const productTotals = new Map<string, { name: string; amount: number; unit: string; orders: number; bani: number }>();
    let totalGrams = 0;

    visible.forEach((order) => (order.items || []).forEach((item) => {
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
        orderCount: visible.length,
        totalBani: visible.reduce((sum, order) => sum + (Number(order.totalBani) || 0), 0),
        paidCount: visible.filter((order) => order.paid).length,
        roundLabel: roundLabel(),
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
      const loaded = (await listCollection('groupOrders')) as Order[];
      const sorted = loaded.sort((a, b) => orderDate(b).getTime() - orderDate(a).getTime());
      setOrders(sorted);
      await publishPublicMeta(sorted);
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

  const monthOrders = useMemo(
    () => orders.filter((order) => monthKey(orderDate(order)) === currentMonthKey()),
    [orders],
  );

  const stats = useMemo(() => {
    const totalBani = monthOrders.reduce((sum, order) => sum + (Number(order.totalBani) || 0), 0);
    const paidBani = monthOrders.filter((order) => order.paid).reduce((sum, order) => sum + (Number(order.totalBani) || 0), 0);
    return {
      totalBani,
      paidBani,
      unpaid: monthOrders.filter((order) => !order.paid).length,
      ready: monthOrders.filter((order) => order.status === 'Gata de ridicare').length,
      delivered: monthOrders.filter((order) => order.status === 'Predată').length,
    };
  }, [monthOrders]);

  const topProducts = useMemo(() => {
    const totals = new Map<string, { name: string; bani: number }>();
    monthOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = item.productId || item.productName || 'produs';
        const current = totals.get(key) || { name: item.productName || 'Produs', bani: 0 };
        current.bani += Number(item.lineTotalBani) || 0;
        totals.set(key, current);
      });
    });
    return [...totals.values()].sort((a, b) => b.bani - a.bani).slice(0, 5);
  }, [monthOrders]);

  const stageCounts = useMemo(
    () => ORDER_STAGES.map((stage) => ({
      stage,
      count: monthOrders.filter((order) => (order.status || 'Trimisă') === stage).length,
    })),
    [monthOrders],
  );

  const maxTop = Math.max(1, ...topProducts.map((product) => product.bani));

  if (!authorized) return null;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#8b6b3f]">Control center</p>
          <h2 className="font-serif text-3xl font-semibold">{roundLabel()}</h2>
          <p className="mt-1 text-sm text-[#74837b]">Doar sumar. Administrarea se face din meniurile dedicate.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={busy}>
          <RefreshCw className={busy ? 'animate-spin' : ''} /> Actualizează
        </Button>
      </div>

      {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<Users />} label="Comenzi" value={String(monthOrders.length)} />
        <Stat icon={<WalletCards />} label="Total comandat" value={`${lei(stats.totalBani)} lei`} />
        <Stat icon={<CheckCircle2 />} label="Încasat" value={`${lei(stats.paidBani)} lei`} />
        <Stat icon={<PackageCheck />} label="Gata de ridicare" value={String(stats.ready)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[26px] border bg-white p-5">
          <div className="mb-4 flex items-center gap-2"><BarChart3 className="size-5" /><h3 className="font-serif text-xl font-semibold">Top produse</h3></div>
          {topProducts.length ? <div className="space-y-3">{topProducts.map((product) => (
            <div key={product.name}>
              <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{product.name}</span><strong>{lei(product.bani)} lei</strong></div>
              <div className="h-2 overflow-hidden rounded-full bg-[#dfe8dc]"><div className="h-full rounded-full bg-[#63865d]" style={{ width: `${Math.max(8, product.bani / maxTop * 100)}%` }} /></div>
            </div>
          ))}</div> : <p className="text-sm text-[#74837b]">Încă nu sunt comenzi în luna curentă.</p>}
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
  return <div className="rounded-[24px] border bg-white p-5"><div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-[#edf3e8] text-[#315b32]">{icon}</div><p className="text-xs uppercase tracking-[.08em] text-[#7b8981]">{label}</p><strong className="mt-1 block font-serif text-3xl">{value}</strong></div>;
}

function QuickLink({ to, icon, title, text }: { to: string; icon: React.ReactNode; title: string; text: string }) {
  return <Link to={to} className="rounded-2xl border bg-[#f7faf4] p-4 transition hover:border-[#bfcfbb] hover:bg-[#eef4e9]"><div className="flex items-center gap-2 font-semibold">{icon}{title}</div><p className="mt-1 text-xs text-[#74837b]">{text}</p></Link>;
}
