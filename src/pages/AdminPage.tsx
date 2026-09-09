import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Check, Download, Eye, EyeOff, LockKeyhole, LogOut, PackageCheck, Pencil, Plus, Save, Trash2, Users, WalletCards, X } from 'lucide-react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { auth, db } from '@/lib/firebase';
import { categories, products as defaultProducts, type Category } from '@/lib/products';
import type { ManagedProduct } from '@/hooks/useProducts';
import { formatOrderDate, useOrderSchedule } from '@/hooks/useOrderSchedule';

type OrderItem = { productId?: string; productName?: string; category?: string; grams?: number; lineTotalBani?: number };
type Order = {
  id: string;
  orderCode?: string;
  customerName?: string;
  phone?: string;
  note?: string;
  totalBani?: number;
  paid?: boolean;
  createdAt?: { toDate?: () => Date } | null;
  items?: OrderItem[];
};

type ProductDraft = {
  name: string;
  category: Category;
  priceLei: string;
  baseGrams: string;
  stepGrams: string;
  active: boolean;
  isNew: boolean;
  promo: boolean;
};

const emptyDraft: ProductDraft = {
  name: '', category: 'Nuci', priceLei: '', baseGrams: '1000', stepGrams: '250', active: true, isNew: false, promo: false,
};

function lei(bani = 0) {
  return new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 2 }).format(bani / 100);
}

