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
import {
  CheckCircle2,
  Clock3,
  Heart,
  LogIn,
  LogOut,
  MapPin,
  MessageCircle,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  Trash2,
  UserCheck,
  UserCircle2,
  UserX,
  X,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import './marketplace.css';
import './marketplace-global.css';

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

type ListingType = 'vand' | 'ofer' | 'caut';
type ListingCondition = 'nou' | 'folosit' | 'na';
type ListingFlow = 'order' | 'contact';

type Listing = {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  listingType?: ListingType;
  condition?: ListingCondition;
  negotiable?: boolean;
  pickupPoint?: string;
  flow?: ListingFlow;
  price: number;
  unit: string;
  stock: number;
  imageUrl?: string;
  imageUrls?: string[];
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
  kind?: 'order' | 'contact';
  status: OrderStatus;
  createdAt?: any;
};

const ADMIN_EMAIL = 'valerkasvetlicenco@icloud.com';
const FAVORITES_KEY = 'orbico_market_favorites_v1';

const categories = [
  'Toate',
  'Alimente & produse de casă',
  'Haine & Încălțăminte',
  'Electronice & Tehnică',
  'Casă & Grădină',
  'Auto & Moto',
  'Copii',
  'Sport & Hobby',
  'Servicii',
  'Cărți & Educație',
  'Altele',
];

const categoryEmoji: Record<string, string> = {
  'Alimente & produse de casă': '🥚',
  'Haine & Încălțăminte': '👕',
  'Electronice & Tehnică': '📱',
  'Casă & Grădină': '🏠',
  'Auto & Moto': '🚗',
  'Copii': '🧸',
  'Sport & Hobby': '⚽',
  'Servicii': '🛠️',
  'Cărți & Educație': '📚',
  'Altele': '✨',
};

const units = ['buc', 'kg', 'g', 'litru', 'borcan', 'pachet', 'set', 'serviciu'];
const MAX_IMAGE_DATA_URL = 220_000;

const emptyListing = {
  title: '',
  description: '',
  category: 'Alimente & produse de casă',
  subcategory: '',
  listingType: 'vand' as ListingType,
  condition: 'na' as ListingCondition,
  negotiable: false,
  pickupPoint: '',
  flow: 'order' as ListingFlow,
  price: '',
  unit: 'buc',
  stock: '1',
  images: [] as File[],
};

const lei = (value: number) => new Intl.NumberFormat('ro-MD', {
  style: 'currency',
  currency: 'MDL',
  maximumFractionDigits: 2,
}).format(value || 0);

function orderTime(order: MarketOrder) {
  return Number(order.createdAt?.toMillis?.() ?? 0);
}

function listingTime(listing: Listing) {
  return Number(listing.createdAt?.toMillis?.() ?? 0);
}

function readFavorites() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'));
  } catch {
    return new Set<string>();
  }
}

function listingImages(listing: Listing) {
  if (Array.isArray(listing.imageUrls) && listing.imageUrls.length) return listing.imageUrls;
  return listing.imageUrl ? [listing.imageUrl] : [];
}

function listingTypeLabel(type?: ListingType) {
  return ({ vand: 'Vând', ofer: 'Ofer', caut: 'Caut' } as const)[type || 'vand'];
}

function conditionLabel(condition?: ListingCondition) {
  if (condition === 'nou') return 'Nou';
  if (condition === 'folosit') return 'Folosit';
  return '';
}

