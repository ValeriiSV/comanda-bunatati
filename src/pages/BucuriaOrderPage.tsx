import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import {
  BellRing,
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
import { auth, db } from '@/lib/firebase';
import { bucuriaPhotoCatalog } from '@/lib/bucuriaPhotoCatalog';

type Profile = {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  approved: boolean;
  blocked?: boolean;
  role: 'admin' | 'user';
};

type Status = 'draft' | 'open' | 'closed' | 'sent' | 'received' | 'distributed';
type Campaign = { id: string; title: string; supplier: string; status: Status; notes?: string; deadline?: string };
type Product = { id: string; barcode?: string; name: string; pack?: string; price: number; category?: string; unit?: 'buc' | 'kg'; step?: number };
type OrderItem = { productId: string; barcode?: string; name: string; pack?: string; price: number; qty: number; unit?: 'buc' | 'kg' };
type Order = { id: string; userId: string; userName: string; phone?: string; items: OrderItem[]; total: number; status: 'submitted'; updatedAt?: unknown };
type QtyMap = Record<string, number>;

const ADMIN_EMAIL = 'valerkasvetlicenco@icloud.com';
const MIA_LINK = 'https://mia-qr.bnm.md/1/m/BNM/MCB983a07f55265457d90654eb9f97574fc';
const FAVORITES_KEY = 'orbico_bucuria_favorites_v1';

const statusLabel: Record<Status, string> = {
  draft: 'În pregătire',
  open: 'Comandă deschisă',
  closed: 'Comandă închisă',
  sent: 'Trimisă furnizorului',
  received: 'Primită',
  distributed: 'Distribuită',
};

const money = (value: number) => new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 2 }).format(value || 0);
const safeId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
const round = (value: number) => Math.round(value * 1000) / 1000;

function readFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
}

