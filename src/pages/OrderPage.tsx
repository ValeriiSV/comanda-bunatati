import { useEffect, useMemo, useState, type Dispatch, type PointerEvent, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Heart,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { categories, linePrice, priceLabel, quantityLabel, type Category, type Product } from '@/lib/products';
import { getCategoryExperience, isNewProduct, recommendProducts } from '@/lib/catalogExperience';
import { useProducts, type ManagedProduct } from '@/hooks/useProducts';
import { formatOrderDate, useOrderSchedule, type OrderSchedule } from '@/hooks/useOrderSchedule';
import { usePublicOrderMeta, type PublicOrderStats } from '@/hooks/usePublicOrderMeta';
import { submitPublicOrder } from '@/lib/orderApi';

type Cart = Record<string, number>;
type LastOrder = {
  orderCode: string;
  name: string;
  phone: string;
  cart: Cart;
  totalLei: number;
  createdAt: string;
};

const MIA_LINK = 'https://mia-qr.bnm.md/1/m/BNM/MCB983a07f55265457d90654eb9f97574fc';
const FAVORITES_KEY = 'bunatati_favorites_v1';
const LAST_ORDER_KEY = 'bunatati_last_order_v2';

function productImage(product: Product) {
  if (product.imageUrl && !product.imageUrl.startsWith('/products/')) return product.imageUrl;
  return `/products-ultra/${product.id}.jpg`;
}

function money(value: number) {
  return new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 2 }).format(value);
}

function readFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
}

function readLastOrder(): LastOrder | null {
  try {
    const raw = localStorage.getItem(LAST_ORDER_KEY);
    return raw ? JSON.parse(raw) as LastOrder : null;
  } catch {
    return null;
  }
}

function countdownTarget(value?: string) {
  if (!value) return 0;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return 0;
  return new Date(year, month - 1, day, 23, 59, 59).getTime();
}

