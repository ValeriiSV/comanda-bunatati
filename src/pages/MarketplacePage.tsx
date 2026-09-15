import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  UserCheck,
  UserCircle2,
  UserX,
  X,
} from 'lucide-react';
import { auth, db, storage } from '@/lib/firebase';
import './marketplace.css';

type Profile = {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  department?: string;
  role: 'admin' | 'user';
  approved: boolean;
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
  createdAt?: any;
};

type OrderStatus = 'noua' | 'acceptata' | 'pregatita' | 'predata' | 'respinsa';

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
  status: OrderStatus;
  createdAt?: any;
};

const ADMIN_EMAIL = 'valerkasvetlicenco@icloud.com';
const categories = ['Toate', 'Ouă', 'Miere', 'Nuci', 'Fructe uscate', 'Legume & fructe', 'Conserve', 'Patiserie', 'Lactate', 'Altele'];
const units = ['buc', 'kg', 'g', 'litru', 'borcan', 'pachet', 'cofraj'];
const emptyListing = { title: '', description: '', category: 'Altele', price: '', unit: 'buc', stock: '', image: null as File | null };
const lei = (value: number) => new Intl.NumberFormat('ro-MD', { style: 'currency', currency: 'MDL', maximumFractionDigits: 2 }).format(value || 0);

function orderTime(order: MarketOrder) {
  const value = order.createdAt?.toMillis?.() ?? 0;
  return Number(value) || 0;
}

async function ensureProfile(user: User, preferredName = '') {
  const profileRef = doc(db, 'marketUsers', user.uid);
  const snapshot = await getDoc(profileRef);
  if (snapshot.exists()) return;
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
  await setDoc(profileRef, {
    uid: user.uid,
    email: user.email || '',
    displayName: preferredName || user.displayName || user.email?.split('@')[0] || 'Colegul meu',
    role: isAdmin ? 'admin' : 'user',
    approved: isAdmin,
    blocked: false,
    createdAt: serverTimestamp(),
  });
}