async function compressListingImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Alege doar fotografii.');
  if (file.size > 10 * 1024 * 1024) throw new Error('O fotografie depășește limita de 10 MB.');

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Fotografia nu poate fi citită.'));
      img.src = objectUrl;
    });

    let maxSide = 1000;
    for (let pass = 0; pass < 5; pass += 1) {
      const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * ratio));
      const height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Browserul nu poate procesa fotografia.');
      context.drawImage(image, 0, 0, width, height);

      for (const quality of [0.74, 0.64, 0.54, 0.44, 0.36]) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length <= MAX_IMAGE_DATA_URL) return dataUrl;
      }
      maxSide = Math.round(maxSide * 0.78);
    }
    throw new Error('Fotografia rămâne prea mare după compresie.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
  const [requestMode, setRequestMode] = useState<'order' | 'contact'>('order');
  const [listingForm, setListingForm] = useState(emptyListing);
  const [orderForm, setOrderForm] = useState({ quantity: '1', note: '' });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Toate');
  const [typeFilter, setTypeFilter] = useState<'Toate' | ListingType>('Toate');
  const [conditionFilter, setConditionFilter] = useState<'Toate' | ListingCondition>('Toate');
  const [sort, setSort] = useState<'new' | 'priceAsc' | 'priceDesc'>('new');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => readFavorites());
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
      const snap = await getDoc(doc(db, 'marketUsers', nextUser.uid));
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
    const listingsQuery = query(collection(db, 'marketListings'), where('active', '==', true));
    return onSnapshot(listingsQuery, (snapshot) => {
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

  const visibleListings = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = listings.filter((item) => {
      const normalizedType = item.listingType || 'vand';
      const normalizedCondition = item.condition || 'na';
      const text = `${item.title} ${item.description} ${item.sellerName} ${item.subcategory || ''} ${item.pickupPoint || ''}`.toLowerCase();
      return (category === 'Toate' || item.category === category)
        && (typeFilter === 'Toate' || normalizedType === typeFilter)
        && (conditionFilter === 'Toate' || normalizedCondition === conditionFilter)
        && (!needle || text.includes(needle))
        && (!favoritesOnly || favorites.has(item.id));
    });

    return filtered.sort((a, b) => {
      if (sort === 'priceAsc') return Number(a.price || 0) - Number(b.price || 0);
      if (sort === 'priceDesc') return Number(b.price || 0) - Number(a.price || 0);
      return listingTime(b) - listingTime(a);
    });
  }, [listings, category, typeFilter, conditionFilter, search, favoritesOnly, favorites, sort]);

  const myListings = user ? listings.filter((item) => item.sellerId === user.uid) : [];
  const myOrders = user ? orders.filter((item) => item.buyerId === user.uid) : [];
  const incomingOrders = user ? orders.filter((item) => item.sellerId === user.uid) : [];
  const pendingUsers = users.filter((item) => !item.approved && !item.blocked);

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const authenticate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (authMode === 'register') {
        const credentials = await createUserWithEmailAndPassword(auth, authForm.email.trim(), authForm.password);
        if (authForm.name.trim()) await updateProfile(credentials.user, { displayName: authForm.name.trim() });
        await ensureProfile(credentials.user, authForm.name.trim());
        setMessage('Cont creat. Administratorul trebuie să îl aprobe înainte să poți folosi Orbico Market.');
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
    if (!user) return setAuthOpen(true);
    if (profile?.blocked) return setMessage('Contul tău este blocat. Contactează administratorul.');
    if (!profile?.approved) return setMessage('Contul tău așteaptă aprobarea administratorului.');
    action();
  };

  const publishListing = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !profile || !allowed) return;
    const price = Number(listingForm.price || 0);
    const stock = listingForm.flow === 'order' ? Number(listingForm.stock || 0) : Math.max(0, Number(listingForm.stock || 0));
    if (!listingForm.title.trim() || price < 0 || (listingForm.flow === 'order' && stock <= 0)) {
      setMessage('Completează titlul, prețul și cantitatea cu valori valide.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const selectedImages = listingForm.images.slice(0, 2);
      const imageUrls = await Promise.all(selectedImages.map(compressListingImage));
      await setDoc(doc(collection(db, 'marketListings')), {
        sellerId: user.uid,
        sellerName: profile.displayName,
        sellerEmail: profile.email,
        title: listingForm.title.trim(),
        description: listingForm.description.trim(),
        category: listingForm.category,
        subcategory: listingForm.subcategory.trim(),
        listingType: listingForm.listingType,
        condition: listingForm.condition,
        negotiable: listingForm.negotiable,
        pickupPoint: listingForm.pickupPoint.trim(),
        flow: listingForm.flow,
        price,
        unit: listingForm.unit,
        stock,
        imageUrl: imageUrls[0] || '',
        imageUrls,
        active: true,
        createdAt: serverTimestamp(),
      });
      setListingForm(emptyListing);
      setSellOpen(false);
      setTab('my-listings');
      setMessage('Anunțul a fost publicat în Orbico Market.');
    } catch (error) {
      setMessage(`Nu am putut publica anunțul: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const openListingAction = (listing: Listing) => {
    setOrderListing(listing);
    const mode: 'order' | 'contact' = (listing.flow || 'order') === 'contact' || listing.listingType === 'caut' ? 'contact' : 'order';
    setRequestMode(mode);
    setOrderForm({ quantity: '1', note: '' });
  };

  const placeOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !profile || !orderListing || !allowed) return;

    const quantity = requestMode === 'contact' ? 1 : Number(orderForm.quantity);
    if (!quantity || quantity <= 0) return setMessage('Alege o cantitate validă.');

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
        if (current.sellerId === user.uid) throw new Error('Nu poți trimite solicitare la propriul anunț.');
        if (requestMode === 'order' && quantity > Number(current.stock || 0)) {
          throw new Error(`Mai sunt disponibile doar ${current.stock} ${current.unit}.`);
        }

        const total = requestMode === 'order' ? quantity * Number(current.price || 0) : 0;
        transaction.set(orderRef, {
          listingId: orderListing.id,
          listingTitle: current.title,
          sellerId: current.sellerId,
          sellerName: current.sellerName,
          buyerId: user.uid,
          buyerName: profile.displayName,
          buyerEmail: profile.email,
          quantity,
          unit: current.unit || 'buc',
          unitPrice: Number(current.price || 0),
          total,
          note: orderForm.note.trim(),
          kind: requestMode,
          status: 'noua',
          createdAt: serverTimestamp(),
        });

        if (requestMode === 'order') {
          transaction.update(listingRef, {
            stock: Number(current.stock) - quantity,
            updatedAt: serverTimestamp(),
          });
        }
      });
      setOrderListing(null);
      setTab('orders');
      setMessage(requestMode === 'order'
        ? `Comanda a fost trimisă lui ${orderListing.sellerName}.`
        : `Mesajul a fost trimis lui ${orderListing.sellerName}.`);
    } catch (error) {
      setMessage(`Solicitarea nu a putut fi trimisă: ${(error as Error).message}`);
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
    noua: 'Nouă',
    acceptata: 'Acceptată',
    pregatita: 'Pregătită',
    predata: 'Finalizată',
    respinsa: 'Respinsă',
  }[status]);

  const orderCard = (order: MarketOrder, incoming = false) => (
    <article className="order-card" key={order.id}>
      <div className="order-card-head">
        <div>
          <span className={`status status-${order.status}`}>{orderStatusLabel(order.status)}</span>
          <h3>{order.listingTitle}</h3>
        </div>
        <strong>{order.kind === 'contact' ? 'Mesaj' : lei(order.total)}</strong>
      </div>
      {order.kind !== 'contact' && <p><b>{order.quantity} {order.unit}</b> × {lei(order.unitPrice)}</p>}
      <p>{incoming ? `De la: ${order.buyerName}` : `Către: ${order.sellerName}`}</p>
      {order.note && <p className="order-note">„{order.note}”</p>}
      {incoming && order.status === 'noua' && (
        <div className="order-actions">
          <button onClick={() => changeOrderStatus(order.id, 'acceptata')}><CheckCircle2 size={16}/> Acceptă</button>
          <button className="danger" onClick={() => changeOrderStatus(order.id, 'respinsa')}><X size={16}/> Respinge</button>
        </div>
      )}
      {incoming && order.status === 'acceptata' && (
        <div className="order-actions">
          <button onClick={() => changeOrderStatus(order.id, 'pregatita')}><PackageCheck size={16}/> În lucru / pregătit</button>
        </div>
      )}
      {incoming && order.status === 'pregatita' && (
        <div className="order-actions">
          <button onClick={() => changeOrderStatus(order.id, 'predata')}><CheckCircle2 size={16}/> Finalizează</button>
        </div>
      )}
      {isAdmin && <button className="icon-danger" title="Șterge" onClick={() => deleteOrderAsAdmin(order.id)}><Trash2 size={16}/></button>}
    </article>
  );

  return (
    <div className="market-shell">
      <header className="market-header">
        <div className="market-brand" onClick={() => setTab('market')}>
          <img src="/orbico-market-logo.webp" alt="Orbico Market" />
          <div><strong>Orbico Market</strong><span>de la colegi, pentru colegi</span></div>
        </div>
        <nav className="market-nav">
          <button className={tab === 'market' ? 'active' : ''} onClick={() => setTab('market')}><Store size={18}/> Market</button>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => requireAccess(() => setTab('orders'))}><ShoppingBag size={18}/> Solicitări</button>
          <button className={tab === 'my-listings' ? 'active' : ''} onClick={() => requireAccess(() => setTab('my-listings'))}><PackageCheck size={18}/> Anunțurile mele</button>
          {isAdmin && <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}><ShieldCheck size={18}/> Admin {pendingUsers.length > 0 && <b className="nav-badge">{pendingUsers.length}</b>}</button>}
        </nav>
        <div className="market-actions">
          <Link className="legacy-link" to="/comanda">Comanda lunii</Link>
          <button className="sell-button" onClick={() => requireAccess(() => setSellOpen(true))}><Plus size={18}/> Anunț nou</button>
          {user
            ? <button className="profile-button" onClick={() => signOut(auth)}><UserCircle2 size={20}/><span>{profile?.displayName || user.email}</span><LogOut size={16}/></button>
            : <button className="profile-button" onClick={() => setAuthOpen(true)}><LogIn size={18}/> Intră</button>}
        </div>
      </header>

      {message && <div className="market-message" onClick={() => setMessage('')}>{message}<X size={16}/></div>}
      {user && profile && !profile.approved && !profile.blocked && (
        <div className="approval-banner"><Clock3 size={20}/><div><strong>Cont în așteptarea aprobării</strong><span>Administratorul trebuie să accepte contul înainte să folosești Orbico Market.</span></div></div>
      )}
      {profile?.blocked && <div className="approval-banner blocked"><UserX size={20}/><div><strong>Cont blocat</strong><span>Contactează administratorul pentru reactivare.</span></div></div>}

      {tab === 'market' && (
        <main className="market-main">
          <section className="market-hero">
            <div>
              <span className="eyebrow">ORBICO MARKET · INTERN</span>
              <h1>Tot ce au colegii de oferit, într-un singur loc.</h1>
              <p>Alimente de casă, haine, telefoane, tehnică, auto, servicii, sport, produse pentru copii și multe altele.</p>
              <button className="hero-cta" onClick={() => requireAccess(() => setSellOpen(true))}><Plus size={19}/> Publică un anunț</button>
            </div>
            <div className="hero-logo-card">
              <img src="/orbico-market-logo.webp" alt="Orbico Market" />
              <div className="hero-mini">
                <span><b>{listings.length}</b> anunțuri active</span>
                <span><b>{new Set(listings.map((l) => l.sellerId)).size}</b> colegi vânzători</span>
              </div>
            </div>
          </section>

          {!user && (
            <section className="locked-market">
              <ShieldCheck size={38}/>
              <h2>Marketplace intern Orbico</h2>
              <p>Intră în cont sau creează un profil de coleg pentru a vedea anunțurile.</p>
              <button className="hero-cta" onClick={() => setAuthOpen(true)}>Intră / Creează cont</button>
            </section>
          )}

          {user && allowed && (
            <>
              <section className="category-showcase">
                {categories.filter((item) => item !== 'Toate').slice(0, 8).map((item) => (
                  <button key={item} onClick={() => setCategory(item)} className={category === item ? 'active' : ''}>
                    <span>{categoryEmoji[item] || '✨'}</span><b>{item}</b>
                  </button>
                ))}
              </section>

              <section className="market-toolbar">
                <div className="toolbar-top">
                  <label className="search-box"><Search size={19}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Caută telefon, geacă, miere, anvelope, servicii..."/></label>
                  <button className={`favorite-filter ${favoritesOnly ? 'active' : ''}`} onClick={() => setFavoritesOnly((v) => !v)}><Heart size={18} fill={favoritesOnly ? 'currentColor' : 'none'}/> Favorite</button>
                </div>
                <div className="filter-row">
                  <span className="filter-label"><SlidersHorizontal size={16}/> Filtre</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
                  <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
                    <option>Toate</option><option value="vand">Vând</option><option value="ofer">Ofer</option><option value="caut">Caut</option>
                  </select>
                  <select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value as any)}>
                    <option>Toate</option><option value="nou">Nou</option><option value="folosit">Folosit</option><option value="na">Nespecificat</option>
                  </select>
                  <select value={sort} onChange={(e) => setSort(e.target.value as any)}>
                    <option value="new">Cele mai noi</option><option value="priceAsc">Preț crescător</option><option value="priceDesc">Preț descrescător</option>
                  </select>
                </div>
              </section>

              <section className="market-grid">
                {visibleListings.map((item) => {
                  const images = listingImages(item);
                  const type = item.listingType || 'vand';
                  const flow = item.flow || 'order';
                  return (
                    <article className="listing-card" key={item.id}>
                      <div className="listing-image">
                        {images[0] ? <img src={images[0]} alt={item.title}/> : <div className="image-placeholder">{categoryEmoji[item.category] || '🛍️'}</div>}
                        {images.length > 1 && <span className="photo-count">+{images.length - 1}</span>}
                        <button className={`favorite-button ${favorites.has(item.id) ? 'active' : ''}`} onClick={() => toggleFavorite(item.id)} aria-label="Favorite"><Heart size={18} fill={favorites.has(item.id) ? 'currentColor' : 'none'}/></button>
                        <span className={`listing-type type-${type}`}>{listingTypeLabel(type)}</span>
                      </div>
                      <div className="listing-body">
                        <div className="listing-meta">
                          <span className="listing-category">{item.category}</span>
                          {conditionLabel(item.condition) && <span className="condition-chip">{conditionLabel(item.condition)}</span>}
                        </div>
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                        {item.pickupPoint && <div className="pickup-line"><MapPin size={14}/>{item.pickupPoint}</div>}
                        <div className="seller-line"><UserCircle2 size={17}/><span>{item.sellerName}</span>{item.negotiable && <b>negociabil</b>}</div>
                        <div className="listing-footer">
                          <div>
                            <strong>{Number(item.price || 0) > 0 ? lei(item.price) : 'Preț la discuție'}</strong>
                            {flow === 'order' && <span>{item.stock} {item.unit} disponibile</span>}
                          </div>
                          <button disabled={item.sellerId === user.uid || (flow === 'order' && item.stock <= 0)} onClick={() => openListingAction(item)}>
                            {item.sellerId === user.uid ? 'Anunțul tău' : flow === 'contact' || type === 'caut' ? 'Contactează' : 'Comandă'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {!visibleListings.length && <div className="empty-state"><Store size={42}/><h3>Nu am găsit anunțuri.</h3><p>Schimbă filtrele sau publică primul anunț din această categorie.</p></div>}
              </section>
            </>
          )}
        </main>
      )}

      {tab === 'my-listings' && allowed && (
        <main className="market-main dashboard-page">
          <div className="section-head"><div><span className="eyebrow">SPAȚIUL TĂU</span><h2>Anunțurile mele</h2></div><button className="sell-button" onClick={() => setSellOpen(true)}><Plus size={18}/> Anunț nou</button></div>
          <div className="dashboard-grid">
            {myListings.map((item) => {
              const images = listingImages(item);
              return <article className="manage-card" key={item.id}><div>{images[0] ? <img src={images[0]} alt=""/> : <div className="manage-placeholder">{categoryEmoji[item.category] || '🛍️'}</div>}</div><section><span>{listingTypeLabel(item.listingType)} · {item.category}</span><h3>{item.title}</h3><p>{Number(item.price || 0) > 0 ? lei(item.price) : 'Preț la discuție'} {item.flow !== 'contact' ? `• ${item.stock} ${item.unit}` : ''}</p><button className="danger" onClick={() => removeListing(item.id)}><Trash2 size={16}/> Retrage anunțul</button></section></article>;
            })}
          </div>
          {!myListings.length && <div className="empty-state"><PackageCheck size={42}/><h3>Nu ai anunțuri active.</h3></div>}
        </main>
      )}

      {tab === 'orders' && allowed && (
        <main className="market-main dashboard-page">
          <div className="section-head"><div><span className="eyebrow">SOLICITĂRI & COMENZI</span><h2>Activitatea mea</h2></div></div>
          <div className="orders-columns">
            <section><h3>Trimise de mine</h3>{myOrders.length ? myOrders.map((order) => orderCard(order)) : <p className="muted">Nu ai trimis nimic încă.</p>}</section>
            <section><h3>Primite</h3>{incomingOrders.length ? incomingOrders.map((order) => orderCard(order, true)) : <p className="muted">Nu ai primit solicitări încă.</p>}</section>
          </div>
        </main>
      )}

      {tab === 'admin' && isAdmin && (
        <main className="market-main dashboard-page">
          <div className="section-head"><div><span className="eyebrow">ADMINISTRATOR</span><h2>Control Orbico Market</h2></div></div>
          <div className="admin-stats"><div><strong>{users.length}</strong><span>utilizatori</span></div><div><strong>{pendingUsers.length}</strong><span>așteaptă aprobare</span></div><div><strong>{listings.length}</strong><span>anunțuri active</span></div><div><strong>{orders.length}</strong><span>solicitări</span></div></div>
          <div className="admin-columns">
            <section className="admin-users">
              <h3>Utilizatori</h3>
              {users.map((item) => <article className="user-row" key={item.uid}><div><strong>{item.displayName}</strong><span>{item.email}</span><small>{item.role === 'admin' ? 'Administrator' : item.blocked ? 'Blocat' : item.approved ? 'Aprobat' : 'Așteaptă aprobare'}</small></div><div className="user-actions">{item.role !== 'admin' && !item.approved && !item.blocked && <button onClick={() => changeUserState(item, { approved: true, blocked: false })}><UserCheck size={16}/> Aprobă</button>}{item.role !== 'admin' && item.approved && !item.blocked && <button className="danger" onClick={() => changeUserState(item, { blocked: true })}><UserX size={16}/> Blochează</button>}{item.role !== 'admin' && item.blocked && <button onClick={() => changeUserState(item, { blocked: false, approved: true })}><UserCheck size={16}/> Reactivează</button>}</div></article>)}
            </section>
            <section className="admin-users">
              <h3>Moderare anunțuri</h3>
              {listings.map((item) => <article className="user-row" key={item.id}><div><strong>{item.title}</strong><span>{item.sellerName} · {item.category}</span><small>{listingTypeLabel(item.listingType)} · {Number(item.price || 0) > 0 ? lei(item.price) : 'fără preț'}</small></div><div className="user-actions"><button className="danger" onClick={() => removeListing(item.id)}><Trash2 size={16}/> Retrage</button></div></article>)}
            </section>
          </div>
        </main>
      )}

      {authOpen && (
        <div className="market-modal-backdrop" onMouseDown={() => setAuthOpen(false)}>
          <div className="market-modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setAuthOpen(false)}><X/></button>
            <div className="modal-icon"><UserCircle2/></div>
            <h2>{authMode === 'login' ? 'Intră în Orbico Market' : 'Creează profil de coleg'}</h2>
            <p>{authMode === 'login' ? 'Folosește emailul și parola ta.' : 'După înregistrare, administratorul trebuie să aprobe contul.'}</p>
            <form onSubmit={authenticate}>
              {authMode === 'register' && <label>Nume și prenume<input required value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}/></label>}
              <label>Email<input type="email" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}/></label>
              <label>Parolă<input type="password" minLength={6} required value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}/></label>
              <button className="primary-wide" disabled={busy}>{busy ? 'Se procesează...' : authMode === 'login' ? 'Intră în cont' : 'Creează cont'}</button>
            </form>
            <button className="switch-auth" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'Nu ai cont? Creează unul' : 'Ai deja cont? Intră în cont'}</button>
          </div>
        </div>
      )}

      {sellOpen && allowed && (
        <div className="market-modal-backdrop" onMouseDown={() => setSellOpen(false)}>
          <div className="market-modal wide" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSellOpen(false)}><X/></button>
            <div className="modal-icon"><Plus/></div>
            <h2>Publică un anunț</h2>
            <p>Vinde, oferă sau caută orice este util între colegi.</p>
            <form onSubmit={publishListing} className="listing-form">
              <label>Tip anunț<select value={listingForm.listingType} onChange={(e) => setListingForm({ ...listingForm, listingType: e.target.value as ListingType, flow: e.target.value === 'caut' ? 'contact' : listingForm.flow })}><option value="vand">Vând</option><option value="ofer">Ofer</option><option value="caut">Caut</option></select></label>
              <label>Categorie<select value={listingForm.category} onChange={(e) => setListingForm({ ...listingForm, category: e.target.value })}>{categories.filter((c) => c !== 'Toate').map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="full">Titlu<input required value={listingForm.title} onChange={(e) => setListingForm({ ...listingForm, title: e.target.value })} placeholder="Ex: iPhone 15 Pro, geacă Zara, miere de salcâm..."/></label>
              <label className="full">Descriere<textarea required value={listingForm.description} onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })} placeholder="Descrie produsul sau serviciul, starea și orice detaliu important..."/></label>
              <label>Subcategorie / marcă<input value={listingForm.subcategory} onChange={(e) => setListingForm({ ...listingForm, subcategory: e.target.value })} placeholder="Ex: Apple, dame, anvelope"/></label>
              <label>Stare<select value={listingForm.condition} onChange={(e) => setListingForm({ ...listingForm, condition: e.target.value as ListingCondition })}><option value="na">Nespecificat</option><option value="nou">Nou</option><option value="folosit">Folosit</option></select></label>
              <label>Preț (MDL)<input type="number" min="0" step="0.01" value={listingForm.price} onChange={(e) => setListingForm({ ...listingForm, price: e.target.value })} placeholder="0 = la discuție"/></label>
              <label>Punct de predare<input value={listingForm.pickupPoint} onChange={(e) => setListingForm({ ...listingForm, pickupPoint: e.target.value })} placeholder="Ex: oficiu, Ciocana"/></label>
              <label>Flux<select value={listingForm.flow} disabled={listingForm.listingType === 'caut'} onChange={(e) => setListingForm({ ...listingForm, flow: e.target.value as ListingFlow })}><option value="order">Comandă directă</option><option value="contact">Contact / discuție</option></select></label>
              {listingForm.flow === 'order' && <>
                <label>Unitate<select value={listingForm.unit} onChange={(e) => setListingForm({ ...listingForm, unit: e.target.value })}>{units.map((u) => <option key={u}>{u}</option>)}</select></label>
                <label>Stoc / cantitate<input type="number" min="0.01" step="0.01" required value={listingForm.stock} onChange={(e) => setListingForm({ ...listingForm, stock: e.target.value })}/></label>
              </>}
              <label className="checkbox-label"><input type="checkbox" checked={listingForm.negotiable} onChange={(e) => setListingForm({ ...listingForm, negotiable: e.target.checked })}/> Preț negociabil</label>
              <label className="full">Fotografii (maxim 2)<input type="file" accept="image/*" multiple onChange={(e) => setListingForm({ ...listingForm, images: Array.from(e.target.files || []).slice(0, 2) })}/><small>Imaginile se comprimă automat pentru a rămâne pe Firebase Spark gratuit.</small></label>
              <button className="primary-wide full" disabled={busy}>{busy ? 'Se publică...' : 'Publică în Orbico Market'}</button>
            </form>
          </div>
        </div>
      )}

      {orderListing && allowed && (
        <div className="market-modal-backdrop" onMouseDown={() => setOrderListing(null)}>
          <div className="market-modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOrderListing(null)}><X/></button>
            <div className="modal-icon">{requestMode === 'order' ? <ShoppingBag/> : <MessageCircle/>}</div>
            <h2>{requestMode === 'order' ? `Comandă ${orderListing.title}` : `Contactează ${orderListing.sellerName}`}</h2>
            <p>{requestMode === 'order' ? `${lei(orderListing.price)} / ${orderListing.unit}` : `Anunț: ${orderListing.title}`}</p>
            <form onSubmit={placeOrder}>
              {requestMode === 'order' && <label>Cantitate ({orderListing.unit})<input type="number" min="0.01" step="0.01" max={orderListing.stock} required value={orderForm.quantity} onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}/></label>}
              <label>Mesaj pentru coleg<textarea required={requestMode === 'contact'} value={orderForm.note} onChange={(e) => setOrderForm({ ...orderForm, note: e.target.value })} placeholder={requestMode === 'contact' ? 'Ex: Mai este disponibil? Când putem vorbi?' : 'Ex: adu-mi-o vineri la birou'}/></label>
              {requestMode === 'order' && <div className="order-total"><span>Total</span><strong>{lei(Number(orderForm.quantity || 0) * orderListing.price)}</strong></div>}
              <button className="primary-wide" disabled={busy}>{busy ? 'Se trimite...' : requestMode === 'order' ? 'Trimite comanda' : 'Trimite mesajul'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