function useCountdown(value?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const target = countdownTarget(value);
  if (!target) return 'Termenul va fi anunțat';
  const diff = target - now;
  if (diff <= 0) return 'Termen încheiat';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days} zile ${hours} ore`;
  if (hours > 0) return `${hours} ore ${minutes} min`;
  return `${Math.max(1, minutes)} min`;
}

function currentRoundLabel(schedule: OrderSchedule, publicLabel: string) {
  if (schedule.dates[0]) {
    const [year, month] = schedule.dates[0].split('-').map(Number);
    const label = new Intl.DateTimeFormat('ro-MD', { month: 'long' }).format(new Date(year, month - 1, 1));
    return `Comanda #${String(month).padStart(2, '0')} · ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  }
  if (publicLabel) return publicLabel;
  const now = new Date();
  const label = new Intl.DateTimeFormat('ro-MD', { month: 'long' }).format(now);
  return `Comanda #${String(now.getMonth() + 1).padStart(2, '0')} · ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function glassMove(event: PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  event.currentTarget.style.setProperty('--glass-x', `${x}%`);
  event.currentTarget.style.setProperty('--glass-y', `${y}%`);
}

function ScheduleNotice({ schedule, compact = false }: { schedule: OrderSchedule; compact?: boolean }) {
  const countdown = useCountdown(schedule.dates[0]);
  return (
    <div className={`glass glass-shine rounded-2xl ${compact ? 'p-3' : 'p-4 sm:p-5'}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f7dfb8]/75 text-[#8b581c] shadow-sm backdrop-blur-md"><CalendarDays className="size-4" /></span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.1em] text-[#9a6222]">{schedule.closed ? 'Comandă închisă' : 'Următoarea comandă'}</p>
          {schedule.dates.length > 0 ? (
            <>
              <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-sm font-semibold text-[#5d4527]">
                {schedule.dates.map((date, index) => <span key={date}>{formatOrderDate(date)}{index < schedule.dates.length - 1 ? ' •' : ''}</span>)}
              </div>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/55 px-2.5 py-1 text-xs font-semibold text-[#6c5538]"><Clock className="size-3.5" /> {countdown}</p>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-[#6f796f]">{schedule.message || 'Data următoarei comenzi va fi anunțată în curând.'}</p>
          )}
          {schedule.message && schedule.dates.length > 0 && <p className="mt-2 text-xs leading-5 text-[#7d674d]">{schedule.message}</p>}
        </div>
      </div>
    </div>
  );
}

function PublicPulse({ stats }: { stats: PublicOrderStats }) {
  const hasData = stats.orderCount > 0 || stats.totalBani > 0;
  return (
    <div className="glass-dark rounded-[24px] p-4 text-white shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-white/65">Live · comanda lunii</p><p className="mt-1 font-serif text-2xl font-semibold">{hasData ? `${stats.orderCount} comenzi` : 'Comanda e deschisă'}</p></div>
        <span className="pulse-live size-2.5 rounded-full bg-[#9be57d]" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white/10 p-3"><Users className="size-4 text-[#dceecf]" /><strong className="mt-2 block text-lg">{stats.orderCount}</strong><span className="text-xs text-white/60">comenzi</span></div>
        <div className="rounded-2xl bg-white/10 p-3"><TrendingUp className="size-4 text-[#f7cf8d]" /><strong className="mt-2 block text-lg">{money(stats.totalBani / 100)} lei</strong><span className="text-xs text-white/60">valoare totală</span></div>
      </div>
      {stats.paidCount > 0 && <p className="mt-3 text-xs text-white/65">{stats.paidCount} comenzi marcate achitate.</p>}
    </div>
  );
}

function MiaQrCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`glass glass-shine rounded-2xl ${compact ? 'p-3' : 'p-4 sm:p-5'}`}>
      <div className={`flex ${compact ? 'items-center gap-3' : 'flex-col items-center gap-3 text-center sm:flex-row sm:text-left'}`}>
        <a href={MIA_LINK} target="_blank" rel="noreferrer" aria-label="Deschide MIA" className="rounded-2xl bg-white/70 p-1 shadow-sm backdrop-blur-md">
          <img src="/mia-qr.svg?v=5" alt="QR pentru transfer prin MIA" className={compact ? 'size-24 rounded-xl bg-white p-1' : 'size-32 rounded-2xl bg-white p-1'} />
        </a>
        <div>
          <p className="text-sm font-bold text-[#173d2c]">Transfer prin MIA</p>
          <p className="mt-1 text-xs leading-5 text-[#74837b]">Scanează QR-ul și introdu suma pe care o ai de transferat.</p>
        </div>
      </div>
    </div>
  );
}

