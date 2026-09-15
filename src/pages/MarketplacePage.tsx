import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile, type User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Heart, LogIn, LogOut, PackageCheck, Plus, Search, ShieldCheck, ShoppingBag, Store, Trash2, UserCircle2, X } from 'lucide-react';
import { auth, db, storage } from '@/lib/firebase';
import './marketplace.css';

type Profile = {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  department?: string;
  role: 'admin' | 'user';
  blocked?: boolean;
};

type Listing = {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  title: string;
  description: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  imageUrl?: string;
  active: boolean;
  createdAt?: unknown;
};

type MarketOrder = {
  id: string;
  listingId: string;
  listingTitle: string;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  note?: string;
  status: 'noua' | 'acceptata' | 'pregatita' | 'predata' | 'respinsa';
  createdAt?: unknown;
};

const ADMIN_EMAIL = 'valerkasvetlicenco@icloud.com';
const categories = ['Toate', 'Ouă', 'Miere', 'Nuci', 'Fructe uscate', 'Legume & fructe', 'Conserve', 'Patiserie', 'Lactate', 'Altele'];
const units = ['buc', 'kg', 'g', 'litru', 'borcan', 'pachet', 'cofraj'];
const emptyListing = { title: '', description: '', category: 'Altele', price: '', unit: 'buc', stock: '', image: null as File | null };

const lei = (value: number) => new Intl.NumberFormat('ro-MD', { style: 'currency', currency: 'MDL', maximumFractionDigits: 2 }).format(value || 0);

async function ensureProfile(user: User, preferredName = '') {
  const profileRef = doc(db, 'marketUsers', user.uid);
  const snapshot = await getDoc(profileRef);
  if (!snapshot.exists()) {
    const role: Profile['role'] = user.email?.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user';
    await setDoc(profileRef, {
      uid: user.uid,
      email: user.email || '',
      displayName: preferredName || user.displayName || user.email?.split('@')[0] || 'Colegul meu',
      role,
      blocked: false,
      createdAt: serverTimestamp(),
    });
  }
}