export default function MarketplacePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
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

  const allowed = profile?.approved === true && profile?.blocked !== true;
  const isAdmin = profile?.role === 'admin';

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setUser(nextUser);
    setProfile(null);
    setOrders([]);
    if (!nextUser) return;
    try {
      await ensureProfile(nextUser);
      const refProfile = doc(db, 'marketUsers', nextUser.uid);
      const snap = await getDoc(refProfile);
      if (snap.exists()) setProfile(snap.data() as Profile);
    } catch (error) {
      setMessage(`Profilul nu poate fi încărcat: ${(error as Error).message}`);
    }
  }), []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'marketUsers', user.uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as Profile);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !allowed) {
      setListings([]);
      return;
    }
    const q = query(collection(db, 'marketListings'), where('active', '==', true));
    return onSnapshot(q, (snapshot) => {
      setListings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Listing)));
    }, (error) => setMessage(`Anunțurile nu pot fi încărcate: ${error.message}`));
  }, [user, allowed]);

  useEffect(() => {
    if (!user || !allowed) {
      setOrders([]);
      return;
    }

    if (isAdmin) {
      return onSnapshot(collection(db, 'marketOrders'), (snapshot) => {
        const all = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as MarketOrder));
        setOrders(all.sort((a, b) => orderTime(b) - orderTime(a)));
      });
    }

    let bought: MarketOrder[] = [];
    let sold: MarketOrder[] = [];
    const merge = () => {
      const map = new Map<string, MarketOrder>();
      [...bought, ...sold].forEach((item) => map.set(item.id, item));
      setOrders([...map.values()].sort((a, b) => orderTime(b) - orderTime(a)));
    };

    const unsubscribers: Unsubscribe[] = [
      onSnapshot(query(collection(db, 'marketOrders'), where('buyerId', '==', user.uid)), (snapshot) => {
        bought = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as MarketOrder));
        merge();
      }),
      onSnapshot(query(collection(db, 'marketOrders'), where('sellerId', '==', user.uid)), (snapshot) => {
        sold = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as MarketOrder));
        merge();
      }),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user, allowed, isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setUsers([]);
      return;
    }
    return onSnapshot(collection(db, 'marketUsers'), (snapshot) => {
      setUsers(snapshot.docs.map((item) => item.data() as Profile).sort((a, b) => a.displayName.localeCompare(b.displayName)));
    });
  }, [isAdmin]);

  const visibleListings = useMemo(() => listings.filter((item) => {
    const text = `${item.title} ${item.description} ${item.sellerName}`.toLowerCase();
    return (category === 'Toate' || item.category === category) && text.includes(search.trim().toLowerCase());
  }), [listings, category, search]);

  const myListings = user ? listings.filter((item) => item.sellerId === user.uid) : [];
  const myOrders = user ? orders.filter((item) => item.buyerId === user.uid) : [];
  const incomingOrders = user ? orders.filter((item) => item.sellerId === user.uid) : [];
  const pendingUsers = users.filter((item) => !item.approved && !item.blocked);

  const authenticate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (authMode === 'register') {
        const credentials = await createUserWithEmailAndPassword(auth, authForm.email.trim(), authForm.password);
        if (authForm.name.trim()) await updateProfile(credentials.user, { displayName: authForm.name.trim() });
        await ensureProfile(credentials.user, authForm.name.trim());
        setMessage('Cont creat. Administratorul trebuie să îl aprobe înainte să poți folosi marketplace-ul.');
      } else {
        await signInWithEmailAndPassword(auth, authForm.email.trim(), authForm.password);
      }
      setAuthOpen(false);
      setAuthForm({ name: '', email: '', password: '' });
    } catch (error) {
      setMessage((error as Error).message.replace('Firebase: ', ''));
    } finally {
      setBusy(false);
    }
  };

  const requireAccess = (action: () => void) => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (profile?.blocked) {
      setMessage('Contul tău este blocat. Contactează administratorul.');
      return;
    }
    if (!profile?.approved) {
      setMessage('Contul tău așteaptă aprobarea administratorului.');
      return;
    }
    action();
  };

  const publishListing = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !profile || !allowed) return;
    const price = Number(listingForm.price);
    const stock = Number(listingForm.stock);
    if (!listingForm.title.trim() || price <= 0 || stock <= 0) {
      setMessage('Completează titlul, prețul și stocul cu valori valide.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      let imageUrl = '';
      if (listingForm.image) {
        const imageRef = ref(storage, `marketplace/${user.uid}/${Date.now()}-${listingForm.image.name}`);
        await uploadBytes(imageRef, listingForm.image);
        imageUrl = await getDownloadURL(imageRef);
      }
      await setDoc(doc(collection(db, 'marketListings')), {
        sellerId: user.uid,
        sellerName: profile.displayName,
        sellerEmail: profile.email,
        title: listingForm.title.trim(),
        description: listingForm.description.trim(),
        category: listingForm.category,
        price,
        unit: listingForm.unit,
        stock,
        imageUrl,
        active: true,
        createdAt: serverTimestamp(),
      });
      setListingForm(emptyListing);
      setSellOpen(false);
      setTab('my-listings');
      setMessage('Anunțul a fost publicat.');
    } catch (error) {
      setMessage(`Nu am putut publica anunțul: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const placeOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !profile || !orderListing || !allowed) return;
    const quantity = Number(orderForm.quantity);
    if (!quantity || quantity <= 0) {
      setMessage('Alege o cantitate validă.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const orderRef = doc(collection(db, 'marketOrders'));
      const listingRef = doc(db, 'marketListings', orderListing.id);
      await runTransaction(db, async (transaction) => {
        const listingSnap = await transaction.get(listingRef);
        if (!listingSnap.exists()) throw new Error('Anunțul nu mai există.');
        const current = listingSnap.data() as Listing;
        if (!current.active) throw new Error('Anunțul nu mai este activ.');
        if (current.sellerId === user.uid) throw new Error('Nu poți comanda propriul produs.');
        if (quantity > Number(current.stock || 0)) throw new Error(`Mai sunt disponibile doar ${current.stock} ${current.unit}.`);
        const total = quantity * Number(current.price || 0);
        transaction.set(orderRef, {
          listingId: orderListing.id,
          listingTitle: current.title,
          sellerId: current.sellerId,
          sellerName: current.sellerName,
          buyerId: user.uid,
          buyerName: profile.displayName,
          buyerEmail: profile.email,
          quantity,
          unit: current.unit,
          unitPrice: current.price,
          total,
          note: orderForm.note.trim(),
          status: 'noua',
          createdAt: serverTimestamp(),
        });
        transaction.update(listingRef, {
          stock: Number(current.stock) - quantity,
          updatedAt: serverTimestamp(),
        });
      });
      setOrderListing(null);
      setOrderForm({ quantity: '1', note: '' });
      setTab('orders');
      setMessage(`Comanda a fost trimisă lui ${orderListing.sellerName}. Vânzătorul o vede imediat în comenzile primite.`);
    } catch (error) {
      setMessage(`Comanda nu a putut fi trimisă: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const changeOrderStatus = async (id: string, status: OrderStatus) => {
    try {
      await updateDoc(doc(db, 'marketOrders', id), { status, updatedAt: serverTimestamp() });
    } catch (error) {
      setMessage(`Statusul nu a putut fi schimbat: ${(error as Error).message}`);
    }
  };

  const removeListing = async (id: string) => {
    await updateDoc(doc(db, 'marketListings', id), { active: false, updatedAt: serverTimestamp() });
    setMessage('Anunțul a fost retras.');
  };

  const changeUserState = async (target: Profile, patch: Partial<Pick<Profile, 'approved' | 'blocked'>>) => {
    if (!isAdmin) return;
    await updateDoc(doc(db, 'marketUsers', target.uid), { ...patch, updatedAt: serverTimestamp() });
    setMessage(`Contul ${target.displayName} a fost actualizat.`);
  };

  const deleteOrderAsAdmin = async (id: string) => {
    if (!isAdmin) return;
    await deleteDoc(doc(db, 'marketOrders', id));
  };

  const orderStatusLabel = (status: OrderStatus) => ({
    noua: 'Nouă', acceptata: 'Acceptată', pregatita: 'Pregătită', predata: 'Predată', respinsa: 'Respinsă',
  }[status]);

  const orderCard = (order: MarketOrder, incoming = false) => <article className="order-card" key={order.id}>
    <div className="order-card-head">
      <div><span className={`status status-${order.status}`}>{orderStatusLabel(order.status)}</span><h3>{order.listingTitle}</h3></div>
      <strong>{lei(order.total)}</strong>
    </div>
    <p><b>{order.quantity} {order.unit}</b> × {lei(order.unitPrice)}</p>
    <p>{incoming ? `Cumpărător: ${order.buyerName}` : `Vânzător: ${order.sellerName}`}</p>
    {order.note && <p className="order-note">„{order.note}”</p>}
    {incoming && order.status === 'noua' && <div className="order-actions"><button onClick={() => changeOrderStatus(order.id, 'acceptata')}><CheckCircle2 size={16}/> Acceptă</button><button className="danger" onClick={() => changeOrderStatus(order.id, 'respinsa')}><X size={16}/> Respinge</button></div>}
    {incoming && order.status === 'acceptata' && <div className="order-actions"><button onClick={() => changeOrderStatus(order.id, 'pregatita')}><PackageCheck size={16}/> Marchează pregătită</button></div>}
    {incoming && order.status === 'pregatita' && <div className="order-actions"><button onClick={() => changeOrderStatus(order.id, 'predata')}><CheckCircle2 size={16}/> Marchează predată</button></div>}
    {isAdmin && <button className="icon-danger" title="Șterge comanda" onClick={() => deleteOrderAsAdmin(order.id)}><Trash2 size={16}/></button>}
  </article>;

  return <div className="market-shell">
    <header className="market-header">
      <div className="market-brand" onClick={() => setTab('market')}><div className="brand-mark">B</div><div><strong>Bunătăți Market</strong><span>marketplace intern între colegi</span></div></div>
      <nav className="market-nav">
        <button className={tab === 'market' ? 'active' : ''} onClick={() => setTab('market')}><Store size={18}/> Market</button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => requireAccess(() => setTab('orders'))}><ShoppingBag size={18}/> Comenzi</button>
        <button className={tab === 'my-listings' ? 'active' : ''} onClick={() => requireAccess(() => setTab('my-listings'))}><PackageCheck size={18}/> Anunțurile mele</button>
        {isAdmin && <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}><ShieldCheck size={18}/> Admin {pendingUsers.length > 0 && <b className="nav-badge">{pendingUsers.length}</b>}</button>}
      </nav>
      <div className="market-actions">
        <Link className="legacy-link" to="/comanda">Comanda lunii</Link>
        <button className="sell-button" onClick={() => requireAccess(() => setSellOpen(true))}><Plus size={18}/> Vinde</button>
        {user ? <button className="profile-button" onClick={() => signOut(auth)}><UserCircle2 size={20}/><span>{profile?.displayName || user.email}</span><LogOut size={16}/></button> : <button className="profile-button" onClick={() => setAuthOpen(true)}><LogIn size={18}/> Intră în cont</button>}
      </div>
    </header>

    {message && <div className="market-message" onClick={() => setMessage('')}>{message}<X size={16}/></div>}

    {user && profile && !profile.approved && !profile.blocked && <div className="approval-banner"><Clock3 size={20}/><div><strong>Cont în așteptarea aprobării</strong><span>Administratorul trebuie să accepte contul înainte să poți vedea produsele, publica sau comanda.</span></div></div>}
    {profile?.blocked && <div className="approval-banner blocked"><UserX size={20}/><div><strong>Cont blocat</strong><span>Contactează administratorul pentru reactivare.</span></div></div>}

    {tab === 'market' && <main className="market-main">
      <section className="market-hero">
        <div><span className="eyebrow">DE LA COLEGI, PENTRU COLEGI</span><h1>Cumperi local. Vinzi simplu.<br/>Totul într-un singur loc.</h1><p>Ouă, miere, nuci, legume, conserve și alte bunătăți aduse direct de colegii tăi.</p><button className="hero-cta" onClick={() => requireAccess(() => setSellOpen(true))}><Plus size={19}/> Postează un anunț</button></div>
        <div className="hero-card"><span>Astăzi în market</span><strong>{listings.length}</strong><small>anunțuri active</small><div className="hero-mini"><span>{incomingOrders.filter(o => o.status === 'noua').length} comenzi noi pentru tine</span><span>{new Set(listings.map(l => l.sellerId)).size} vânzători</span></div></div>
      </section>

      {!user && <section className="locked-market"><ShieldCheck size={38}/><h2>Marketplace intern</h2><p>Intră în cont sau creează un cont de coleg pentru a vedea produsele.</p><button className="hero-cta" onClick={() => setAuthOpen(true)}>Intră / Creează cont</button></section>}

      {user && allowed && <>
        <section className="market-toolbar">
          <label className="search-box"><Search size={19}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Caută miere, ouă, nuci..."/></label>
          <div className="category-row">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
        </section>
        <section className="market-grid">
          {visibleListings.map((item) => <article className="listing-card" key={item.id}>
            <div className="listing-image">{item.imageUrl ? <img src={item.imageUrl} alt={item.title}/> : <div className="image-placeholder">🛍️</div>}<span className="stock-pill">{item.stock} {item.unit} disponibile</span></div>
            <div className="listing-body"><span className="listing-category">{item.category}</span><h3>{item.title}</h3><p>{item.description}</p><div className="seller-line"><UserCircle2 size={17}/><span>{item.sellerName}</span></div><div className="listing-footer"><div><strong>{lei(item.price)}</strong><span>/ {item.unit}</span></div><button disabled={item.stock <= 0 || item.sellerId === user.uid} onClick={() => { setOrderListing(item); setOrderForm({ quantity: '1', note: '' }); }}>{item.sellerId === user.uid ? 'Anunțul tău' : item.stock <= 0 ? 'Indisponibil' : 'Comandă'}</button></div></div>
          </article>)}
          {!visibleListings.length && <div className="empty-state"><Store size={42}/><h3>Nu sunt anunțuri pentru filtrul ales.</h3><p>Poți fi primul care publică ceva aici.</p></div>}
        </section>
      </>}
    </main>}

    {tab === 'my-listings' && allowed && <main className="market-main dashboard-page">
      <div className="section-head"><div><span className="eyebrow">SPAȚIUL TĂU</span><h2>Anunțurile mele</h2></div><button className="sell-button" onClick={() => setSellOpen(true)}><Plus size={18}/> Anunț nou</button></div>
      <div className="dashboard-grid">{myListings.map((item) => <article className="manage-card" key={item.id}><div>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <div className="manage-placeholder">🛍️</div>}</div><section><span>{item.category}</span><h3>{item.title}</h3><p>{item.stock} {item.unit} • {lei(item.price)} / {item.unit}</p><button className="danger" onClick={() => removeListing(item.id)}><Trash2 size={16}/> Retrage anunțul</button></section></article>)}</div>
      {!myListings.length && <div className="empty-state"><PackageCheck size={42}/><h3>Nu ai anunțuri active.</h3></div>}
    </main>}

    {tab === 'orders' && allowed && <main className="market-main dashboard-page">
      <div className="section-head"><div><span className="eyebrow">COMENZI</span><h2>Cumpărături și vânzări</h2></div></div>
      <div className="orders-columns"><section><h3>Comenzile mele</h3>{myOrders.length ? myOrders.map((order) => orderCard(order)) : <p className="muted">Nu ai comandat nimic încă.</p>}</section><section><h3>Comenzi primite</h3>{incomingOrders.length ? incomingOrders.map((order) => orderCard(order, true)) : <p className="muted">Nu ai primit comenzi încă.</p>}</section></div>
    </main>}

    {tab === 'admin' && isAdmin && <main className="market-main dashboard-page">
      <div className="section-head"><div><span className="eyebrow">ADMINISTRATOR</span><h2>Control marketplace</h2></div></div>
      <div className="admin-stats"><div><strong>{users.length}</strong><span>utilizatori</span></div><div><strong>{pendingUsers.length}</strong><span>așteaptă aprobare</span></div><div><strong>{listings.length}</strong><span>anunțuri active</span></div><div><strong>{orders.length}</strong><span>comenzi</span></div></div>
      <section className="admin-users"><h3>Utilizatori</h3>{users.map((item) => <article className="user-row" key={item.uid}><div><strong>{item.displayName}</strong><span>{item.email}</span><small>{item.role === 'admin' ? 'Administrator' : item.blocked ? 'Blocat' : item.approved ? 'Aprobat' : 'Așteaptă aprobare'}</small></div><div className="user-actions">{item.role !== 'admin' && !item.approved && !item.blocked && <button onClick={() => changeUserState(item, { approved: true, blocked: false })}><UserCheck size={16}/> Aprobă</button>}{item.role !== 'admin' && item.approved && !item.blocked && <button className="danger" onClick={() => changeUserState(item, { blocked: true })}><UserX size={16}/> Blochează</button>}{item.role !== 'admin' && item.blocked && <button onClick={() => changeUserState(item, { blocked: false, approved: true })}><UserCheck size={16}/> Reactivează</button>}</div></article>)}</section>
    </main>}

    {authOpen && <div className="market-modal-backdrop" onMouseDown={() => setAuthOpen(false)}><div className="market-modal" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setAuthOpen(false)}><X/></button><div className="modal-icon"><UserCircle2/></div><h2>{authMode === 'login' ? 'Intră în cont' : 'Creează profil de coleg'}</h2><p>{authMode === 'login' ? 'Folosește emailul și parola ta.' : 'După înregistrare, administratorul trebuie să aprobe contul.'}</p><form onSubmit={authenticate}>{authMode === 'register' && <label>Nume și prenume<input required value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}/></label>}<label>Email<input type="email" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}/></label><label>Parolă<input type="password" minLength={6} required value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}/></label><button className="primary-wide" disabled={busy}>{busy ? 'Se procesează...' : authMode === 'login' ? 'Intră în cont' : 'Creează cont'}</button></form><button className="switch-auth" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'Nu ai cont? Creează unul' : 'Ai deja cont? Intră în cont'}</button></div></div>}

    {sellOpen && allowed && <div className="market-modal-backdrop" onMouseDown={() => setSellOpen(false)}><div className="market-modal wide" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setSellOpen(false)}><X/></button><div className="modal-icon"><Plus/></div><h2>Publică un anunț</h2><form onSubmit={publishListing} className="listing-form"><label className="full">Titlu<input required value={listingForm.title} onChange={(e) => setListingForm({ ...listingForm, title: e.target.value })} placeholder="Ex: Miere de salcâm"/></label><label className="full">Descriere<textarea required value={listingForm.description} onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })} placeholder="Spune colegilor mai multe despre produs..."/></label><label>Categorie<select value={listingForm.category} onChange={(e) => setListingForm({ ...listingForm, category: e.target.value })}>{categories.filter(c => c !== 'Toate').map(c => <option key={c}>{c}</option>)}</select></label><label>Unitate<select value={listingForm.unit} onChange={(e) => setListingForm({ ...listingForm, unit: e.target.value })}>{units.map(u => <option key={u}>{u}</option>)}</select></label><label>Preț (MDL)<input type="number" min="0.01" step="0.01" required value={listingForm.price} onChange={(e) => setListingForm({ ...listingForm, price: e.target.value })}/></label><label>Stoc disponibil<input type="number" min="0.01" step="0.01" required value={listingForm.stock} onChange={(e) => setListingForm({ ...listingForm, stock: e.target.value })}/></label><label className="full">Fotografie<input type="file" accept="image/*" onChange={(e) => setListingForm({ ...listingForm, image: e.target.files?.[0] || null })}/></label><button className="primary-wide full" disabled={busy}>{busy ? 'Se publică...' : 'Publică anunțul'}</button></form></div></div>}

    {orderListing && allowed && <div className="market-modal-backdrop" onMouseDown={() => setOrderListing(null)}><div className="market-modal" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setOrderListing(null)}><X/></button><div className="modal-icon"><ShoppingBag/></div><h2>Comandă {orderListing.title}</h2><p>Vânzător: <b>{orderListing.sellerName}</b> • {lei(orderListing.price)} / {orderListing.unit}</p><form onSubmit={placeOrder}><label>Cantitate ({orderListing.unit})<input type="number" min="0.01" step="0.01" max={orderListing.stock} required value={orderForm.quantity} onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}/></label><label>Mesaj pentru vânzător<textarea value={orderForm.note} onChange={(e) => setOrderForm({ ...orderForm, note: e.target.value })} placeholder="Ex: adu-mi-o vineri la birou"/></label><div className="order-total"><span>Total</span><strong>{lei(Number(orderForm.quantity || 0) * orderListing.price)}</strong></div><button className="primary-wide" disabled={busy}>{busy ? 'Se trimite...' : 'Trimite comanda'}</button></form></div></div>}
  </div>;
}
