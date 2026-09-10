import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Download, LockKeyhole, PackageCheck, RefreshCw, Users, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAdminSession, listCollection, setDocument, updateDocument } from '@/lib/firebaseRest';

const ORDER_STAGES = ['Trimisă', 'Confirmată', 'Comandată furnizorului', 'Gata de ridicare'] as const;
type OrderStage = (typeof ORDER_STAGES)[number];

type OrderItem = {
  productId?: string;
  productName?: string;
  grams?: number;
  lineTotalBani?: number;
};

type Order = {
  id: string;
  orderCode?: string;
  customerName?: string;
  phone?: string;
  totalBani?: number;
  paid?: boolean;
  status?: OrderStage;
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
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const publishPublicMeta = async (allOrders: Order[]) => {
    const month = currentMonthKey();
    const visible = allOrders.filter((order) => monthKey(orderDate(order)) === month);
    const statuses = Object.fromEntries(
      allOrders
        .filter((order) => order.orderCode)
        .slice(0, 200)
        .map((order) => [String(order.orderCode).toUpperCase(), order.status || 'Trimisă']),
    );

    await Promise.all([
      setDocument('settings/publicStats', {
        orderCount: visible.length,
        totalBani: visible.reduce((sum, order) => sum + (Number(order.totalBani) || 0), 0),
        paidCount: visible.filter((order) => order.paid).length,
        roundLabel: roundLabel(),
        updatedAt: new Date(),
      }),
      setDocument('settings/publicStatuses', {
        statuses,
        updatedAt: new Date(),
      }),
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
    const unpaid = monthOrders.filter((order) => !order.paid).length;
    return { totalBani, paidBani, unpaid };
  }, [monthOrders]);

  const topProducts = useMemo(() => {
    const totals = new Map<string, { name: string; bani: number; orders: number }>();
    monthOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = item.productId || item.productName || 'produs';
        const current = totals.get(key) || { name: item.productName || 'Produs', bani: 0, orders: 0 };
        current.bani += Number(item.lineTotalBani) || 0;
        current.orders += 1;
        totals.set(key, current);
      });
    });
    return [...totals.values()].sort((a, b) => b.bani - a.bani).slice(0, 5);
  }, [monthOrders]);

  const maxTop = Math.max(1, ...topProducts.map((product) => product.bani));

  const changeStatus = async (order: Order, status: OrderStage) => {
    setBusy(true);
    try {
      await updateDocument(`groupOrders/${order.id}`, { status, updatedAt: new Date() });
      setNotice(`${order.orderCode || 'Comanda'} → ${status}`);
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Statusul nu a putut fi actualizat.');
    } finally {
      setBusy(false);
    }
  };

  const closeRound = async () => {
    if (!window.confirm('Închizi comanda curentă? Catalogul rămâne vizibil, dar termenul va fi marcat ca închis.')) return;
    setBusy(true);
    try {
      await setDocument('settings/orderSchedule', {
        dates: [],
        message: 'Comanda curentă este închisă. Următoarea rundă va fi anunțată în curând.',
        closed: true,
        updatedAt: new Date(),
      });
      setNotice('Comanda lunii a fost închisă.');
      await publishPublicMeta(orders);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Comanda nu a putut fi închisă.');
    } finally {
      setBusy(false);
    }
  };

  const downloadSellerList = () => {
    const byProduct = new Map<string, { name: string; grams: number }>();
    monthOrders.forEach((order) => (order.items || []).forEach((item) => {
      const key = item.productId || item.productName || 'produs';
      const current = byProduct.get(key) || { name: item.productName || 'Produs', grams: 0 };
      current.grams += Number(item.grams) || 0;
      byProduct.set(key, current);
    }));
    const rows = [['Produs', 'Cantitate totală']];
    [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name, 'ro')).forEach((item) => {
      rows.push([item.name, item.grams >= 1000 ? `${item.grams / 1000} kg` : `${item.grams} g`]);
    });
    const csv = '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `lista-vanzator-${currentMonthKey()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!authorized) return null;

  return (
    <section className="liquid-page border-b border-white/40 px-4 pb-7 pt-5 sm:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#8b6b3f]">Control center</p>
            <h2 className="font-serif text-3xl font-semibold">{roundLabel()}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={busy} className="glass-chip rounded-full"><RefreshCw className={busy ? 'animate-spin' : ''} /> Actualizează</Button>
            <Button variant="outline" onClick={downloadSellerList} className="glass-chip rounded-full"><Download /> Lista vânzător</Button>
            <Button onClick={closeRound} disabled={busy} className="rounded-full bg-[#173d2c]"><LockKeyhole /> Închide comanda</Button>
          </div>
        </div>

        {notice && <p className="mb-3 rounded-2xl bg-[#e6f3de]/80 px-4 py-3 text-sm text-[#315b32]">{notice}</p>}
        {error && <p className="mb-3 rounded-2xl bg-red-50/85 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={<Users />} label="Comenzi luna aceasta" value={String(monthOrders.length)} />
          <Stat icon={<WalletCards />} label="Total comandat" value={`${lei(stats.totalBani)} lei`} />
          <Stat icon={<CheckCircle2 />} label="Încasat" value={`${lei(stats.paidBani)} lei`} />
          <Stat icon={<PackageCheck />} label="Neachitate" value={String(stats.unpaid)} />
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1.15fr]">
          <div className="glass-strong rounded-[26px] p-5">
            <div className="mb-4 flex items-center gap-2"><BarChart3 className="size-5" /><h3 className="font-serif text-xl font-semibold">Top produse</h3></div>
            {topProducts.length ? <div className="space-y-3">{topProducts.map((product) => (
              <div key={product.name}>
                <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{product.name}</span><strong>{lei(product.bani)} lei</strong></div>
                <div className="h-2 overflow-hidden rounded-full bg-[#dfe8dc]/70"><div className="h-full rounded-full bg-[#63865d]" style={{ width: `${Math.max(8, product.bani / maxTop * 100)}%` }} /></div>
              </div>
            ))}</div> : <p className="text-sm text-[#74837b]">Încă nu sunt suficiente comenzi pentru top.</p>}
          </div>

          <div className="glass-strong rounded-[26px] p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><p className="font-serif text-xl font-semibold">Fluxul comenzilor</p><p className="text-xs text-[#74837b]">Actualizează statusul; clientul îl poate verifica după cod.</p></div></div>
            <div className="glass-scrollbar max-h-72 space-y-2 overflow-y-auto pr-1">
              {monthOrders.slice(0, 12).map((order) => (
                <div key={order.id} className="glass-chip flex flex-col gap-2 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><strong className="block truncate text-sm">{order.customerName || 'Fără nume'}</strong><span className="text-xs text-[#7c8982]">{order.orderCode || '—'} · {lei(order.totalBani)} lei</span></div>
                  <select
                    value={order.status || 'Trimisă'}
                    onChange={(event) => void changeStatus(order, event.target.value as OrderStage)}
                    className="h-9 rounded-xl border border-white/70 bg-white/70 px-3 text-sm text-[#244b34] outline-none"
                  >
                    {ORDER_STAGES.map((stage) => <option key={stage}>{stage}</option>)}
                  </select>
                </div>
              ))}
              {!monthOrders.length && <p className="text-sm text-[#74837b]">Nu există comenzi în luna curentă.</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass glass-shine rounded-[24px] p-5">
      <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-white/55 text-[#315b32]">{icon}</div>
      <p className="text-xs uppercase tracking-[.08em] text-[#7b8981]">{label}</p>
      <strong className="mt-1 block font-serif text-3xl">{value}</strong>
    </div>
  );
}