export default function MarketplacePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authOpen, setAuthOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [orderListing, setOrderListing] = useState<Listing | null>(null);
  const [listingForm, setListingForm] = useState(emptyListing);
  const [orderForm, setOrderForm] = useState({ quantity: '1', note: '' });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Toate');
  const [tab, setTab] = useState<'market' | 'my-listings' | 'orders' | 'admin'>('market');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setUser(nextUser);
    if (!nextUser) { setProfile(null); setOrders([]); return; }
    try {
      await ensureProfile(nextUser);
      const profileSnap = await getDoc(doc(db, 'marketUsers', nextUser.uid));
      setProfile(profileSnap.exists() ? profileSnap.data() as Profile : null);
    } catch (error) {
      setMessage(`Profilul nu poate fi încărcat: ${(error as Error).message}`);
    }
  }), []);

  useEffect(() => {
    const q = query(collection(db, 'marketListings'), where('active', '==', true));
    return onSnapshot(q, (snapshot) => {
      setListings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Listing)));
    }, (error) => setMessage(`Anunțurile nu pot fi încărcate: ${error.message}`));
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'marketOrders'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as MarketOrder));
      setOrders(profile?.role === 'admin' ? all : all.filter((o) => o.buyerId === user.uid || o.sellerId === user.uid));
    }, () => undefined);
  }, [user, profile?.role]);

  const visibleListings = useMemo(() => listings.filter((item) => {
    const text = `${item.title} ${item.description} ${item.sellerName}`.toLowerCase();
    return (category === 'Toate' || item.category === category) && text.includes(search.trim().toLowerCase());
  }), [listings, category, search]);

  const myListings = user ? listings.filter((item) => item.sellerId === user.uid) : [];
  const myOrders = user ? orders.filter((item) => item.buyerId === user.uid) : [];
  const incomingOrders = user ? orders.filter((item) => item.sellerId === user.uid) : [];

  const authenticate = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (authMode === 'register') {
        const credentials = await createUserWithEmailAndPassword(auth, authForm.email.trim(), authForm.password);
        if (authForm.name.trim()) await updateProfile(credentials.user, { displayName: authForm.name.trim() });
        await ensureProfile(credentials.user, authForm.name.trim());
        setMessage('Cont creat. Acum poți publica și comanda produse.');
      } else {
        await signInWithEmailAndPassword(auth, authForm.email.trim(), authForm.password);
      }
      setAuthOpen(false);
      setAuthForm({ name: '', email: '', password: '' });
    } catch (error) {
      setMessage((error as Error).message.replace('Firebase: ', ''));
    } finally { setBusy(false); }
  };

  const publishListing = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !profile) { setAuthOpen(true); return; }
    setBusy(true); setMessage('');
    try {
      let imageUrl = '';
      if (listingForm.image) {
        const imageRef = ref(storage, `marketplace/${user.uid}/${Date.now()}-${listingForm.image.name}`);
        await uploadBytes(imageRef, listingForm.image);
        imageUrl = await getDownloadURL(imageRef);
      }
      await addDoc(collection(db, 'marketListings'), {
        sellerId: user.uid,
        sellerName: profile.displayName,
        sellerEmail: profile.email,
        title: listingForm.title.trim(),
        description: listingForm.description.trim(),
        category: listingForm.category,
        price: Number(listingForm.price),
        unit: listingForm.unit,
        stock: Number(listingForm.stock),
        imageUrl,
        active: true,
        createdAt: serverTimestamp(),
      });
      setListingForm(emptyListing); setSellOpen(false); setTab('my-listings'); setMessage('Anunțul a fost publicat.');
    } catch (error) {
      setMessage(`Nu am putut publica anunțul: ${(error as Error).message}`);
    } finally { setBusy(false); }
  };

  const placeOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !profile || !orderListing) { setAuthOpen(true); return; }
    const quantity = Number(orderForm.quantity);
    if (!quantity || quantity <= 0 || quantity > orderListing.stock) { setMessage('Alege o cantitate validă.'); return; }
    setBusy(true);
    try {
      const total = quantity * orderListing.price;
      await addDoc(collection(db, 'marketOrders'), {
        listingId: orderListing.id,
        listingTitle: orderListing.title,
        sellerId: orderListing.sellerId,
        sellerName: orderListing.sellerName,
        buyerId: user.uid,
        buyerName: profile.displayName,
        buyerEmail: profile.email,
        quantity,
        unit: orderListing.unit,
        unitPrice: orderListing.price,
        total,
        note: orderForm.note.trim(),
        status: 'noua',
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'marketListings', orderListing.id), { stock: Math.max(0, orderListing.stock - quantity) });
      setOrderListing(null); setOrderForm({ quantity: '1', note: '' }); setTab('orders');
      setMessage(`Comanda a fost trimisă automat lui ${orderListing.sellerName}.`);
    } catch (error) {
      setMessage(`Comanda nu a putut fi trimisă: ${(error as Error).message}`);
    } finally { setBusy(false); }
  };

  const changeOrderStatus = async (id: string, status: MarketOrder['status']) => {
    await updateDoc(doc(db, 'marketOrders', id), { status, updatedAt: serverTimestamp() });
  };

  const removeListing = async (id: string) => {
    await updateDoc(doc(db, 'marketListings', id), { active: false, updatedAt: serverTimestamp() });
    setMessage('Anunțul a fost retras.');
  };

  const deleteOrderAsAdmin = async (id: string) => {
    if (profile?.role !== 'admin') return;
    await deleteDoc(doc(db, 'marketOrders', id));
  };

  const requireLogin = (action: () => void) => user ? action() : setAuthOpen(true);

  return <div className="market-shell">
    <header className="market-header">
      <div className="market-brand" onClick={() => setTab('market')}><div className="brand-mark">B</div><div><strong>Bunătăți Market</strong><span>marketplace intern între colegi</span></div></div>
      <nav className="market-nav">
        <button className={tab === 'market' ? 'active' : ''} onClick={() => setTab('market')}><Store size={18}/> Market</button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => requireLogin(() => setTab('orders'))}><ShoppingBag size={18}/> Comenzi</button>
        <button className={tab === 'my-listings' ? 'active' : ''} onClick={() => requireLogin(() => setTab('my-listings'))}><PackageCheck size={18}/> Anunțurile mele</button>
        {profile?.role === 'admin' && <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}><ShieldCheck size={18}/> Admin</button>}
      </nav>
      <div className="market-actions">
        <Link className="legacy-link" to="/comanda">Comanda lunii</Link>
        <button className="sell-button" onClick={() => requireLogin(() => setSellOpen(true))}><Plus size={18}/> Vinde</button>
        {user ? <button className="profile-button" onClick={() => signOut(auth)}><UserCircle2 size={20}/><span>{profile?.displayName || user.email}</span><LogOut size={16}/></button> : <button className="profile-button" onClick={() => setAuthOpen(true)}><LogIn size={18}/> Intră în cont</button>}
      </div>
    </header>

    {message && <div className="market-message" onClick={() => setMessage('')}>{message}<X size={16}/></div>}

    {tab === 'market' && <main className="market-main">
      <section className="market-hero">
        <div><span className="eyebrow">DE LA COLEGI, PENTRU COLEGI</span><h1>Cumperi local. Vinzi simplu.<br/>Totul într-un singur loc.</h1><p>Ouă, miere, nuci, legume, conserve și alte bunătăți aduse direct de colegii tăi.</p><button className="hero-cta" onClick={() => requireLogin(() => setSellOpen(true))}><Plus size={19}/> Postează un anunț</button></div>
        <div className="hero-card"><span>Astăzi în market</span><strong>{listings.length}</strong><small>anunțuri active</small><div className="hero-mini"><span>{orders.filter(o => o.status === 'noua').length} comenzi noi</span><span>{new Set(listings.map(l => l.sellerId)).size} vânzători</span></div></div>
      </section>

      <section className="market-toolbar">
        <label className="search-box"><Search size={19}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Caută miere, ouă, nuci..."/></label>
        <div className="category-row">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
      </section>

      <section className="market-grid">
        {visibleListings.map((item) => <article className="listing-card" key={item.id}>
          <div className="listing-image">{item.imageUrl ? <img src={item.imageUrl} alt={item.title}/> : <div className="image-placeholder">🛍️</div>}<button className="favorite"><Heart size={18}/></button><span className="stock-pill">{item.stock} {item.unit} disponibile</span></div>
          <div className="listing-body"><span className="listing-category">{item.category}</span><h3>{item.title}</h3><p>{item.description}</p><div className="seller-line"><UserCircle2 size={17}/><span>{item.sellerName}</span></div><div className="listing-footer"><div><strong>{lei(item.price)}</strong><span>/ {item.unit}</span></div><button disabled={item.stock <= 0 || item.sellerId === user?.uid} onClick={() => requireLogin(() => { setOrderListing(item); setOrderForm({ quantity: '1', note: '' }); })}>{item.sellerId === user?.uid ? 'Anunțul tău' : item.stock <= 0 ? 'Indisponibil' : 'Comandă'}</button></div></div>
        </article>)}
        {!visibleListings.length && <div className="empty-state"><Store size={42}/><h3>Nu sunt anunțuri pentru filtrul ales.</h3><p>Poți fi primul care publică ceva aici.</p></div>}
      </section>
    </main>}

    {tab === 'my-listings' && <main className="market-main dashboard-page"><div className="section-head"><div><span className="eyebrow">SPAȚIUL TĂU</span><h2>Anunțurile mele</h2></div><button className="sell-button" onClick={() => setSellOpen(true)}><Plus size={18}/> Anunț nou</button></div><div className="dashboard-grid">{myListings.map(item => <div className="dashboard-card" key={item.id}><div><small>{item.category}</small><h3>{item.title}</h3><p>{lei(item.price)} / {item.unit} · stoc {item.stock}</p></div><button className="danger-icon" onClick={() => removeListing(item.id)}><Trash2 size={18}/></button></div>)}{!myListings.length && <div className="empty-state"><PackageCheck size={42}/><h3>Nu ai anunțuri active.</h3></div>}</div></main>}

    {tab === 'orders' && <main className="market-main dashboard-page"><div className="section-head"><div><span className="eyebrow">COMENZI</span><h2>Comenzile mele</h2></div></div><div className="order-columns"><section><h3>Ce am comandat</h3>{myOrders.map(o => <OrderCard key={o.id} order={o}/>)}</section><section><h3>Comenzi primite</h3>{incomingOrders.map(o => <OrderCard key={o.id} order={o} seller onStatus={changeOrderStatus}/>)}</section></div></main>}

    {tab === 'admin' && profile?.role === 'admin' && <main className="market-main dashboard-page"><div className="section-head"><div><span className="eyebrow">ADMINISTRATOR</span><h2>Control marketplace</h2></div></div><div className="admin-stats"><Stat value={listings.length} label="Anunțuri active"/><Stat value={new Set(listings.map(x => x.sellerId)).size} label="Vânzători"/><Stat value={orders.length} label="Comenzi"/><Stat value={orders.filter(o => o.status === 'noua').length} label="Comenzi noi"/></div><div className="dashboard-grid">{listings.map(item => <div className="dashboard-card" key={item.id}><div><small>{item.sellerName} · {item.category}</small><h3>{item.title}</h3><p>{lei(item.price)} · stoc {item.stock}</p></div><button className="danger-icon" onClick={() => removeListing(item.id)}><Trash2 size={18}/></button></div>)}</div><h3 className="admin-orders-title">Toate comenzile</h3>{orders.map(o => <div className="admin-order-row" key={o.id}><span>{o.buyerName} → {o.sellerName}</span><strong>{o.listingTitle} · {lei(o.total)}</strong><span className={`status ${o.status}`}>{o.status}</span><button onClick={() => deleteOrderAsAdmin(o.id)}><Trash2 size={16}/></button></div>)}</main>}

    {authOpen && <div className="modal-backdrop"><form className="market-modal" onSubmit={authenticate}><button type="button" className="modal-close" onClick={() => setAuthOpen(false)}><X/></button><div className="modal-icon"><UserCircle2/></div><h2>{authMode === 'login' ? 'Bine ai revenit' : 'Creează profilul tău'}</h2><p>{authMode === 'login' ? 'Intră pentru a comanda și a vinde.' : 'Contul tău va fi folosit atât pentru cumpărături, cât și pentru vânzări.'}</p>{authMode === 'register' && <input required placeholder="Nume și prenume" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}/>}<input required type="email" placeholder="Email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}/><input required minLength={6} type="password" placeholder="Parolă" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}/><button className="modal-primary" disabled={busy}>{busy ? 'Se procesează...' : authMode === 'login' ? 'Intră în cont' : 'Creează cont'}</button><button type="button" className="text-button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'Nu ai cont? Creează unul' : 'Ai deja cont? Intră în cont'}</button></form></div>}

    {sellOpen && <div className="modal-backdrop"><form className="market-modal wide" onSubmit={publishListing}><button type="button" className="modal-close" onClick={() => setSellOpen(false)}><X/></button><h2>Postează un anunț</h2><p>Spune colegilor ce ai de vânzare.</p><input required placeholder="Titlu — ex. Miere de salcâm" value={listingForm.title} onChange={(e) => setListingForm({ ...listingForm, title: e.target.value })}/><textarea required rows={4} placeholder="Descriere produs, proveniență, detalii de livrare..." value={listingForm.description} onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })}/><div className="form-grid"><select value={listingForm.category} onChange={(e) => setListingForm({ ...listingForm, category: e.target.value })}>{categories.filter(c => c !== 'Toate').map(c => <option key={c}>{c}</option>)}</select><input required type="number" min="0" step="0.01" placeholder="Preț MDL" value={listingForm.price} onChange={(e) => setListingForm({ ...listingForm, price: e.target.value })}/><select value={listingForm.unit} onChange={(e) => setListingForm({ ...listingForm, unit: e.target.value })}>{units.map(u => <option key={u}>{u}</option>)}</select><input required type="number" min="0" step="0.01" placeholder="Stoc disponibil" value={listingForm.stock} onChange={(e) => setListingForm({ ...listingForm, stock: e.target.value })}/></div><label className="file-drop">📷 Adaugă o fotografie<input type="file" accept="image/*" onChange={(e) => setListingForm({ ...listingForm, image: e.target.files?.[0] || null })}/><span>{listingForm.image?.name || 'JPG, PNG sau WEBP'}</span></label><button className="modal-primary" disabled={busy}>{busy ? 'Se publică...' : 'Publică anunțul'}</button></form></div>}

    {orderListing && <div className="modal-backdrop"><form className="market-modal" onSubmit={placeOrder}><button type="button" className="modal-close" onClick={() => setOrderListing(null)}><X/></button><span className="eyebrow">COMANDĂ NOUĂ</span><h2>{orderListing.title}</h2><p>Vânzător: <strong>{orderListing.sellerName}</strong></p><label>Cantitate ({orderListing.unit})<input required type="number" min="0.01" max={orderListing.stock} step="0.01" value={orderForm.quantity} onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}/></label><label>Mesaj pentru vânzător<textarea rows={3} placeholder="Ex: adu-mi vineri la birou" value={orderForm.note} onChange={(e) => setOrderForm({ ...orderForm, note: e.target.value })}/></label><div className="order-total"><span>Total</span><strong>{lei(Number(orderForm.quantity || 0) * orderListing.price)}</strong></div><button className="modal-primary" disabled={busy}>{busy ? 'Se trimite...' : 'Trimite comanda vânzătorului'}</button></form></div>}
  </div>;
}