function CartPanel({ cart, setCart, products, schedule, lastOrder, onSubmitted }: {
  cart: Cart;
  setCart: Dispatch<SetStateAction<Cart>>;
  products: Product[];
  schedule: OrderSchedule;
  lastOrder: LastOrder | null;
  onSubmitted: (order: LastOrder) => void;
}) {
  const [name, setName] = useState(lastOrder?.name || '');
  const [phone, setPhone] = useState(lastOrder?.phone || '');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');
  const lines = products.filter((product) => cart[product.id] > 0);
  const total = lines.reduce((sum, product) => sum + linePrice(product, cart[product.id]), 0);
  const recommendations = useMemo(() => recommendProducts(products, cart, 2), [products, cart]);

  const change = (id: string, delta: number) => {
    const product = products.find((candidate) => candidate.id === id);
    setCart((current) => ({ ...current, [id]: Math.min(product?.stockLimit || Number.MAX_SAFE_INTEGER, Math.max(0, (current[id] || 0) + delta)) }));
  };

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !lines.length || sending || schedule.closed) return;
    setSending(true);
    setSubmitError('');
    setSuccess(null);

    const orderCode = `CMD-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const snapshot = { ...cart };
    try {
      await submitPublicOrder({
        orderCode,
        customerName: name.trim(),
        phone: phone.trim(),
        totalBani: Math.round(total * 100),
        scheduledOrderDates: schedule.dates,
        items: lines.map((product) => ({
          productId: product.id,
          productName: product.name,
          category: product.category,
          grams: cart[product.id],
          quantityUnit: product.quantityUnit || 'g',
          lineTotalBani: Math.round(linePrice(product, cart[product.id]) * 100),
        })),
      });
      const saved: LastOrder = {
        orderCode,
        name: name.trim(),
        phone: phone.trim(),
        cart: snapshot,
        totalLei: total,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(saved));
      onSubmitted(saved);
      setCart({});
      setSuccess(orderCode);
    } catch (error) {
      console.error('Order submit failed:', error);
      const message = error instanceof Error ? error.message : String(error);
      setSubmitError(`Comanda nu a fost trimisă. ${message.includes('403') ? 'Firebase a refuzat accesul. Verifică regulile groupOrders.' : 'Verifică internetul și încearcă din nou.'}`);
    } finally {
      setSending(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center px-5 py-6 text-center">
        <span className="glass mb-5 grid size-16 place-items-center rounded-full text-[#315b32]"><CheckCircle2 className="size-8" /></span>
        <h2 className="font-serif text-3xl font-semibold text-[#173d2c]">Comandă trimisă</h2>
        <p className="mt-3 max-w-xs text-[#607269]">Codul tău este <strong className="text-[#173d2c]">{success}</strong>. Păstrează-l pentru urmărirea statusului.</p>
        {schedule.dates.length > 0 && <p className="glass mt-3 max-w-xs rounded-xl px-4 py-2.5 text-sm text-[#7a5325]">Comanda comună este planificată pentru <strong>{schedule.dates.map(formatOrderDate).join(' / ')}</strong>.</p>}
        <div className="mt-5 w-full max-w-sm"><MiaQrCard compact /></div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to={`/status?code=${encodeURIComponent(success)}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#173d2c] px-5 text-sm font-semibold text-white"><PackageCheck className="size-4" /> Vezi statusul</Link>
          <Button variant="outline" className="glass-chip h-11 rounded-full px-5" onClick={() => setSuccess(null)}>Comandă din nou</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="glass-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1">
        {lines.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-center text-[#74837b]">
            <ShoppingBag className="mb-4 size-11 stroke-1" />
            <p className="font-medium text-[#315b32]">Coșul este gol</p>
            <p className="mt-1 max-w-[230px] text-sm">Adaugă bunătățile dorite din catalog.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map((product) => (
              <div key={product.id} className="glass-chip rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="font-medium text-[#173d2c]">{product.name}</p><p className="mt-1 text-sm text-[#74837b]">{money(linePrice(product, cart[product.id]))} lei</p></div>
                  <div className="flex items-center gap-1 rounded-full bg-white/45 p-1 backdrop-blur-md">
                    <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => change(product.id, -product.stepGrams)}><Minus /></Button>
                    <span className="min-w-14 text-center text-sm font-semibold text-[#315b32]">{quantityLabel(product, cart[product.id])}</span>
                    <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => change(product.id, product.stepGrams)}><Plus /></Button>
                  </div>
                </div>
              </div>
            ))}

            {recommendations.length > 0 && (
              <div className="rounded-2xl border border-[#ead7b7]/70 bg-[#fff8e9]/65 p-3 backdrop-blur-xl">
                <p className="text-xs font-bold uppercase tracking-[.1em] text-[#9a6222]">Se potrivesc cu alegerea ta</p>
                <div className="mt-2 space-y-2">{recommendations.map((product) => (
                  <button key={product.id} onClick={() => change(product.id, product.stepGrams)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/60 px-3 py-2 text-left text-sm transition hover:bg-white/85">
                    <span className="truncate">{getCategoryExperience(product.category).icon} {product.name}</span><span className="shrink-0 font-semibold text-[#315b32]">+ {quantityLabel(product, product.stepGrams)}</span>
                  </button>
                ))}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-white/60 bg-white/42 p-5 backdrop-blur-2xl">
        <div className="mb-4 flex items-end justify-between"><span className="text-sm text-[#607269]">Total de plată</span><strong className="font-serif text-3xl text-[#173d2c]">{money(total)} lei</strong></div>
        <div className="space-y-3">
          <Input className="glass-input h-11 rounded-xl px-3" placeholder="Numele și prenumele *" value={name} onChange={(event) => setName(event.target.value)} />
          <Input type="tel" inputMode="tel" autoComplete="tel" className="glass-input h-11 rounded-xl px-3" placeholder="Număr de telefon *" value={phone} onChange={(event) => setPhone(event.target.value)} />
          {schedule.closed ? <p className="rounded-xl bg-[#fff0df]/90 p-3 text-sm font-medium text-[#8b581c]">Comanda curentă este închisă. Vei putea trimite din nou când managerul deschide următoarea rundă.</p> : schedule.dates.length > 0 ? <ScheduleNotice schedule={schedule} compact /> : null}
          {submitError && <p className="rounded-xl bg-red-50/85 p-3 text-sm text-red-700 backdrop-blur-md">{submitError}</p>}
          <Button disabled={!name.trim() || !phone.trim() || !lines.length || sending || schedule.closed} onClick={submit} className="h-12 w-full rounded-xl bg-[#f2a444]/95 text-base font-semibold text-[#17301f] shadow-lg backdrop-blur-md hover:bg-[#e89531]">
            {sending ? 'Se trimite…' : schedule.closed ? 'Comanda este închisă' : 'Trimite comanda'} <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OrderApp() {
  const { products: firestoreProducts, loading, error } = useProducts();
  const { schedule } = useOrderSchedule();
  const { stats } = usePublicOrderMeta();
  const products = useMemo(() => firestoreProducts.filter((product) => product.active !== false), [firestoreProducts]);
  const [activeCategory, setActiveCategory] = useState<Category>('Nuci');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Cart>({});
  const [favorites, setFavorites] = useState<Set<string>>(() => readFavorites());
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(() => readLastOrder());

  const displayCategories = useMemo(() => [...new Set([...categories, ...products.map((product) => product.category)])].filter((category) => products.some((product) => product.category === category)), [products]);
  const categoryCounts = useMemo(() => Object.fromEntries(displayCategories.map((category) => [category, products.filter((product) => product.category === category).length])) as Record<Category, number>, [displayCategories, products]);

  const filtered = useMemo(() => products
    .filter((product) => product.category === activeCategory)
    .filter((product) => product.name.toLowerCase().includes(search.toLowerCase()))
    .filter((product) => !favoritesOnly || favorites.has(product.id))
    .sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id))), [activeCategory, search, products, favoritesOnly, favorites]);

  const freshProducts = useMemo(() => products.filter((product) => isNewProduct(product)).slice(0, 9), [products]);
  const itemCount = Object.values(cart).filter(Boolean).length;
  const total = products.reduce((sum, product) => sum + linePrice(product, cart[product.id] || 0), 0);
  const round = currentRoundLabel(schedule, stats.roundLabel);
  const countdown = useCountdown(schedule.dates[0]);

  const change = (productId: string, delta: number) => {
    const product = products.find((candidate) => candidate.id === productId);
    setCart((current) => ({ ...current, [productId]: Math.min(product?.stockLimit || Number.MAX_SAFE_INTEGER, Math.max(0, (current[productId] || 0) + delta)) }));
  };

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const restoreLastOrder = () => {
    if (!lastOrder) return;
    const known = new Set(products.map((product) => product.id));
    setCart(Object.fromEntries(Object.entries(lastOrder.cart).filter(([id, amount]) => known.has(id) && amount > 0)));
  };

  return (
    <main className="liquid-page min-h-screen pb-28 text-[#173d2c] lg:pb-0">
      <header className="sticky top-0 z-40 bg-[#f3f5ed]/30 px-2 backdrop-blur-xl">
        <div className="glass glass-shine mx-auto my-2 flex h-16 max-w-[1440px] items-center justify-between rounded-[24px] px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/valera-logo.svg?v=6" alt="Bunătăți împreună cu Valera" className="size-12 shrink-0 rounded-full border border-white/70 bg-white/65 object-cover shadow-sm" />
            <div className="min-w-0"><p className="truncate font-serif text-lg font-bold leading-none sm:text-2xl">Bunătăți împreună cu Valera</p><p className="mt-1 truncate text-xs text-[#74837b]">{round}</p></div>
          </div>
          <div className="ml-2 flex shrink-0 gap-1.5">
            <Link className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-[#315b32] transition hover:bg-white/75 sm:text-sm" to="/status"><PackageCheck className="size-4" /><span className="hidden sm:inline">Status</span></Link>
            <Link className="glass-chip rounded-full px-3 py-2 text-xs font-semibold text-[#315b32] transition hover:bg-white/75 sm:px-4 sm:text-sm" to="/admin">Manager</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] lg:grid lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-w-0 px-4 py-5 sm:px-8 lg:py-7">
          <div className="hero-wow relative mb-5 overflow-hidden rounded-[32px] bg-[#173d2c] text-white shadow-[0_28px_80px_rgba(23,61,44,.2)] ring-1 ring-white/35">
            <img src="/catalog-hero.png" alt="Nuci și fructe uscate" className="hero-parallax absolute inset-0 size-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#173d2c]/97 via-[#173d2c]/83 to-[#173d2c]/35" />
            <span className="hero-orb hero-orb-one" /><span className="hero-orb hero-orb-two" />
            <div className="relative grid min-h-[320px] items-center gap-6 p-7 sm:p-10 lg:grid-cols-[minmax(0,1fr)_270px]">
              <div>
                <div className="mb-4 flex flex-wrap gap-2">
                  <span className={`glass-dark inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[.12em] ${schedule.closed ? 'text-[#ffd1a5]' : 'text-[#f8c982]'}`}><Sparkles className="size-3.5" /> {schedule.closed ? 'Comandă închisă' : 'Comandă deschisă'}</span>
                  <span className="glass-dark inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white/85"><Clock className="size-3.5" /> {countdown}</span>
                </div>
                <p className="mb-2 text-sm font-semibold text-[#f4d7a4]">{round}</p>
                <h1 className="font-serif text-4xl font-semibold leading-[1.03] sm:text-5xl lg:text-6xl">Alege ce-ți place.<br />Noi comandăm împreună.</h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white/78 sm:text-base">Catalogul lunii, favoritele tale, recomandări rapide și statusul comenzii — într-o experiență simplă și premium.</p>
              </div>
              <PublicPulse stats={stats} />
            </div>
          </div>

          <div className={`mb-5 grid gap-3 ${lastOrder ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
            <ScheduleNotice schedule={schedule} />
            <MiaQrCard />
            {lastOrder && (
              <div className="glass glass-shine rounded-2xl p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.1em] text-[#7f6a4b]">Comanda ta anterioară</p><strong className="mt-1 block text-lg">{lastOrder.orderCode}</strong><p className="mt-1 text-xs text-[#74837b]">{money(lastOrder.totalLei)} lei</p></div><RotateCcw className="size-5 text-[#58745c]" /></div>
                <Button onClick={restoreLastOrder} variant="outline" className="glass-chip mt-4 w-full rounded-xl"><RotateCcw /> Comandă din nou</Button>
              </div>
            )}
          </div>

          {error && <p className="mb-4 rounded-xl bg-amber-50/80 p-3 text-sm text-amber-800 backdrop-blur-lg">{error}</p>}

          {freshProducts.length > 0 && (
            <section className="mb-6">
              <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#9a6222]">Descoperă</p><h2 className="font-serif text-2xl font-semibold">Nou în catalog</h2></div><span className="text-xs text-[#819087]">Swipe →</span></div>
              <div className="glass-scrollbar flex gap-3 overflow-x-auto pb-2">
                {freshProducts.map((product) => (
                  <button key={product.id} onClick={() => { setActiveCategory(product.category); window.setTimeout(() => document.getElementById(`product-${product.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80); }} className="glass interactive-glass group relative w-56 shrink-0 overflow-hidden rounded-[22px] text-left" onPointerMove={glassMove}>
                    <div className="relative h-28 overflow-hidden bg-[#dce7d7]"><img src={productImage(product)} alt={product.name} className="size-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" onError={(event) => { event.currentTarget.src = getCategoryExperience(product.category).photoUrl; }} /><div className="absolute inset-0 bg-gradient-to-t from-[#173d2c]/70 to-transparent" /><span className="absolute bottom-2 left-2 rounded-full bg-[#f5dcae]/90 px-2.5 py-1 text-[11px] font-bold text-[#714b20] backdrop-blur-md">NOU</span></div>
                    <div className="p-3"><strong className="line-clamp-2 block text-sm">{product.name}</strong><span className="mt-1 block text-xs text-[#7a8880]">{priceLabel(product)}</span></div>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="category-dock glass-strong sticky top-[76px] z-30 mb-6 rounded-[26px] p-2.5">
            <div className="glass-scrollbar flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
              {displayCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`shrink-0 rounded-full px-3.5 py-2.5 text-sm font-semibold transition ${activeCategory === category ? 'bg-[#173d2c] text-white shadow-lg' : 'glass-chip text-[#54685e] hover:bg-white/78'}`}
                >
                  <span className="mr-1.5">{getCategoryExperience(category).icon}</span>{category}<span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${activeCategory === category ? 'bg-white/15' : 'bg-[#173d2c]/7'}`}>{categoryCounts[category]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-serif text-3xl font-semibold">{activeCategory}</h2><p className="mt-1 text-sm text-[#74837b]">{getCategoryExperience(activeCategory).note}</p></div>
            <div className="flex w-full gap-2 sm:w-auto">
              <button onClick={() => setFavoritesOnly((value) => !value)} className={`glass-chip inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ${favoritesOnly ? 'bg-[#173d2c] text-white' : 'text-[#53665c]'}`}><Heart className={`size-4 ${favoritesOnly ? 'fill-current' : ''}`} /> {favorites.size}</button>
              <label className="glass relative block min-w-0 flex-1 rounded-full sm:w-72">
                <Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[#708078]" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 rounded-full border-transparent bg-transparent pl-10 shadow-none focus-visible:ring-[#769277]/40" placeholder="Caută un produs" />
              </label>
            </div>
          </div>

          <div className="mb-3 flex justify-end"><span className="text-sm text-[#839087]">{loading ? 'Se încarcă…' : `${filtered.length} produse`}</span></div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product: ManagedProduct) => {
              const amount = cart[product.id] || 0;
              const favorite = favorites.has(product.id);
              const fresh = isNewProduct(product);
              const visual = getCategoryExperience(product.category);
              const productPhoto = productImage(product);
              return (
                <article id={`product-${product.id}`} key={product.id} onPointerMove={glassMove} className={`glass interactive-glass glass-card-hover overflow-hidden rounded-[26px] ${amount ? 'ring-2 ring-[#8daa82]/45' : ''}`}>
                  <div className="relative h-32 overflow-hidden bg-[#dfe9db]">
                    <img src={productPhoto} alt={product.name} loading="lazy" decoding="async" className="size-full object-cover transition duration-500 hover:scale-105" onError={(event) => { event.currentTarget.src = visual.photoUrl; }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#173d2c]/72 via-transparent to-black/10" />
                    <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                      <span className="grid size-10 place-items-center rounded-2xl bg-white/72 text-lg shadow-sm backdrop-blur-xl">{visual.icon}</span>
                      <button onClick={() => toggleFavorite(product.id)} aria-label={favorite ? 'Scoate din favorite' : 'Adaugă la favorite'} className={`grid size-10 place-items-center rounded-full border border-white/35 backdrop-blur-xl transition ${favorite ? 'bg-[#173d2c]/82 text-white' : 'bg-white/65 text-[#315b32]'}`}><Heart className={`size-4 ${favorite ? 'fill-current' : ''}`} /></button>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex gap-1.5">{fresh && <span className="rounded-full bg-[#e4f2d8]/92 px-2.5 py-1 text-[11px] font-bold text-[#315b32] backdrop-blur-md">Nou</span>}{product.promo && <span className="rounded-full bg-[#fff0d9]/92 px-2.5 py-1 text-[11px] font-bold text-[#a65d13] backdrop-blur-md">Promo</span>}</div>
                      <span className="rounded-full bg-white/82 px-2.5 py-1 text-[11px] font-bold text-[#744e25] backdrop-blur-xl">{priceLabel(product)}</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="min-h-12 text-[17px] font-semibold leading-6">{product.name}</h3>
                    {amount ? (
                      <div className="mt-4 flex items-center justify-between gap-3"><div className="glass-chip flex items-center gap-1 rounded-full p-1"><Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => change(product.id, -product.stepGrams)}><Minus /></Button><strong className="min-w-14 text-center text-sm">{quantityLabel(product, amount)}</strong><Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => change(product.id, product.stepGrams)}><Plus /></Button></div><strong className="shrink-0">{money(linePrice(product, amount))} lei</strong></div>
                    ) : (
                      <Button onClick={() => change(product.id, product.stepGrams)} variant="outline" className="glass-chip mt-4 h-10 w-full rounded-xl border-white/60 text-[#315b32] hover:bg-white/75"><Plus /> Adaugă {quantityLabel(product, product.stepGrams)}</Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {!filtered.length && <div className="glass mt-4 rounded-[24px] p-8 text-center text-sm text-[#74837b]">Nu am găsit produse după filtrul ales.</div>}
        </section>

        <aside className="sticky top-20 hidden h-[calc(100vh-5rem)] p-3 pl-0 lg:block">
          <div className="glass-strong glass-shine flex h-full min-h-0 flex-col overflow-hidden rounded-[28px]">
            <div className="border-b border-white/60 px-5 py-5"><h2 className="font-serif text-2xl font-semibold">Comanda mea</h2><p className="mt-1 text-sm text-[#74837b]">{itemCount ? `${itemCount} produse alese` : 'Alege produsele din catalog'}</p></div>
            <div className="min-h-0 flex-1"><CartPanel cart={cart} setCart={setCart} products={products} schedule={schedule} lastOrder={lastOrder} onSubmitted={setLastOrder} /></div>
          </div>
        </aside>
      </div>

      <div className="glass fixed inset-x-3 bottom-3 z-40 rounded-[24px] p-2 lg:hidden">
        <Sheet>
          <SheetTrigger render={<Button className="glass-dark h-13 w-full rounded-[20px] px-5 text-base text-white" />}><ShoppingBag /> Vezi comanda <span className="ml-auto">{money(total)} lei</span></SheetTrigger>
          <SheetContent side="bottom" className="glass-strong max-h-[90vh] rounded-t-[30px] border-white/70 bg-white/68"><SheetHeader className="border-b border-white/60 px-5 py-4"><SheetTitle className="font-serif text-2xl">Comanda mea</SheetTitle><SheetDescription>{itemCount ? `${itemCount} produse alese` : 'Coșul este gol'}</SheetDescription></SheetHeader><CartPanel cart={cart} setCart={setCart} products={products} schedule={schedule} lastOrder={lastOrder} onSubmitted={setLastOrder} /></SheetContent>
        </Sheet>
      </div>
    </main>
  );
}
