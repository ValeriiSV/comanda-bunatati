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

type OrderItem = { productId: string; productName: string; category: string; grams: number; lineTotalBani: number };
type Order = { id: string; orderCode: string; customerName: string; note: string; totalBani: number; paid: boolean; createdAt: { toDate?: () => Date } | null; items: OrderItem[] };

type ProductDraft = {
  id: string;
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
  id: '', name: '', category: 'Nuci', priceLei: '', baseGrams: '1000', stepGrams: '250', active: true, isNew: false, promo: false,
};

function lei(bani: number) {
  return new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 2 }).format(bani / 100);
}

function orderDate(order: Order) {
  return order.createdAt?.toDate?.() || new Date();
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

  useEffect(() => {
    setScheduleMessage(schedule.message || '');
  }, [schedule.message]);

  useEffect(() => {
    let stopOrders = () => {};
    let stopProducts = () => {};
    const stopAuth = onAuthStateChanged(auth, async (user) => {
      stopOrders(); stopProducts();
      if (!user) { setAuthorized(false); setChecking(false); return; }
      const admin = await getDoc(doc(db, 'admins', user.uid));
      if (!admin.exists()) {
        setError('Acest cont nu are acces de administrator.');
        await signOut(auth);
        setChecking(false);
        return;
      }
      setAuthorized(true);
      setChecking(false);
      stopOrders = onSnapshot(query(collection(db, 'groupOrders'), orderBy('createdAt', 'desc')), (snapshot) => {
        setOrders(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Order));
      }, () => setError('Comenzile nu au putut fi încărcate. Verifică regulile Firestore.'));
      stopProducts = onSnapshot(query(collection(db, 'products'), orderBy('sortOrder', 'asc')), (snapshot) => {
        setProducts(snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Omit<ManagedProduct, 'id'>) })));
        setProductsReady(true);
      }, () => {
        setProductsReady(true);
        setError('Produsele nu au putut fi încărcate. Verifică regulile Firestore pentru colecția products.');
      });
    });
    return () => { stopAuth(); stopOrders(); stopProducts(); };
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch { setError('Email sau parolă incorectă.'); }
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

  const visibleOrders = useMemo(
    () => orders.filter((order) => monthKey(orderDate(order)) === selectedMonth),
    [orders, selectedMonth],
  );

  const totals = useMemo(() => {
    const totalBani = visibleOrders.reduce((sum, order) => sum + order.totalBani, 0);
    const paidBani = visibleOrders.filter((order) => order.paid).reduce((sum, order) => sum + order.totalBani, 0);
    const byProduct = new Map<string, { name: string; grams: number }>();
    visibleOrders.forEach((order) => order.items.forEach((item) => {
      const current = byProduct.get(item.productId) || { name: item.productName, grams: 0 };
      current.grams += item.grams;
      byProduct.set(item.productId, current);
    }));
    return { totalBani, paidBani, byProduct: [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name, 'ro')) };
  }, [visibleOrders]);

  const togglePaid = async (order: Order) => {
    await updateDoc(doc(db, 'groupOrders', order.id), { paid: !order.paid, updatedAt: serverTimestamp() });
  };

  const removeOrder = async (order: Order) => {
    if (!window.confirm(`Ștergi comanda lui ${order.customerName}? Această acțiune nu poate fi anulată.`)) return;
    try {
      await deleteDoc(doc(db, 'groupOrders', order.id));
      setNotice(`Comanda lui ${order.customerName} a fost ștearsă.`);
    } catch {
      setError('Comanda nu a putut fi ștearsă.');
    }
  };

  const exportCsv = () => {
    const rows = [['Cod', 'Data', 'Nume', 'Achitat', 'Produs', 'Categorie', 'Cantitate (g)', 'Produs (lei)', 'Total persoană (lei)', 'Notă']];
    visibleOrders.forEach((order) => order.items.forEach((item) => rows.push([
      order.orderCode, orderDate(order).toLocaleString('ro-MD'), order.customerName, order.paid ? 'Da' : 'Nu', item.productName,
      item.category, String(item.grams), lei(item.lineTotalBani), lei(order.totalBani), order.note,
    ])));
    const csv = '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `comenzi-bunatati-${selectedMonth}.csv`;
    link.click(); URL.revokeObjectURL(link.href);
  };

  const saveSchedule = async (dates: string[], message = scheduleMessage) => {
    setSavingSchedule(true); setError(''); setNotice('');
    try {
      await setDoc(doc(db, 'settings', 'orderSchedule'), {
        dates: [...new Set(dates)].filter(Boolean).sort(),
        message: message.trim(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setNotice('Datele următoarei comenzi au fost actualizate și apar automat colegilor.');
    } catch {
      setError('Nu am putut salva datele. Trebuie permis accesul la colecția settings în regulile Firestore.');
    } finally { setSavingSchedule(false); }
  };

  const addOrderDate = async () => {
    if (!newOrderDate) return;
    await saveSchedule([...schedule.dates, newOrderDate]);
    setNewOrderDate('');
  };

  const removeOrderDate = async (date: string) => {
    await saveSchedule(schedule.dates.filter((item) => item !== date));
  };

  const saveScheduleMessage = async () => {
    await saveSchedule(schedule.dates, scheduleMessage);
  };

  const seedProducts = async () => {
    setSavingProduct(true); setError('');
    try {
      const batch = writeBatch(db);
      defaultProducts.forEach((product, index) => {
        batch.set(doc(db, 'products', product.id), { ...product, active: true, isNew: false, promo: false, sortOrder: index, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      });
      await batch.commit();
      setNotice('Catalogul actual a fost încărcat în Firebase. De acum îl poți modifica direct de aici.');
    } catch {
      setError('Nu am putut inițializa produsele. Verifică regulile Firestore pentru administratori.');
    } finally { setSavingProduct(false); }
  };

  const startEdit = (product: ManagedProduct) => {
    setEditingId(product.id);
    setDraft({ id: product.id, name: product.name, category: product.category, priceLei: String(product.priceLei), baseGrams: String(product.baseGrams), stepGrams: String(product.stepGrams), active: product.active !== false, isNew: !!product.isNew, promo: !!product.promo });
    setNotice('');
  };

  const cancelEdit = () => { setEditingId(null); setDraft(emptyDraft); };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setNotice('');
    const name = draft.name.trim();
    const priceLei = Number(draft.priceLei); const baseGrams = Number(draft.baseGrams); const stepGrams = Number(draft.stepGrams);
    if (!name || !Number.isFinite(priceLei) || priceLei <= 0 || !Number.isInteger(baseGrams) || baseGrams <= 0 || !Number.isInteger(stepGrams) || stepGrams <= 0) {
      setError('Completează corect denumirea, prețul și cantitățile.'); return;
    }
    const id = editingId || slugify(name) || `produs-${Date.now()}`;
    if (!editingId && products.some((product) => product.id === id)) { setError('Există deja un produs cu aceeași denumire.'); return; }
    setSavingProduct(true);
    try {
      const existing = editingId ? products.find((product) => product.id === editingId) : undefined;
      await setDoc(doc(db, 'products', id), { name, category: draft.category, priceLei, baseGrams, stepGrams, active: draft.active, isNew: draft.isNew, promo: draft.promo, sortOrder: existing?.sortOrder ?? products.length, updatedAt: serverTimestamp(), ...(editingId ? {} : { createdAt: serverTimestamp() }) }, { merge: true });
      setNotice(editingId ? 'Produsul a fost actualizat. Modificarea apare automat pe site.' : 'Produsul nou a fost adăugat și apare automat pe site.');
      cancelEdit();
    } catch { setError('Produsul nu a putut fi salvat. Verifică regulile Firestore.'); }
    finally { setSavingProduct(false); }
  };

  const toggleProduct = async (product: ManagedProduct) => {
    try { await updateDoc(doc(db, 'products', product.id), { active: product.active === false, updatedAt: serverTimestamp() }); }
    catch { setError('Nu am putut schimba disponibilitatea produsului.'); }
  };

  const removeProduct = async (product: ManagedProduct) => {
    if (!window.confirm(`Ștergi produsul „${product.name}”? Comenzile vechi rămân neschimbate.`)) return;
    try { await deleteDoc(doc(db, 'products', product.id)); setNotice('Produsul a fost șters din catalog.'); if (editingId === product.id) cancelEdit(); }
    catch { setError('Produsul nu a putut fi șters.'); }
  };

  if (checking) return <main className="grid min-h-screen place-items-center bg-[#f2f5ed] text-[#607269]">Se verifică accesul…</main>;

  if (!authorized) return <main className="grid min-h-screen place-items-center bg-[#f2f5ed] p-5 text-[#173d2c]">
    <section className="w-full max-w-md rounded-[28px] border border-[#d9e3d7] bg-white p-7 shadow-[0_24px_70px_rgba(23,61,44,.12)] sm:p-9">
      <Link to="/" className="mb-10 flex items-center gap-2 text-sm font-medium text-[#607269]"><ArrowLeft className="size-4" /> Înapoi la catalog</Link>
      <span className="mb-5 grid size-13 place-items-center rounded-2xl bg-[#e8f0e2]"><LockKeyhole /></span>
      <h1 className="font-serif text-3xl font-semibold">Panoul managerului</h1>
      <p className="mt-2 text-sm leading-6 text-[#74837b]">Intră cu contul de administrator configurat în Firebase.</p>
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
    <header className="border-b border-[#d9e3d7] bg-white"><div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:px-8"><div className="flex items-center gap-4"><Link to="/" aria-label="Înapoi la catalog" className="grid size-10 place-items-center rounded-full border border-[#d6e0d5]"><ArrowLeft className="size-4" /></Link><div><h1 className="font-serif text-2xl font-semibold">Panoul managerului</h1><p className="text-xs text-[#74837b]">Produse și comenzi sincronizate cu Firebase</p></div></div><div className="flex gap-2"><Button className="bg-[#173d2c]" onClick={exportCsv}><Download /> Descarcă CSV</Button><Button variant="outline" size="icon" aria-label="Ieși din cont" onClick={() => signOut(auth)}><LogOut /></Button></div></div></header>
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-8">
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-xl bg-[#e8f3df] p-3 text-sm text-[#315b32]">{notice}</p>}

      <section className="rounded-[24px] border border-[#e4d4b8] bg-[#fffaf0] p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f5dfbb] text-[#8b581c]"><CalendarDays /></span><div><h2 className="font-serif text-2xl font-semibold">Următoarea comandă</h2><p className="mt-1 text-sm text-[#7d674d]">Setează data sau datele pe care colegii trebuie să le vadă înainte să trimită comanda.</p></div></div>
        <div className="flex flex-col gap-3 sm:flex-row"><Input type="date" value={newOrderDate} onChange={(event) => setNewOrderDate(event.target.value)} className="h-11 max-w-xs bg-white" /><Button onClick={addOrderDate} disabled={!newOrderDate || savingSchedule} className="h-11 bg-[#173d2c]"><Plus /> Adaugă data</Button></div>
        {schedule.dates.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{schedule.dates.map((date) => <div key={date} className="flex items-center gap-2 rounded-full border border-[#e4d4b8] bg-white py-1.5 pl-3 pr-1.5 text-sm font-semibold text-[#62492b]"><span>{formatOrderDate(date)}</span><button type="button" onClick={() => removeOrderDate(date)} disabled={savingSchedule} className="grid size-7 place-items-center rounded-full text-red-600 hover:bg-red-50" aria-label={`Șterge ${formatOrderDate(date)}`}><X className="size-3.5" /></button></div>)}</div> : <p className="mt-4 text-sm text-[#8a765d]">Nu ai setat încă o dată pentru următoarea comandă.</p>}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row"><Input value={scheduleMessage} onChange={(event) => setScheduleMessage(event.target.value)} placeholder="Mesaj opțional, ex: Trimite comanda până pe 18 septembrie" className="h-11 bg-white" /><Button variant="outline" onClick={saveScheduleMessage} disabled={savingSchedule} className="h-11 shrink-0"><Save /> Salvează mesajul</Button></div>
      </section>

      <section className="rounded-[22px] border border-[#d9e3d7] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Perioada comenzilor</p><p className="mt-1 text-xs text-[#74837b]">Fiecare lună este păstrată separat în istoric.</p></div><select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="h-11 min-w-56 rounded-xl border border-[#d6e0d5] bg-white px-3 text-sm font-semibold outline-none">{monthOptions.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}</select></div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3"><Stat icon={<Users />} label={`Comenzi · ${monthLabel(selectedMonth)}`} value={String(visibleOrders.length)} /><Stat icon={<WalletCards />} label="Total de încasat" value={`${lei(totals.totalBani)} lei`} /><Stat icon={<PackageCheck />} label="Încasat" value={`${lei(totals.paidBani)} lei`} /></section>

      <section className="rounded-[24px] border border-[#d9e3d7] bg-white p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-serif text-2xl font-semibold">Produse</h2><p className="mt-1 text-sm text-[#74837b]">Orice modificare salvată aici apare automat în catalogul public, fără redeploy.</p></div>{productsReady && products.length === 0 && <Button onClick={seedProducts} disabled={savingProduct} className="bg-[#173d2c]">{savingProduct ? 'Se încarcă…' : 'Încarcă catalogul actual în Firebase'}</Button>}</div>
        {products.length > 0 && <div className="mb-6 overflow-x-auto rounded-2xl border border-[#e1e8df]"><Table><TableHeader><TableRow><TableHead>Produs</TableHead><TableHead>Categorie</TableHead><TableHead>Preț</TableHead><TableHead>Pas</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Acțiuni</TableHead></TableRow></TableHeader><TableBody>{products.map((product) => <TableRow key={product.id}><TableCell className="min-w-52"><strong>{product.name}</strong><div className="mt-1 flex gap-1.5">{product.isNew && <span className="rounded-full bg-[#e3f2d7] px-2 py-0.5 text-[11px] font-semibold text-[#315b32]">Nou</span>}{product.promo && <span className="rounded-full bg-[#fff0d9] px-2 py-0.5 text-[11px] font-semibold text-[#a65d13]">Promo</span>}</div></TableCell><TableCell>{product.category}</TableCell><TableCell className="whitespace-nowrap font-semibold">{product.priceLei} lei/{product.baseGrams === 1000 ? 'kg' : `${product.baseGrams} g`}</TableCell><TableCell>{product.stepGrams} g</TableCell><TableCell>{product.active === false ? <span className="text-[#a65d13]">Ascuns</span> : <span className="text-[#315b32]">Activ</span>}</TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={product.active === false ? 'Arată produsul' : 'Ascunde produsul'} onClick={() => toggleProduct(product)}>{product.active === false ? <Eye /> : <EyeOff />}</Button><Button variant="ghost" size="icon" aria-label="Editează produsul" onClick={() => startEdit(product)}><Pencil /></Button><Button variant="ghost" size="icon" aria-label="Șterge produsul" onClick={() => removeProduct(product)}><Trash2 /></Button></div></TableCell></TableRow>)}</TableBody></Table></div>}
        <form onSubmit={saveProduct} className="rounded-2xl bg-[#f5f8f1] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold">{editingId ? 'Editează produsul' : 'Adaugă produs nou'}</h3><p className="mt-1 text-xs text-[#74837b]">Prețul este raportat la cantitatea de bază.</p></div>{editingId && <Button type="button" variant="ghost" size="icon" onClick={cancelEdit}><X /></Button>}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Denumire produs" className="lg:col-span-2" /><select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as Category }))} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none">{categories.map((category) => <option key={category}>{category}</option>)}</select><Input type="number" min="0.01" step="0.01" value={draft.priceLei} onChange={(event) => setDraft((current) => ({ ...current, priceLei: event.target.value }))} placeholder="Preț lei" /><Input type="number" min="1" step="1" value={draft.baseGrams} onChange={(event) => setDraft((current) => ({ ...current, baseGrams: event.target.value }))} placeholder="Bază g" /><Input type="number" min="1" step="1" value={draft.stepGrams} onChange={(event) => setDraft((current) => ({ ...current, stepGrams: event.target.value }))} placeholder="Pas g" /></div>
          <div className="mt-4 flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} /> Activ pe site</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isNew} onChange={(event) => setDraft((current) => ({ ...current, isNew: event.target.checked }))} /> Marcaj „Nou”</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.promo} onChange={(event) => setDraft((current) => ({ ...current, promo: event.target.checked }))} /> Marcaj „Promo”</label><Button type="submit" disabled={savingProduct || !draft.name.trim() || !draft.priceLei} className="ml-auto bg-[#173d2c]">{editingId ? <Save /> : <Plus />} {savingProduct ? 'Se salvează…' : editingId ? 'Salvează modificările' : 'Adaugă produs'}</Button></div>
        </form>
      </section>

      <section className="rounded-[24px] border border-[#d9e3d7] bg-white p-5 sm:p-6"><div className="mb-5"><h2 className="font-serif text-2xl font-semibold">Lista pentru vânzător</h2><p className="mt-1 text-sm text-[#74837b]">Cantitățile cumulate pentru {monthLabel(selectedMonth)}</p></div>{totals.byProduct.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{totals.byProduct.map((product) => <div key={product.name} className="flex items-center justify-between rounded-xl bg-[#f2f6ee] px-4 py-3"><span className="font-medium">{product.name}</span><strong>{product.grams >= 1000 ? `${product.grams / 1000} kg` : `${product.grams} g`}</strong></div>)}</div> : <p className="py-8 text-center text-[#74837b]">Nu există produse comandate în această lună.</p>}</section>

      <section className="overflow-hidden rounded-[24px] border border-[#d9e3d7] bg-white"><div className="border-b border-[#e1e8df] p-5 sm:p-6"><h2 className="font-serif text-2xl font-semibold">Comenzi individuale · {monthLabel(selectedMonth)}</h2><p className="mt-1 text-sm text-[#74837b]">Poți șterge o comandă dacă persoana se răzgândește.</p></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nume</TableHead><TableHead>Produse</TableHead><TableHead>Total</TableHead><TableHead>Notă</TableHead><TableHead>Plată</TableHead><TableHead className="text-right">Acțiuni</TableHead></TableRow></TableHeader><TableBody>{visibleOrders.map((order) => <TableRow key={order.id}><TableCell className="min-w-44"><strong>{order.customerName}</strong><span className="mt-1 block text-xs text-[#829087]">{order.orderCode} · {orderDate(order).toLocaleDateString('ro-MD')}</span></TableCell><TableCell className="min-w-72">{order.items.map((item) => <span key={item.productId} className="mr-1.5 mb-1.5 inline-flex rounded-full bg-[#eef3e8] px-2.5 py-1 text-xs">{item.productName} · {item.grams} g</span>)}</TableCell><TableCell className="whitespace-nowrap font-semibold">{lei(order.totalBani)} lei</TableCell><TableCell className="max-w-56 text-[#74837b]">{order.note || '—'}</TableCell><TableCell><Button size="sm" variant={order.paid ? 'secondary' : 'outline'} className={order.paid ? 'bg-[#dff0d2] text-[#315b32]' : ''} onClick={() => togglePaid(order)}>{order.paid && <Check />} {order.paid ? 'Achitat' : 'Neachitat'}</Button></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" aria-label={`Șterge comanda lui ${order.customerName}`} onClick={() => removeOrder(order)} className="text-red-600 hover:text-red-700"><Trash2 /></Button></TableCell></TableRow>)}{visibleOrders.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-[#74837b]">Nu există comenzi pentru această lună.</TableCell></TableRow>}</TableBody></Table></div></section>
    </div>
  </main>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-[22px] border border-[#d9e3d7] bg-white p-5"><span className="mb-5 grid size-10 place-items-center rounded-xl bg-[#eef3e8] text-[#4d724a]">{icon}</span><p className="text-sm text-[#74837b]">{label}</p><strong className="mt-1 block font-serif text-3xl">{value}</strong></div>;
}