function orderDate(order: Order) {
  try { return order.createdAt?.toDate?.() || new Date(); } catch { return new Date(); }
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('ro-MD', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function slugify(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function AdminDashboard() {
  const { schedule } = useOrderSchedule();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [productsReady, setProductsReady] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [newOrderDate, setNewOrderDate] = useState('');
  const [scheduleMessage, setScheduleMessage] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => setScheduleMessage(schedule.message || ''), [schedule.message]);

  useEffect(() => {
    let stopOrders = () => {};
    let stopProducts = () => {};

    const stopAuth = onAuthStateChanged(auth, async (user) => {
      stopOrders();
      stopProducts();
      setChecking(true);
      setError('');

      if (!user) {
        setAuthorized(false);
        setChecking(false);
        return;
      }

      try {
        const admin = await Promise.race([
          getDoc(doc(db, 'admins', user.uid)),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
        ]);

        if (!admin.exists()) {
          setAuthorized(false);
          setError('Acest cont nu are acces de administrator.');
          await signOut(auth);
          return;
        }

        setAuthorized(true);

        stopOrders = onSnapshot(query(collection(db, 'groupOrders'), orderBy('createdAt', 'desc')), (snapshot) => {
          setOrders(snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Omit<Order, 'id'>) })));
        }, () => setError('Comenzile nu au putut fi încărcate. Verifică regulile Firestore.'));

        stopProducts = onSnapshot(query(collection(db, 'products'), orderBy('sortOrder', 'asc')), (snapshot) => {
          setProducts(snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Omit<ManagedProduct, 'id'>) })));
          setProductsReady(true);
        }, () => {
          setProductsReady(true);
          setError('Produsele nu au putut fi încărcate. Verifică regulile Firestore pentru colecția products.');
        });
      } catch (err) {
        console.error('Admin access check failed:', err);
        setAuthorized(false);
        setError('Nu am putut verifica accesul de administrator. Reîncarcă pagina sau autentifică-te din nou.');
      } finally {
        setChecking(false);
      }
    });

    return () => { stopAuth(); stopOrders(); stopProducts(); };
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setChecking(true);
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch { setChecking(false); setError('Email sau parolă incorectă.'); }
  };

  const loginWithGoogle = async () => {
    setError('');
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (loginError) {
      const code = (loginError as { code?: string }).code;
      if (code !== 'auth/popup-closed-by-user') setError('Autentificarea cu Google nu a reușit. Încearcă din nou.');
    }
  };

  const monthOptions = useMemo(() => {
    const keys = new Set(orders.map((order) => monthKey(orderDate(order))));
    keys.add(monthKey(new Date()));
    return [...keys].sort().reverse();
  }, [orders]);

  const visibleOrders = useMemo(() => orders.filter((order) => monthKey(orderDate(order)) === selectedMonth), [orders, selectedMonth]);

  const totals = useMemo(() => {
    const totalBani = visibleOrders.reduce((sum, order) => sum + (Number(order.totalBani) || 0), 0);
    const paidBani = visibleOrders.filter((order) => order.paid).reduce((sum, order) => sum + (Number(order.totalBani) || 0), 0);
    const byProduct = new Map<string, { name: string; grams: number }>();
    visibleOrders.forEach((order) => (Array.isArray(order.items) ? order.items : []).forEach((item) => {
      const id = item.productId || item.productName || 'produs';
      const name = item.productName || 'Produs';
      const current = byProduct.get(id) || { name, grams: 0 };
      current.grams += Number(item.grams) || 0;
      byProduct.set(id, current);
    }));
    return { totalBani, paidBani, byProduct: [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name, 'ro')) };
  }, [visibleOrders]);

  const togglePaid = async (order: Order) => {
    try { await updateDoc(doc(db, 'groupOrders', order.id), { paid: !order.paid, updatedAt: serverTimestamp() }); }
    catch { setError('Nu am putut modifica statutul plății.'); }
  };

  const removeOrder = async (order: Order) => {
    const name = order.customerName || 'acestui coleg';
    if (!window.confirm(`Ștergi comanda lui ${name}? Această acțiune nu poate fi anulată.`)) return;
    try { await deleteDoc(doc(db, 'groupOrders', order.id)); setNotice(`Comanda lui ${name} a fost ștearsă.`); }
    catch { setError('Comanda nu a putut fi ștearsă.'); }
  };

  const exportCsv = () => {
    const rows = [['Cod', 'Data', 'Nume', 'Telefon', 'Achitat', 'Produs', 'Categorie', 'Cantitate (g)', 'Produs (lei)', 'Total persoană (lei)']];
    visibleOrders.forEach((order) => (Array.isArray(order.items) ? order.items : []).forEach((item) => rows.push([
      order.orderCode || '', orderDate(order).toLocaleString('ro-MD'), order.customerName || '', order.phone || '', order.paid ? 'Da' : 'Nu', item.productName || '',
      item.category || '', String(item.grams || 0), lei(item.lineTotalBani || 0), lei(order.totalBani || 0),
    ])));
    const csv = '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `comenzi-bunatati-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const saveSchedule = async (dates: string[], message = scheduleMessage) => {
    setSavingSchedule(true); setError(''); setNotice('');
    try {
      await setDoc(doc(db, 'settings', 'orderSchedule'), { dates: [...new Set(dates)].filter(Boolean).sort(), message: message.trim(), updatedAt: serverTimestamp() }, { merge: true });
      setNotice('Datele următoarei comenzi au fost actualizate.');
    } catch { setError('Nu am putut salva datele următoarei comenzi.'); }
    finally { setSavingSchedule(false); }
  };

  const addOrderDate = async () => { if (newOrderDate) { await saveSchedule([...schedule.dates, newOrderDate]); setNewOrderDate(''); } };
  const removeOrderDate = async (date: string) => saveSchedule(schedule.dates.filter((item) => item !== date));
  const saveScheduleMessage = async () => saveSchedule(schedule.dates, scheduleMessage);

  const seedProducts = async () => {
    setSavingProduct(true); setError('');
    try {
      const batch = writeBatch(db);
      defaultProducts.forEach((product, index) => batch.set(doc(db, 'products', product.id), { ...product, active: true, isNew: false, promo: false, sortOrder: index, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
      await batch.commit();
      setNotice('Catalogul actual a fost încărcat în Firebase.');
    } catch { setError('Nu am putut inițializa produsele.'); }
    finally { setSavingProduct(false); }
  };

  const startEdit = (product: ManagedProduct) => {
    setEditingId(product.id);
    setDraft({ name: product.name, category: product.category, priceLei: String(product.priceLei), baseGrams: String(product.baseGrams), stepGrams: String(product.stepGrams), active: product.active !== false, isNew: !!product.isNew, promo: !!product.promo });
  };
  const cancelEdit = () => { setEditingId(null); setDraft(emptyDraft); };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setNotice('');
    const name = draft.name.trim();
    const priceLei = Number(draft.priceLei); const baseGrams = Number(draft.baseGrams); const stepGrams = Number(draft.stepGrams);
    if (!name || priceLei <= 0 || baseGrams <= 0 || stepGrams <= 0) { setError('Completează corect datele produsului.'); return; }
    const id = editingId || slugify(name) || `produs-${Date.now()}`;
    setSavingProduct(true);
    try {
      const existing = editingId ? products.find((p) => p.id === editingId) : undefined;
      await setDoc(doc(db, 'products', id), { name, category: draft.category, priceLei, baseGrams, stepGrams, active: draft.active, isNew: draft.isNew, promo: draft.promo, sortOrder: existing?.sortOrder ?? products.length, updatedAt: serverTimestamp(), ...(editingId ? {} : { createdAt: serverTimestamp() }) }, { merge: true });
      setNotice(editingId ? 'Produsul a fost actualizat.' : 'Produsul a fost adăugat.');
      cancelEdit();
    } catch { setError('Produsul nu a putut fi salvat.'); }
    finally { setSavingProduct(false); }
  };

  const toggleProduct = async (product: ManagedProduct) => {
    try { await updateDoc(doc(db, 'products', product.id), { active: product.active === false, updatedAt: serverTimestamp() }); }
    catch { setError('Nu am putut schimba disponibilitatea produsului.'); }
  };

  const removeProduct = async (product: ManagedProduct) => {
    if (!window.confirm(`Ștergi produsul „${product.name}”?`)) return;
    try { await deleteDoc(doc(db, 'products', product.id)); if (editingId === product.id) cancelEdit(); }
    catch { setError('Produsul nu a putut fi șters.'); }
  };

  if (checking) return <main className="grid min-h-screen place-items-center bg-[#f2f5ed] text-[#607269]"><div className="text-center"><img src="/valera-logo.svg" alt="Bunătăți împreună cu Valera" className="mx-auto mb-4 size-20 rounded-full" /><p>Se verifică accesul…</p><p className="mt-2 text-xs text-[#8a968f]">Dacă verificarea durează prea mult, vei primi automat un mesaj de eroare.</p></div></main>;

  if (!authorized) return <main className="grid min-h-screen place-items-center bg-[#f2f5ed] p-5 text-[#173d2c]">
    <section className="w-full max-w-md rounded-[28px] border border-[#d9e3d7] bg-white p-7 shadow-[0_24px_70px_rgba(23,61,44,.12)] sm:p-9">
      <Link to="/" className="mb-7 flex items-center gap-2 text-sm font-medium text-[#607269]"><ArrowLeft className="size-4" /> Înapoi la catalog</Link>
      <img src="/valera-logo.svg" alt="Bunătăți împreună cu Valera" className="mb-5 size-20 rounded-full border border-[#d9e3d7]" />
      <h1 className="font-serif text-3xl font-semibold">Panoul managerului</h1>
      <p className="mt-2 text-sm leading-6 text-[#74837b]">Bunătăți împreună cu Valera</p>
      <form className="mt-7 space-y-3" onSubmit={login}>
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="h-12 rounded-xl" />
        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Parolă" className="h-12 rounded-xl" />
        <Button disabled={!email || !password} className="h-12 w-full rounded-xl bg-[#173d2c] text-base">Intră în panou</Button>
      </form>
      <div className="my-4 flex items-center gap-3 text-xs text-[#8a968f]"><span className="h-px flex-1 bg-[#dfe7df]" />sau<span className="h-px flex-1 bg-[#dfe7df]" /></div>
      <Button type="button" variant="outline" className="h-12 w-full rounded-xl" onClick={loginWithGoogle}>Continuă cu Google</Button>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>
  </main>;

  return <main className="min-h-screen bg-[#f2f5ed] text-[#173d2c]">
    <header className="border-b border-[#d9e3d7] bg-white"><div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:px-8"><div className="flex items-center gap-3"><Link to="/"><img src="/valera-logo.svg" alt="Bunătăți împreună cu Valera" className="size-12 rounded-full border border-[#d6e0d5]" /></Link><div><h1 className="font-serif text-2xl font-semibold">Panoul managerului</h1><p className="text-xs text-[#74837b]">Bunătăți împreună cu Valera</p></div></div><div className="flex gap-2"><Button className="bg-[#173d2c]" onClick={exportCsv}><Download /> Descarcă CSV</Button><Button variant="outline" size="icon" onClick={() => signOut(auth)}><LogOut /></Button></div></div></header>
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-8">
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-xl bg-[#e8f3df] p-3 text-sm text-[#315b32]">{notice}</p>}

      <section className="rounded-[24px] border border-[#e4d4b8] bg-[#fffaf0] p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3"><CalendarDays /><div><h2 className="font-serif text-2xl font-semibold">Următoarea comandă</h2><p className="mt-1 text-sm text-[#7d674d]">Setează data sau datele afișate colegilor.</p></div></div>
        <div className="flex flex-col gap-3 sm:flex-row"><Input type="date" value={newOrderDate} onChange={(e) => setNewOrderDate(e.target.value)} className="h-11 max-w-xs bg-white" /><Button onClick={addOrderDate} disabled={!newOrderDate || savingSchedule} className="h-11 bg-[#173d2c]"><Plus /> Adaugă data</Button></div>
        {schedule.dates.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{schedule.dates.map((date) => <div key={date} className="flex items-center gap-2 rounded-full border bg-white py-1.5 pl-3 pr-1.5 text-sm font-semibold"><span>{formatOrderDate(date)}</span><button onClick={() => removeOrderDate(date)} className="grid size-7 place-items-center rounded-full text-red-600"><X className="size-3.5" /></button></div>)}</div>}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row"><Input value={scheduleMessage} onChange={(e) => setScheduleMessage(e.target.value)} placeholder="Mesaj opțional" className="h-11 bg-white" /><Button variant="outline" onClick={saveScheduleMessage} disabled={savingSchedule}><Save /> Salvează mesajul</Button></div>
      </section>

      <section className="rounded-[22px] border border-[#d9e3d7] bg-white p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Perioada comenzilor</p><p className="mt-1 text-xs text-[#74837b]">Istoric separat pe luni.</p></div><select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="h-11 min-w-56 rounded-xl border px-3 text-sm font-semibold">{monthOptions.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}</select></div></section>

      <section className="grid gap-3 sm:grid-cols-3"><Stat icon={<Users />} label={`Comenzi · ${monthLabel(selectedMonth)}`} value={String(visibleOrders.length)} /><Stat icon={<WalletCards />} label="Total de încasat" value={`${lei(totals.totalBani)} lei`} /><Stat icon={<PackageCheck />} label="Încasat" value={`${lei(totals.paidBani)} lei`} /></section>

      <section className="rounded-[24px] border border-[#d9e3d7] bg-white p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="font-serif text-2xl font-semibold">Produse</h2><p className="mt-1 text-sm text-[#74837b]">Modificările apar automat pe site.</p></div>{productsReady && products.length === 0 && <Button onClick={seedProducts} disabled={savingProduct} className="bg-[#173d2c]">Încarcă catalogul actual</Button>}</div>
        {products.length > 0 && <div className="mb-6 overflow-x-auto rounded-2xl border"><Table><TableHeader><TableRow><TableHead>Produs</TableHead><TableHead>Categorie</TableHead><TableHead>Preț</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Acțiuni</TableHead></TableRow></TableHeader><TableBody>{products.map((product) => <TableRow key={product.id}><TableCell><strong>{product.name}</strong></TableCell><TableCell>{product.category}</TableCell><TableCell>{product.priceLei} lei/{product.baseGrams === 1000 ? 'kg' : `${product.baseGrams} g`}</TableCell><TableCell>{product.active === false ? 'Ascuns' : 'Activ'}</TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => toggleProduct(product)}>{product.active === false ? <Eye /> : <EyeOff />}</Button><Button variant="ghost" size="icon" onClick={() => startEdit(product)}><Pencil /></Button><Button variant="ghost" size="icon" onClick={() => removeProduct(product)}><Trash2 /></Button></div></TableCell></TableRow>)}</TableBody></Table></div>}
        <form onSubmit={saveProduct} className="rounded-2xl bg-[#f5f8f1] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{editingId ? 'Editează produsul' : 'Adaugă produs nou'}</h3>{editingId && <Button type="button" variant="ghost" size="icon" onClick={cancelEdit}><X /></Button>}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Input value={draft.name} onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))} placeholder="Denumire produs" className="lg:col-span-2" /><select value={draft.category} onChange={(e) => setDraft((c) => ({ ...c, category: e.target.value as Category }))} className="h-9 rounded-md border px-3 text-sm">{categories.map((c) => <option key={c}>{c}</option>)}</select><Input type="number" value={draft.priceLei} onChange={(e) => setDraft((c) => ({ ...c, priceLei: e.target.value }))} placeholder="Preț lei" /><Input type="number" value={draft.baseGrams} onChange={(e) => setDraft((c) => ({ ...c, baseGrams: e.target.value }))} placeholder="Bază g" /><Input type="number" value={draft.stepGrams} onChange={(e) => setDraft((c) => ({ ...c, stepGrams: e.target.value }))} placeholder="Pas g" /></div>
          <div className="mt-4 flex flex-wrap items-center gap-4"><label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft((c) => ({ ...c, active: e.target.checked }))} /> Activ</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.isNew} onChange={(e) => setDraft((c) => ({ ...c, isNew: e.target.checked }))} /> Nou</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.promo} onChange={(e) => setDraft((c) => ({ ...c, promo: e.target.checked }))} /> Promo</label><Button type="submit" disabled={savingProduct || !draft.name.trim() || !draft.priceLei} className="ml-auto bg-[#173d2c]">{editingId ? <Save /> : <Plus />} Salvează</Button></div>
        </form>
      </section>

      <section className="rounded-[24px] border border-[#d9e3d7] bg-white p-5 sm:p-6"><h2 className="font-serif text-2xl font-semibold">Lista pentru vânzător</h2><p className="mt-1 text-sm text-[#74837b]">Cantități cumulate pentru {monthLabel(selectedMonth)}</p>{totals.byProduct.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{totals.byProduct.map((product) => <div key={product.name} className="flex items-center justify-between rounded-xl bg-[#f2f6ee] px-4 py-3"><span>{product.name}</span><strong>{product.grams >= 1000 ? `${product.grams / 1000} kg` : `${product.grams} g`}</strong></div>)}</div> : <p className="py-8 text-center text-[#74837b]">Nu există produse comandate.</p>}</section>

      <section className="overflow-hidden rounded-[24px] border border-[#d9e3d7] bg-white"><div className="border-b p-5 sm:p-6"><h2 className="font-serif text-2xl font-semibold">Comenzi individuale · {monthLabel(selectedMonth)}</h2></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nume</TableHead><TableHead>Telefon</TableHead><TableHead>Produse</TableHead><TableHead>Total</TableHead><TableHead>Plată</TableHead><TableHead className="text-right">Acțiuni</TableHead></TableRow></TableHeader><TableBody>{visibleOrders.map((order) => <TableRow key={order.id}><TableCell><strong>{order.customerName || 'Fără nume'}</strong><span className="mt-1 block text-xs text-[#829087]">{order.orderCode || '—'} · {orderDate(order).toLocaleDateString('ro-MD')}</span></TableCell><TableCell>{order.phone || '—'}</TableCell><TableCell className="min-w-72">{(Array.isArray(order.items) ? order.items : []).map((item, index) => <span key={`${item.productId || item.productName}-${index}`} className="mr-1.5 mb-1.5 inline-flex rounded-full bg-[#eef3e8] px-2.5 py-1 text-xs">{item.productName || 'Produs'} · {item.grams || 0} g</span>)}</TableCell><TableCell className="font-semibold">{lei(order.totalBani || 0)} lei</TableCell><TableCell><Button size="sm" variant={order.paid ? 'secondary' : 'outline'} onClick={() => togglePaid(order)}>{order.paid && <Check />} {order.paid ? 'Achitat' : 'Neachitat'}</Button></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => removeOrder(order)} className="text-red-600"><Trash2 /></Button></TableCell></TableRow>)}{visibleOrders.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-[#74837b]">Nu există comenzi pentru această lună.</TableCell></TableRow>}</TableBody></Table></div></section>
    </div>
  </main>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-[22px] border border-[#d9e3d7] bg-white p-5"><span className="mb-5 grid size-10 place-items-center rounded-xl bg-[#eef3e8] text-[#4d724a]">{icon}</span><p className="text-sm text-[#74837b]">{label}</p><strong className="mt-1 block font-serif text-3xl">{value}</strong></div>;
}