function countdownLabel(deadline?: string) {
  if (!deadline) return 'Termenul va fi anunțat';
  const target = new Date(deadline).getTime();
  if (!Number.isFinite(target)) return 'Termenul va fi anunțat';
  const diff = target - Date.now();
  if (diff <= 0) return 'Termen încheiat';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days} zile ${hours} ore`;
  const minutes = Math.max(1, Math.floor((diff % 3600000) / 60000));
  return hours > 0 ? `${hours} ore ${minutes} min` : `${minutes} min`;
}

function quantityLabel(product: Product, qty: number) {
  const unit = product.unit || 'buc';
  if (unit === 'kg') return `${qty.toLocaleString('ro-MD', { maximumFractionDigits: 2 })} kg`;
  return `${qty.toLocaleString('ro-MD', { maximumFractionDigits: 0 })} buc`;
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
          <p className="mt-1 text-xs leading-5 text-[#74837b]">Scanează QR-ul și introdu suma comenzii tale Bucuria.</p>
        </div>
      </div>
    </div>
  );
}

function CampaignNotice({ campaign }: { campaign: Campaign }) {
  return (
    <div className="glass glass-shine rounded-2xl p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f7dfb8]/75 text-[#8b581c] shadow-sm backdrop-blur-md"><BellRing className="size-4" /></span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.1em] text-[#9a6222]">{statusLabel[campaign.status]}</p>
          <p className="mt-1.5 text-sm text-[#6f796f]">{campaign.notes || 'Comandă comună Bucuria pentru colegii Orbico.'}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/55 px-2.5 py-1 text-xs font-semibold text-[#6c5538]"><Clock className="size-3.5" /> {countdownLabel(campaign.deadline)}</p>
        </div>
      </div>
    </div>
  );
}

function BucuriaCartPanel({
  products,
  qty,
  setQty,
  campaign,
  profile,
  user,
  myOrder,
  onMessage,
}: {
  products: Product[];
  qty: QtyMap;
  setQty: Dispatch<SetStateAction<QtyMap>>;
  campaign: Campaign;
  profile: Profile;
  user: User;
  myOrder: Order | null;
  onMessage: (message: string) => void;
}) {
  const [name, setName] = useState(myOrder?.userName || profile.displayName || '');
  const [phone, setPhone] = useState(myOrder?.phone || profile.phone || '');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!myOrder) return;
    setName(myOrder.userName || profile.displayName || '');
    setPhone(myOrder.phone || profile.phone || '');
  }, [myOrder, profile.displayName, profile.phone]);

  const lines = products.map((product) => ({ product, qty: Number(qty[product.id] || 0) })).filter((entry) => entry.qty > 0);
  const total = lines.reduce((sum, entry) => sum + entry.product.price * entry.qty, 0);

  const change = (product: Product, direction: number) => {
    const step = Number(product.step || ((product.unit || 'buc') === 'kg' ? 0.1 : 1));
    setQty((current) => ({ ...current, [product.id]: Math.max(0, round(Number(current[product.id] || 0) + direction * step)) }));
  };

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !lines.length || sending || campaign.status !== 'open') return;
    setSending(true);
    try {
      const items: OrderItem[] = lines.map(({ product, qty: amount }) => ({
        productId: product.id,
        barcode: product.barcode || '',
        name: product.name,
        pack: product.pack || '',
        price: product.price,
        qty: amount,
        unit: product.unit || 'buc',
      }));
      await setDoc(doc(db, 'groupCampaigns', 'bucuria', 'orders', user.uid), {
        userId: user.uid,
        userName: name.trim(),
        phone: phone.trim(),
        items,
        total,
        status: 'submitted',
        updatedAt: serverTimestamp(),
      });
      setSuccess(true);
      onMessage(myOrder ? 'Comanda Bucuria a fost actualizată.' : 'Comanda Bucuria a fost trimisă.');
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Comanda nu a putut fi salvată.');
    } finally {
      setSending(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center px-5 py-6 text-center">
        <span className="glass mb-5 grid size-16 place-items-center rounded-full text-[#315b32]"><CheckCircle2 className="size-8" /></span>
        <h2 className="font-serif text-3xl font-semibold text-[#173d2c]">Comandă trimisă</h2>
        <p className="mt-3 max-w-xs text-[#607269]">Comanda Bucuria este salvată pe profilul tău și poate fi urmărită din pagina Status.</p>
        <div className="mt-5 w-full max-w-sm"><MiaQrCard compact /></div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/bucuria/status" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#173d2c] px-5 text-sm font-semibold text-white"><PackageCheck className="size-4" /> Vezi statusul</Link>
          <Button variant="outline" className="glass-chip h-11 rounded-full px-5" onClick={() => setSuccess(false)}>Modifică comanda</Button>
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
            <p className="mt-1 max-w-[230px] text-sm">Adaugă dulciurile dorite din catalog.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map(({ product, qty: amount }) => (
              <div key={product.id} className="glass-chip rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-[#173d2c]">{product.name}</p>
                    <p className="mt-1 text-sm text-[#74837b]">{money(product.price * amount)} lei</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-white/45 p-1 backdrop-blur-md">
                    <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => change(product, -1)}><Minus /></Button>
                    <span className="min-w-14 text-center text-sm font-semibold text-[#315b32]">{quantityLabel(product, amount)}</span>
                    <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => change(product, 1)}><Plus /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/60 bg-white/42 p-5 backdrop-blur-2xl">
        <div className="mb-4 flex items-end justify-between"><span className="text-sm text-[#607269]">Total de plată</span><strong className="font-serif text-3xl text-[#173d2c]">{money(total)} lei</strong></div>
        <div className="space-y-3">
          <Input className="glass-input h-11 rounded-xl px-3" placeholder="Numele și prenumele *" value={name} onChange={(event) => setName(event.target.value)} />
          <Input type="tel" inputMode="tel" autoComplete="tel" className="glass-input h-11 rounded-xl px-3" placeholder="Număr de telefon *" value={phone} onChange={(event) => setPhone(event.target.value)} />
          {campaign.status !== 'open' && <p className="rounded-xl bg-[#fff0df]/90 p-3 text-sm font-medium text-[#8b581c]">Comanda Bucuria nu este deschisă momentan. Managerul o poate deschide din panoul Manager.</p>}
          <Button disabled={!name.trim() || !phone.trim() || !lines.length || sending || campaign.status !== 'open'} onClick={submit} className="h-12 w-full rounded-xl bg-[#f2a444]/95 text-base font-semibold text-[#17301f] shadow-lg backdrop-blur-md hover:bg-[#e89531]">
            {sending ? 'Se trimite…' : campaign.status !== 'open' ? 'Comanda este închisă' : myOrder ? 'Actualizează comanda' : 'Trimite comanda'} <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BucuriaOrderPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [myOrder, setMyOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [qty, setQty] = useState<QtyMap>({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Toate');
  const [favorites, setFavorites] = useState<Set<string>>(() => readFavorites());
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const approved = profile?.approved === true && profile?.blocked !== true;
  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase() === ADMIN_EMAIL;

  useEffect(() => onAuthStateChanged(auth, async (next) => {
    setUser(next);
    setProfile(null);
    if (!next) return;
    try {
      const snap = await getDoc(doc(db, 'marketUsers', next.uid));
      if (snap.exists()) setProfile(snap.data() as Profile);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Profilul nu a putut fi încărcat.');
    }
  }), []);

  useEffect(() => {
    if (!approved) return;
    return onSnapshot(doc(db, 'groupCampaigns', 'bucuria'), (snap) => setCampaign(snap.exists() ? ({ id: snap.id, ...snap.data() } as Campaign) : null), (error) => setMessage(error.message));
  }, [approved]);

  useEffect(() => {
    if (!approved) return;
    return onSnapshot(collection(db, 'groupCampaigns', 'bucuria', 'products'), (snap) => {
      const list = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as Product)).sort((a, b) => a.name.localeCompare(b.name, 'ro'));
      setProducts(list);
    }, (error) => setMessage(error.message));
  }, [approved]);

  useEffect(() => {
    if (!approved || !user) return;
    if (isAdmin) {
      return onSnapshot(collection(db, 'groupCampaigns', 'bucuria', 'orders'), (snap) => {
        const list = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as Order));
        setOrders(list);
        const mine = list.find((order) => order.userId === user.uid) || null;
        setMyOrder(mine);
        if (mine) setQty(Object.fromEntries(mine.items.map((item) => [item.productId, item.qty])));
      }, (error) => setMessage(error.message));
    }
    return onSnapshot(doc(db, 'groupCampaigns', 'bucuria', 'orders', user.uid), (snap) => {
      if (!snap.exists()) {
        setMyOrder(null);
        return;
      }
      const order = { id: snap.id, ...snap.data() } as Order;
      setMyOrder(order);
      setQty(Object.fromEntries(order.items.map((item) => [item.productId, item.qty])));
    }, (error) => setMessage(error.message));
  }, [approved, user, isAdmin]);

  const categories = useMemo(() => ['Toate', ...Array.from(new Set(products.map((product) => product.category).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'ro'))], [products]);
  const visible = useMemo(() => products
    .filter((product) => category === 'Toate' || product.category === category)
    .filter((product) => {
      const needle = search.trim().toLowerCase();
      return !needle || `${product.name} ${product.barcode || ''} ${product.pack || ''}`.toLowerCase().includes(needle);
    })
    .filter((product) => !favoritesOnly || favorites.has(product.id))
    .sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)) || a.name.localeCompare(b.name, 'ro')), [products, category, search, favoritesOnly, favorites]);

  const selectedItems = useMemo(() => products.map((product) => ({ product, qty: Number(qty[product.id] || 0) })).filter((entry) => entry.qty > 0), [products, qty]);
  const itemCount = selectedItems.length;
  const total = selectedItems.reduce((sum, entry) => sum + entry.product.price * entry.qty, 0);
  const totalAllOrders = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const quickProducts = useMemo(() => products.slice(0, 8), [products]);

  const changeQty = (product: Product, direction: number) => {
    const step = Number(product.step || ((product.unit || 'buc') === 'kg' ? 0.1 : 1));
    setQty((current) => ({ ...current, [product.id]: Math.max(0, round(Number(current[product.id] || 0) + direction * step)) }));
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
    if (!myOrder) return;
    setQty(Object.fromEntries(myOrder.items.map((item) => [item.productId, item.qty])));
  };

  const createCampaign = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      await setDoc(doc(db, 'groupCampaigns', 'bucuria'), {
        title: 'Bucuria – Dulciuri',
        supplier: 'SOLDI SRL / SA Bucuria',
        status: 'draft',
        notes: 'Catalog provizoriu din lista foto. Prețurile se reconfirmă la primirea Excelului oficial.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setMessage('Campania Bucuria este pregătită.');
    } finally {
      setBusy(false);
    }
  };

  const seedCatalog = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const existing = await new Promise<any[]>((resolve, reject) => {
        const stop = onSnapshot(collection(db, 'groupCampaigns', 'bucuria', 'products'), (snap) => {
          stop();
          resolve(snap.docs);
        }, reject);
      });
      if (existing.length) {
        const remove = writeBatch(db);
        existing.forEach((entry) => remove.delete(entry.ref));
        await remove.commit();
      }
      const batch = writeBatch(db);
      bucuriaPhotoCatalog.forEach((product, index) => {
        const id = safeId(`${product.barcode || 'fara-cod'}-${product.name}-${product.pack || ''}-${index}`);
        batch.set(doc(db, 'groupCampaigns', 'bucuria', 'products', id), { ...product, source: 'photo-list-2025', updatedAt: serverTimestamp() });
      });
      await batch.commit();
      setMessage(`${bucuriaPhotoCatalog.length} poziții Bucuria au fost încărcate.`);
    } catch (error) {
      setMessage(`Catalogul nu a putut fi încărcat: ${error instanceof Error ? error.message : 'eroare necunoscută'}`);
    } finally {
      setBusy(false);
    }
  };

  if (!user) return <main className="liquid-page min-h-screen p-6 text-[#173d2c]"><section className="glass mx-auto mt-16 max-w-xl rounded-[28px] p-10 text-center"><h1 className="font-serif text-4xl font-semibold">Bucuria – Dulciuri</h1><p className="mt-3 text-[#74837b]">Autentifică-te în Orbico Market pentru a participa.</p><Link className="mt-5 inline-flex rounded-full bg-[#173d2c] px-5 py-3 font-semibold text-white" to="/">Orbico Market</Link></section></main>;
  if (!approved || !profile) return <main className="liquid-page min-h-screen p-6 text-[#173d2c]"><section className="glass mx-auto mt-16 max-w-xl rounded-[28px] p-10 text-center"><h1 className="font-serif text-4xl font-semibold">Cont în așteptare</h1><p className="mt-3 text-[#74837b]">Comenzile comune sunt disponibile după aprobarea contului.</p><Link className="mt-5 inline-flex rounded-full bg-[#173d2c] px-5 py-3 font-semibold text-white" to="/">Orbico Market</Link></section></main>;
  if (!campaign) return <main className="liquid-page min-h-screen p-6 text-[#173d2c]"><section className="glass mx-auto mt-16 max-w-xl rounded-[28px] p-10 text-center"><h1 className="font-serif text-4xl font-semibold">Bucuria – Dulciuri</h1><p className="mt-3 text-[#74837b]">Campania Bucuria nu este creată încă.</p>{isAdmin && <Button className="mt-5 rounded-full bg-[#173d2c]" onClick={createCampaign} disabled={busy}>Creează campania</Button>}</section></main>;

  return (
    <main className="liquid-page min-h-screen pb-28 text-[#173d2c] lg:pb-0">
      <header className="sticky top-0 z-40 bg-[#f3f5ed]/30 px-2 backdrop-blur-xl">
        <div className="glass glass-shine mx-auto my-2 flex h-16 max-w-[1440px] items-center justify-between rounded-[24px] px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-white/70 bg-[#fff1e7]/80 text-2xl shadow-sm">🍫</span>
            <div className="min-w-0"><p className="truncate font-serif text-lg font-bold leading-none sm:text-2xl">Bucuria – Dulciuri</p><p className="mt-1 truncate text-xs text-[#74837b]">SOLDI SRL / SA Bucuria</p></div>
          </div>
          <div className="ml-2 flex shrink-0 gap-1.5">
            <Link className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-[#315b32] transition hover:bg-white/75 sm:text-sm" to="/bucuria/status"><PackageCheck className="size-4" /><span className="hidden sm:inline">Status</span></Link>
            <Link className="glass-chip rounded-full px-3 py-2 text-xs font-semibold text-[#315b32] transition hover:bg-white/75 sm:px-4 sm:text-sm" to="/bucuria/manager">Manager</Link>
          </div>
        </div>
      </header>

      {message && <button className="glass mx-auto mt-2 block w-[min(calc(100%-24px),1000px)] rounded-xl px-4 py-2 text-left text-sm font-semibold" onClick={() => setMessage('')}>{message}</button>}

      <div className="mx-auto max-w-[1440px] lg:grid lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-w-0 px-4 py-5 sm:px-8 lg:py-7">
          <div className="hero-wow relative mb-5 overflow-hidden rounded-[32px] bg-[#173d2c] text-white shadow-[0_28px_80px_rgba(23,61,44,.2)] ring-1 ring-white/35">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_20%,rgba(230,95,75,.36),transparent_26%),radial-gradient(circle_at_72%_78%,rgba(242,164,68,.24),transparent_24%),linear-gradient(110deg,#173d2c_0%,#244e38_55%,#4b342d_100%)]" />
            <span className="hero-orb hero-orb-one" /><span className="hero-orb hero-orb-two" />
            <div className="relative grid min-h-[320px] items-center gap-6 p-7 sm:p-10 lg:grid-cols-[minmax(0,1fr)_270px]">
              <div>
                <div className="mb-4 flex flex-wrap gap-2">
                  <span className={`glass-dark inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[.12em] ${campaign.status === 'open' ? 'text-[#f8c982]' : 'text-[#ffd1a5]'}`}><Sparkles className="size-3.5" /> {statusLabel[campaign.status]}</span>
                  <span className="glass-dark inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white/85"><Clock className="size-3.5" /> {countdownLabel(campaign.deadline)}</span>
                </div>
                <p className="mb-2 text-sm font-semibold text-[#f4d7a4]">Comandă comună · Bucuria</p>
                <h1 className="font-serif text-4xl font-semibold leading-[1.03] sm:text-5xl lg:text-6xl">Alege ce-ți place.<br />Noi comandăm împreună.</h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white/78 sm:text-base">Catalog Bucuria, favorite, comandă rapidă, status și total — aceeași experiență simplă ca la Nuci & Fructe Uscate.</p>
              </div>
              <div className="glass-dark rounded-[24px] p-4 text-white shadow-2xl">
                <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-white/65">Live · Bucuria</p><p className="mt-1 font-serif text-2xl font-semibold">{isAdmin && orders.length ? `${orders.length} comenzi` : campaign.status === 'open' ? 'Comanda e deschisă' : statusLabel[campaign.status]}</p></div><span className={`size-2.5 rounded-full ${campaign.status === 'open' ? 'pulse-live bg-[#9be57d]' : 'bg-[#f0b28e]'}`} /></div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white/10 p-3"><Users className="size-4 text-[#dceecf]" /><strong className="mt-2 block text-lg">{isAdmin ? orders.length : myOrder ? 1 : 0}</strong><span className="text-xs text-white/60">comenzi</span></div>
                  <div className="rounded-2xl bg-white/10 p-3"><TrendingUp className="size-4 text-[#f7cf8d]" /><strong className="mt-2 block text-lg">{money(isAdmin ? totalAllOrders : myOrder?.total || 0)} lei</strong><span className="text-xs text-white/60">valoare</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className={`mb-5 grid gap-3 ${myOrder ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
            <CampaignNotice campaign={campaign} />
            <MiaQrCard />
            {myOrder && <div className="glass glass-shine rounded-2xl p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.1em] text-[#7f6a4b]">Comanda ta anterioară</p><strong className="mt-1 block text-lg">Bucuria</strong><p className="mt-1 text-xs text-[#74837b]">{money(myOrder.total)} lei · {myOrder.items.length} poziții</p></div><RotateCcw className="size-5 text-[#58745c]" /></div><Button onClick={restoreLastOrder} variant="outline" className="glass-chip mt-4 w-full rounded-xl"><RotateCcw /> Comandă din nou</Button></div>}
          </div>

          {isAdmin && products.length === 0 && <div className="glass mb-5 rounded-2xl p-4"><p className="font-semibold">Catalogul Bucuria nu este încărcat.</p><Button className="mt-3 rounded-xl bg-[#173d2c]" onClick={seedCatalog} disabled={busy}>Încarcă pozițiile din poze ({bucuriaPhotoCatalog.length})</Button></div>}

          {quickProducts.length > 0 && <section className="mb-5"><div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.1em] text-[#9a6222]">Descoperă</p><h2 className="font-serif text-2xl font-semibold">Selecție rapidă</h2></div><span className="text-xs text-[#74837b]">Swipe →</span></div><div className="glass-scrollbar flex gap-3 overflow-x-auto pb-2">{quickProducts.map((product) => <button key={product.id} onClick={() => changeQty(product, 1)} className="glass-chip min-w-[190px] rounded-2xl p-4 text-left transition hover:-translate-y-0.5"><span className="text-[10px] font-bold uppercase tracking-[.08em] text-[#9a6222]">{product.category || 'Bucuria'}</span><strong className="mt-2 block line-clamp-2 text-sm">{product.name}</strong><span className="mt-3 block text-sm font-semibold">+ {money(product.price)} lei / {product.unit || 'buc'}</span></button>)}</div></section>}

          <div className="glass mb-4 rounded-[24px] p-3 sm:p-4">
            <div className="flex gap-2">
              <label className="glass-input flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl px-3"><Search className="size-4 shrink-0" /><input className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Caută produs sau cod de bare..." /></label>
              <Button variant="outline" className={`glass-chip h-12 rounded-xl ${favoritesOnly ? 'bg-[#173d2c] text-white' : ''}`} onClick={() => setFavoritesOnly((value) => !value)}><Heart className={favoritesOnly ? 'fill-current' : ''} /> <span className="hidden sm:inline">Favorite</span></Button>
            </div>
            <div className="glass-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">{categories.map((entry) => <button key={entry} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition ${category === entry ? 'bg-[#173d2c] text-white' : 'glass-chip text-[#315b32]'}`} onClick={() => setCategory(entry)}>{entry}</button>)}</div>
          </div>

          <div className="space-y-2">
            {visible.map((product) => {
              const amount = Number(qty[product.id] || 0);
              return <article key={product.id} className={`glass glass-shine rounded-2xl p-3 sm:p-4 ${amount ? 'ring-1 ring-[#8fbd83]/55' : ''}`}>
                <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_130px_180px_120px]">
                  <div className="min-w-0"><div className="flex items-center gap-2"><button className="grid size-8 shrink-0 place-items-center rounded-full bg-white/55" onClick={() => toggleFavorite(product.id)} aria-label="Favorite"><Heart className={`size-4 ${favorites.has(product.id) ? 'fill-[#b1544b] text-[#b1544b]' : 'text-[#7a887d]'}`} /></button><div className="min-w-0"><span className="text-[9px] font-bold uppercase tracking-[.1em] text-[#9a6222]">{product.category || 'Bucuria'}</span><h3 className="truncate text-sm font-semibold sm:text-[15px]">{product.name}</h3><p className="truncate text-[10px] text-[#829087]">{product.pack || ((product.unit || 'buc') === 'kg' ? 'vrac' : 'bucată')}{product.barcode ? ` · ${product.barcode}` : ''}</p></div></div></div>
                  <div className="text-left sm:text-right"><strong className="text-sm">{money(product.price)} lei</strong><span className="ml-1 text-[10px] text-[#829087]">/ {product.unit || 'buc'}</span></div>
                  <div className="glass-chip flex w-fit items-center gap-1 rounded-full p-1"><Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => changeQty(product, -1)}><Minus /></Button><strong className="min-w-14 text-center text-sm">{amount ? quantityLabel(product, amount) : '0'}</strong><Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => changeQty(product, 1)}><Plus /></Button></div>
                  <div className="text-left sm:text-right"><span className="text-[9px] uppercase text-[#829087]">Subtotal</span><strong className="block text-sm">{amount ? `${money(product.price * amount)} lei` : '—'}</strong></div>
                </div>
              </article>;
            })}
          </div>

          {!visible.length && <div className="glass mt-4 rounded-[24px] p-8 text-center text-sm text-[#74837b]">Nu am găsit produse după filtrul ales.</div>}
        </section>

        <aside className="sticky top-20 hidden h-[calc(100vh-5rem)] p-3 pl-0 lg:block">
          <div className="glass-strong glass-shine flex h-full min-h-0 flex-col overflow-hidden rounded-[28px]">
            <div className="border-b border-white/60 px-5 py-5"><h2 className="font-serif text-2xl font-semibold">Comanda mea</h2><p className="mt-1 text-sm text-[#74837b]">{itemCount ? `${itemCount} produse alese` : 'Alege produsele din catalog'}</p></div>
            <div className="min-h-0 flex-1"><BucuriaCartPanel products={products} qty={qty} setQty={setQty} campaign={campaign} profile={profile} user={user} myOrder={myOrder} onMessage={setMessage} /></div>
          </div>
        </aside>
      </div>

      <div className="glass fixed inset-x-3 bottom-3 z-40 rounded-[24px] p-2 lg:hidden">
        <Sheet>
          <SheetTrigger render={<Button className="glass-dark h-13 w-full rounded-[20px] px-5 text-base text-white" />}><ShoppingBag /> Vezi comanda <span className="ml-auto">{money(total)} lei</span></SheetTrigger>
          <SheetContent side="bottom" className="glass-strong max-h-[90vh] rounded-t-[30px] border-white/70 bg-white/68"><SheetHeader className="border-b border-white/60 px-5 py-4"><SheetTitle className="font-serif text-2xl">Comanda mea</SheetTitle><SheetDescription>{itemCount ? `${itemCount} produse alese` : 'Coșul este gol'}</SheetDescription></SheetHeader><BucuriaCartPanel products={products} qty={qty} setQty={setQty} campaign={campaign} profile={profile} user={user} myOrder={myOrder} onMessage={setMessage} /></SheetContent>
        </Sheet>
      </div>
    </main>
  );
}
