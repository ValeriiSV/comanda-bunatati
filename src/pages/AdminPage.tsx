import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Download, Eye, EyeOff, LogOut, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { categories, type Category } from '@/lib/products';
import { adminLogin, clearAdminSession, deleteDocument, getAdminSession, getDocument, listCollection, setDocument, updateDocument } from '@/lib/firebaseRest';

type OrderItem = { productId?: string; productName?: string; category?: string; grams?: number; lineTotalBani?: number };
type Order = { id: string; orderCode?: string; customerName?: string; phone?: string; totalBani?: number; paid?: boolean; createdAt?: Date | string | null; items?: OrderItem[] };
type Product = { id: string; name: string; category: Category; priceLei: number; baseGrams: number; stepGrams: number; active?: boolean; isNew?: boolean; promo?: boolean; sortOrder?: number };
type ProductDraft = { name: string; category: Category; priceLei: string; baseGrams: string; stepGrams: string; active: boolean; isNew: boolean; promo: boolean };

const emptyDraft: ProductDraft = { name: '', category: 'Nuci', priceLei: '', baseGrams: '1000', stepGrams: '250', active: true, isNew: false, promo: false };

function lei(bani = 0) { return new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 2 }).format(bani / 100); }
function slugify(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function orderDate(order: Order) { const d = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt || Date.now()); return Number.isNaN(d.getTime()) ? new Date() : d; }
function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }
function monthLabel(key: string) { const [y, m] = key.split('-').map(Number); return new Intl.DateTimeFormat('ro-MD', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1)); }
function formatOrderDate(value: string) { const [y, m, d] = value.split('-').map(Number); return new Intl.DateTimeFormat('ro-MD', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d)); }

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [dates, setDates] = useState<string[]>([]);
  const [scheduleMessage, setScheduleMessage] = useState('');
  const [newDate, setNewDate] = useState('');
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAll = async () => {
    setBusy(true); setError('');
    try {
      const [ordersData, productsData, schedule] = await Promise.all([
        listCollection('groupOrders'),
        listCollection('products'),
        getDocument('settings/orderSchedule'),
      ]);
      setOrders((ordersData as Order[]).sort((a, b) => orderDate(b).getTime() - orderDate(a).getTime()));
      setProducts((productsData as Product[]).sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)));
      setDates(Array.isArray(schedule?.dates) ? schedule.dates : []);
      setScheduleMessage(typeof schedule?.message === 'string' ? schedule.message : '');
    } catch (e) {
      setError(`Nu am putut încărca panoul: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  useEffect(() => {
    (async () => {
      const session = await getAdminSession();
      if (session) { setAuthorized(true); await loadAll(); }
      setChecking(false);
    })();
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      await adminLogin(email.trim(), password);
      setAuthorized(true);
      await loadAll();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg === 'NOT_ADMIN' ? 'Acest cont nu are drepturi de administrator.' : `Autentificarea nu a reușit: ${msg}`);
      clearAdminSession();
      setAuthorized(false);
    } finally { setBusy(false); setChecking(false); }
  };

  const logout = () => { clearAdminSession(); setAuthorized(false); setOrders([]); setProducts([]); };

  const monthOptions = useMemo(() => {
    const keys = new Set(orders.map((o) => monthKey(orderDate(o)))); keys.add(monthKey(new Date())); return [...keys].sort().reverse();
  }, [orders]);
  const visibleOrders = useMemo(() => orders.filter((o) => monthKey(orderDate(o)) === selectedMonth), [orders, selectedMonth]);
  const totals = useMemo(() => {
    const totalBani = visibleOrders.reduce((s, o) => s + (Number(o.totalBani) || 0), 0);
    const paidBani = visibleOrders.filter((o) => o.paid).reduce((s, o) => s + (Number(o.totalBani) || 0), 0);
    const byProduct = new Map<string, { name: string; grams: number }>();
    visibleOrders.forEach((o) => (o.items || []).forEach((i) => {
      const id = i.productId || i.productName || 'produs'; const cur = byProduct.get(id) || { name: i.productName || 'Produs', grams: 0 }; cur.grams += Number(i.grams) || 0; byProduct.set(id, cur);
    }));
    return { totalBani, paidBani, byProduct: [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name, 'ro')) };
  }, [visibleOrders]);

  const togglePaid = async (order: Order) => {
    try { await updateDocument(`groupOrders/${order.id}`, { paid: !order.paid, updatedAt: new Date() }); await loadAll(); }
    catch (e) { setError((e as Error).message); }
  };

  const removeOrder = async (order: Order) => {
    if (!window.confirm(`Ștergi comanda lui ${order.customerName || 'acest coleg'}?`)) return;
    try { await deleteDocument(`groupOrders/${order.id}`); setNotice('Comanda a fost ștearsă.'); await loadAll(); }
    catch (e) { setError((e as Error).message); }
  };

  const saveSchedule = async (nextDates = dates, nextMessage = scheduleMessage) => {
    try { await setDocument('settings/orderSchedule', { dates: [...new Set(nextDates)].sort(), message: nextMessage.trim(), updatedAt: new Date() }); setDates([...new Set(nextDates)].sort()); setScheduleMessage(nextMessage); setNotice('Următoarea comandă a fost actualizată.'); }
    catch (e) { setError((e as Error).message); }
  };

  const startEdit = (p: Product) => { setEditingId(p.id); setDraft({ name: p.name, category: p.category, priceLei: String(p.priceLei), baseGrams: String(p.baseGrams), stepGrams: String(p.stepGrams), active: p.active !== false, isNew: !!p.isNew, promo: !!p.promo }); };
  const cancelEdit = () => { setEditingId(null); setDraft(emptyDraft); };
  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = draft.name.trim(); const priceLei = Number(draft.priceLei); const baseGrams = Number(draft.baseGrams); const stepGrams = Number(draft.stepGrams);
    if (!name || priceLei <= 0 || baseGrams <= 0 || stepGrams <= 0) { setError('Completează corect produsul.'); return; }
    const id = editingId || slugify(name) || `produs-${Date.now()}`;
    try { await setDocument(`products/${id}`, { name, category: draft.category, priceLei, baseGrams, stepGrams, active: draft.active, isNew: draft.isNew, promo: draft.promo, sortOrder: editingId ? (products.find((p) => p.id === editingId)?.sortOrder ?? products.length) : products.length, updatedAt: new Date(), ...(editingId ? {} : { createdAt: new Date() }) }); cancelEdit(); await loadAll(); }
    catch (e) { setError((e as Error).message); }
  };
  const toggleProduct = async (p: Product) => { try { await updateDocument(`products/${p.id}`, { active: p.active === false, updatedAt: new Date() }); await loadAll(); } catch (e) { setError((e as Error).message); } };
  const removeProduct = async (p: Product) => { if (!window.confirm(`Ștergi produsul „${p.name}”?`)) return; try { await deleteDocument(`products/${p.id}`); await loadAll(); } catch (e) { setError((e as Error).message); } };

  const exportCsv = () => {
    const rows = [['Cod','Data','Nume','Telefon','Achitat','Produs','Categorie','Cantitate (g)','Produs (lei)','Total persoană (lei)']];
    visibleOrders.forEach((o) => (o.items || []).forEach((i) => rows.push([o.orderCode || '', orderDate(o).toLocaleString('ro-MD'), o.customerName || '', o.phone || '', o.paid ? 'Da' : 'Nu', i.productName || '', i.category || '', String(i.grams || 0), lei(i.lineTotalBani || 0), lei(o.totalBani || 0)])));
    const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replaceAll('"','""')}"`).join(';')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `comenzi-bunatati-${selectedMonth}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  if (checking) return <main className="grid min-h-screen place-items-center bg-[#f2f5ed]"><div className="text-center"><img src="/valera-logo.svg?v=6" className="mx-auto mb-4 size-20 rounded-full" /><p>Se inițializează panoul…</p></div></main>;

  if (!authorized) return <main className="grid min-h-screen place-items-center bg-[#f2f5ed] p-5 text-[#173d2c]"><section className="w-full max-w-md rounded-[28px] border border-[#d9e3d7] bg-white p-8 shadow-xl"><Link to="/" className="mb-7 flex items-center gap-2 text-sm text-[#607269]"><ArrowLeft className="size-4" /> Înapoi la catalog</Link><img src="/valera-logo.svg?v=6" className="mb-5 size-20 rounded-full border" /><h1 className="font-serif text-3xl font-semibold">Panoul managerului</h1><p className="mt-2 text-sm text-[#74837b]">Bunătăți împreună cu Valera</p><form onSubmit={login} className="mt-7 space-y-3"><Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="h-12 rounded-xl" /><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Parolă" className="h-12 rounded-xl" /><Button disabled={busy || !email || !password} className="h-12 w-full rounded-xl bg-[#173d2c]">{busy ? 'Se autentifică…' : 'Intră în panou'}</Button></form>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}</section></main>;

  return <main className="min-h-screen bg-[#f2f5ed] text-[#173d2c]"><header className="border-b bg-white"><div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:px-8"><div className="flex items-center gap-3"><Link to="/"><img src="/valera-logo.svg?v=6" className="size-12 rounded-full border" /></Link><div><h1 className="font-serif text-2xl font-semibold">Panoul managerului</h1><p className="text-xs text-[#74837b]">Bunătăți împreună cu Valera</p></div></div><div className="flex gap-2"><Button variant="outline" onClick={loadAll} disabled={busy}><RefreshCw /> Reîncarcă</Button><Button onClick={exportCsv} className="bg-[#173d2c]"><Download /> CSV</Button><Button variant="outline" size="icon" onClick={logout}><LogOut /></Button></div></div></header><div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-8">{error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice && <p className="rounded-xl bg-[#e8f3df] p-3 text-sm text-[#315b32]">{notice}</p>}

  <section className="rounded-[24px] border border-[#e4d4b8] bg-[#fffaf0] p-5"><h2 className="font-serif text-2xl font-semibold">Următoarea comandă</h2><div className="mt-4 flex flex-col gap-3 sm:flex-row"><Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="max-w-xs bg-white" /><Button onClick={() => { if (newDate) { saveSchedule([...dates, newDate]); setNewDate(''); } }} className="bg-[#173d2c]"><Plus /> Adaugă data</Button></div>{dates.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{dates.map((d) => <div key={d} className="flex items-center gap-2 rounded-full border bg-white py-1.5 pl-3 pr-1.5 text-sm"><span>{formatOrderDate(d)}</span><button onClick={() => saveSchedule(dates.filter((x) => x !== d))} className="grid size-7 place-items-center text-red-600"><X className="size-4" /></button></div>)}</div>}<div className="mt-4 flex gap-2"><Input value={scheduleMessage} onChange={(e) => setScheduleMessage(e.target.value)} placeholder="Mesaj opțional" className="bg-white" /><Button variant="outline" onClick={() => saveSchedule(dates, scheduleMessage)}><Save /> Salvează</Button></div></section>

  <section className="rounded-[22px] border bg-white p-4"><div className="flex items-center justify-between"><div><p className="font-semibold">Perioada comenzilor</p><p className="text-xs text-[#74837b]">Istoric separat pe luni</p></div><select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="h-11 rounded-xl border px-3">{monthOptions.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}</select></div></section>

  <section className="grid gap-3 sm:grid-cols-3"><Stat label="Comenzi" value={String(visibleOrders.length)} /><Stat label="Total de încasat" value={`${lei(totals.totalBani)} lei`} /><Stat label="Încasat" value={`${lei(totals.paidBani)} lei`} /></section>

  <section className="rounded-[24px] border bg-white p-5"><h2 className="font-serif text-2xl font-semibold">Produse</h2>{products.length > 0 && <div className="mt-4 overflow-x-auto rounded-2xl border"><Table><TableHeader><TableRow><TableHead>Produs</TableHead><TableHead>Categorie</TableHead><TableHead>Preț</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Acțiuni</TableHead></TableRow></TableHeader><TableBody>{products.map((p) => <TableRow key={p.id}><TableCell><strong>{p.name}</strong></TableCell><TableCell>{p.category}</TableCell><TableCell>{p.priceLei} lei/{p.baseGrams === 1000 ? 'kg' : `${p.baseGrams} g`}</TableCell><TableCell>{p.active === false ? 'Ascuns' : 'Activ'}</TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => toggleProduct(p)}>{p.active === false ? <Eye /> : <EyeOff />}</Button><Button variant="ghost" size="icon" onClick={() => startEdit(p)}><Pencil /></Button><Button variant="ghost" size="icon" onClick={() => removeProduct(p)}><Trash2 /></Button></div></TableCell></TableRow>)}</TableBody></Table></div>}<form onSubmit={saveProduct} className="mt-5 rounded-2xl bg-[#f5f8f1] p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Input value={draft.name} onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))} placeholder="Denumire" className="lg:col-span-2" /><select value={draft.category} onChange={(e) => setDraft((c) => ({ ...c, category: e.target.value as Category }))} className="h-9 rounded-md border px-3">{categories.map((c) => <option key={c}>{c}</option>)}</select><Input type="number" value={draft.priceLei} onChange={(e) => setDraft((c) => ({ ...c, priceLei: e.target.value }))} placeholder="Preț" /><Input type="number" value={draft.baseGrams} onChange={(e) => setDraft((c) => ({ ...c, baseGrams: e.target.value }))} placeholder="Bază g" /><Input type="number" value={draft.stepGrams} onChange={(e) => setDraft((c) => ({ ...c, stepGrams: e.target.value }))} placeholder="Pas g" /></div><div className="mt-4 flex flex-wrap gap-4"><label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft((c) => ({ ...c, active: e.target.checked }))} /> Activ</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.isNew} onChange={(e) => setDraft((c) => ({ ...c, isNew: e.target.checked }))} /> Nou</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.promo} onChange={(e) => setDraft((c) => ({ ...c, promo: e.target.checked }))} /> Promo</label><Button type="submit" className="ml-auto bg-[#173d2c]">{editingId ? <Save /> : <Plus />} Salvează</Button>{editingId && <Button type="button" variant="outline" onClick={cancelEdit}>Renunță</Button>}</div></form></section>

  <section className="rounded-[24px] border bg-white p-5"><h2 className="font-serif text-2xl font-semibold">Lista pentru vânzător</h2><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{totals.byProduct.map((p) => <div key={p.name} className="flex justify-between rounded-xl bg-[#f2f6ee] px-4 py-3"><span>{p.name}</span><strong>{p.grams >= 1000 ? `${p.grams / 1000} kg` : `${p.grams} g`}</strong></div>)}</div></section>

  <section className="overflow-hidden rounded-[24px] border bg-white"><div className="border-b p-5"><h2 className="font-serif text-2xl font-semibold">Comenzi individuale · {monthLabel(selectedMonth)}</h2></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nume</TableHead><TableHead>Telefon</TableHead><TableHead>Produse</TableHead><TableHead>Total</TableHead><TableHead>Plată</TableHead><TableHead className="text-right">Acțiuni</TableHead></TableRow></TableHeader><TableBody>{visibleOrders.map((o) => <TableRow key={o.id}><TableCell><strong>{o.customerName || 'Fără nume'}</strong><span className="block text-xs text-[#829087]">{o.orderCode || '—'} · {orderDate(o).toLocaleDateString('ro-MD')}</span></TableCell><TableCell>{o.phone || '—'}</TableCell><TableCell className="min-w-72">{(o.items || []).map((i, idx) => <span key={`${i.productId}-${idx}`} className="mr-1.5 mb-1.5 inline-flex rounded-full bg-[#eef3e8] px-2.5 py-1 text-xs">{i.productName} · {i.grams} g</span>)}</TableCell><TableCell className="font-semibold">{lei(o.totalBani || 0)} lei</TableCell><TableCell><Button size="sm" variant={o.paid ? 'secondary' : 'outline'} onClick={() => togglePaid(o)}>{o.paid && <Check />} {o.paid ? 'Achitat' : 'Neachitat'}</Button></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => removeOrder(o)} className="text-red-600"><Trash2 /></Button></TableCell></TableRow>)}{visibleOrders.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-[#74837b]">Nu există comenzi în această lună.</TableCell></TableRow>}</TableBody></Table></div></section>
  </div></main>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-[22px] border bg-white p-5"><p className="text-sm text-[#74837b]">{label}</p><strong className="mt-1 block font-serif text-3xl">{value}</strong></div>; }
