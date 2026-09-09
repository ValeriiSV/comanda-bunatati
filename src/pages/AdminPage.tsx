import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Download, LockKeyhole, LogOut, PackageCheck, Users, WalletCards } from 'lucide-react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { auth, db } from '@/lib/firebase';

type OrderItem = { productId: string; productName: string; category: string; grams: number; lineTotalBani: number };
type Order = { id: string; orderCode: string; customerName: string; note: string; totalBani: number; paid: boolean; createdAt: { toDate?: () => Date } | null; items: OrderItem[] };

function lei(bani: number) {
  return new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 2 }).format(bani / 100);
}

function orderDate(order: Order) {
  return order.createdAt?.toDate?.() || new Date();
}

export default function AdminDashboard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let stopOrders = () => {};
    const stopAuth = onAuthStateChanged(auth, async (user) => {
      stopOrders();
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
    });
    return () => { stopAuth(); stopOrders(); };
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
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

  const totals = useMemo(() => {
    const totalBani = orders.reduce((sum, order) => sum + order.totalBani, 0);
    const paidBani = orders.filter((order) => order.paid).reduce((sum, order) => sum + order.totalBani, 0);
    const byProduct = new Map<string, { name: string; grams: number }>();
    orders.forEach((order) => order.items.forEach((item) => {
      const current = byProduct.get(item.productId) || { name: item.productName, grams: 0 };
      current.grams += item.grams;
      byProduct.set(item.productId, current);
    }));
    return { totalBani, paidBani, byProduct: [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name, 'ro')) };
  }, [orders]);

  const togglePaid = async (order: Order) => {
    await updateDoc(doc(db, 'groupOrders', order.id), { paid: !order.paid, updatedAt: serverTimestamp() });
  };

  const exportCsv = () => {
    const rows = [['Cod', 'Data', 'Nume', 'Achitat', 'Produs', 'Categorie', 'Cantitate (g)', 'Produs (lei)', 'Total persoană (lei)', 'Notă']];
    orders.forEach((order) => order.items.forEach((item) => rows.push([
      order.orderCode,
      orderDate(order).toLocaleString('ro-MD'),
      order.customerName,
      order.paid ? 'Da' : 'Nu',
      item.productName,
      item.category,
      String(item.grams),
      lei(item.lineTotalBani),
      lei(order.totalBani),
      order.note,
    ])));
    const csv = '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `comenzi-bunatati-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (checking) return <main className="grid min-h-screen place-items-center bg-[#f2f5ed] text-[#607269]">Se verifică accesul…</main>;

  if (!authorized) return <main className="grid min-h-screen place-items-center bg-[#f2f5ed] p-5 text-[#173d2c]">
    <section className="w-full max-w-md rounded-[28px] border border-[#d9e3d7] bg-white p-7 shadow-[0_24px_70px_rgba(23,61,44,.12)] sm:p-9">
      <Link to="/" className="mb-10 flex items-center gap-2 text-sm font-medium text-[#607269]"><ArrowLeft className="size-4" /> Înapoi la catalog</Link>
      <span className="mb-5 grid size-13 place-items-center rounded-2xl bg-[#e8f0e2]"><LockKeyhole /></span>
      <h1 className="font-serif text-3xl font-semibold">Panoul managerului</h1>
      <p className="mt-2 text-sm leading-6 text-[#74837b]">Intră cu același cont de administrator folosit pentru site-ul Victoria Ghecrea.</p>
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
    <header className="border-b border-[#d9e3d7] bg-white"><div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:px-8"><div className="flex items-center gap-4"><Link to="/" aria-label="Înapoi la catalog" className="grid size-10 place-items-center rounded-full border border-[#d6e0d5]"><ArrowLeft className="size-4" /></Link><div><h1 className="font-serif text-2xl font-semibold">Panoul managerului</h1><p className="text-xs text-[#74837b]">Actualizare automată din Firebase</p></div></div><div className="flex gap-2"><Button className="bg-[#173d2c]" onClick={exportCsv}><Download /> Descarcă CSV</Button><Button variant="outline" size="icon" aria-label="Ieși din cont" onClick={() => signOut(auth)}><LogOut /></Button></div></div></header>
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-8">
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <section className="grid gap-3 sm:grid-cols-3"><Stat icon={<Users />} label="Comenzi" value={String(orders.length)} /><Stat icon={<WalletCards />} label="Total de încasat" value={`${lei(totals.totalBani)} lei`} /><Stat icon={<PackageCheck />} label="Încasat" value={`${lei(totals.paidBani)} lei`} /></section>
      <section className="rounded-[24px] border border-[#d9e3d7] bg-white p-5 sm:p-6"><div className="mb-5"><h2 className="font-serif text-2xl font-semibold">Lista pentru vânzător</h2><p className="mt-1 text-sm text-[#74837b]">Cantitățile cumulate din toate comenzile</p></div>{totals.byProduct.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{totals.byProduct.map((product) => <div key={product.name} className="flex items-center justify-between rounded-xl bg-[#f2f6ee] px-4 py-3"><span className="font-medium">{product.name}</span><strong>{product.grams >= 1000 ? `${product.grams / 1000} kg` : `${product.grams} g`}</strong></div>)}</div> : <p className="py-8 text-center text-[#74837b]">Încă nu există produse comandate.</p>}</section>
      <section className="overflow-hidden rounded-[24px] border border-[#d9e3d7] bg-white"><div className="border-b border-[#e1e8df] p-5 sm:p-6"><h2 className="font-serif text-2xl font-semibold">Comenzi individuale</h2></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nume</TableHead><TableHead>Produse</TableHead><TableHead>Total</TableHead><TableHead>Notă</TableHead><TableHead>Plată</TableHead></TableRow></TableHeader><TableBody>{orders.map((order) => <TableRow key={order.id}><TableCell className="min-w-44"><strong>{order.customerName}</strong><span className="mt-1 block text-xs text-[#829087]">{order.orderCode}</span></TableCell><TableCell className="min-w-72">{order.items.map((item) => <span key={item.productId} className="mr-1.5 mb-1.5 inline-flex rounded-full bg-[#eef3e8] px-2.5 py-1 text-xs">{item.productName} · {item.grams} g</span>)}</TableCell><TableCell className="whitespace-nowrap font-semibold">{lei(order.totalBani)} lei</TableCell><TableCell className="max-w-56 text-[#74837b]">{order.note || '—'}</TableCell><TableCell><Button size="sm" variant={order.paid ? 'secondary' : 'outline'} className={order.paid ? 'bg-[#dff0d2] text-[#315b32]' : ''} onClick={() => togglePaid(order)}>{order.paid && <Check />} {order.paid ? 'Achitat' : 'Neachitat'}</Button></TableCell></TableRow>)}</TableBody></Table></div></section>
    </div>
  </main>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-[22px] border border-[#d9e3d7] bg-white p-5"><span className="mb-5 grid size-10 place-items-center rounded-xl bg-[#eef3e8] text-[#4d724a]">{icon}</span><p className="text-sm text-[#74837b]">{label}</p><strong className="mt-1 block font-serif text-3xl">{value}</strong></div>;
}