function OrderCard({ order, seller, onStatus }: { order: MarketOrder; seller?: boolean; onStatus?: (id: string, status: MarketOrder['status']) => void }) {
  return <article className="order-card"><div className="order-card-head"><div><small>{seller ? `De la ${order.buyerName}` : `La ${order.sellerName}`}</small><h4>{order.listingTitle}</h4></div><span className={`status ${order.status}`}>{order.status}</span></div><p>{order.quantity} {order.unit} × {lei(order.unitPrice)}</p>{order.note && <blockquote>“{order.note}”</blockquote>}<div className="order-card-foot"><strong>{lei(order.total)}</strong>{seller && onStatus && <div className="status-actions">{order.status === 'noua' && <><button onClick={() => onStatus(order.id, 'acceptata')}>Acceptă</button><button className="ghost-danger" onClick={() => onStatus(order.id, 'respinsa')}>Respinge</button></>}{order.status === 'acceptata' && <button onClick={() => onStatus(order.id, 'pregatita')}>Pregătită</button>}{order.status === 'pregatita' && <button onClick={() => onStatus(order.id, 'predata')}>Predată</button>}</div>}</div></article>;
}

function Stat({ value, label }: { value: number; label: string }) { return <div className="stat-card"><strong>{value}</strong><span>{label}</span></div>; }
