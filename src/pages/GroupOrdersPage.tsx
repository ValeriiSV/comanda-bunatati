import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingBasket,
  Store,
  Users,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { bucuriaPhotoCatalog } from '@/lib/bucuriaPhotoCatalog';
import './group-orders.css';

type Profile = {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  approved: boolean;
  blocked?: boolean;
  role: 'admin' | 'user';
};

type CampaignStatus = 'draft' | 'open' | 'closed' | 'sent' | 'received' | 'distributed';

type Campaign = {
  id: string;
  title: string;
  supplier: string;
  status: CampaignStatus;
  deadline?: string;
  deliveryDate?: string;
  notes?: string;
  createdAt?: any;
};

type CampaignProduct = {
  id: string;
  barcode: string;
  name: string;
  pack?: string;
  price: number;
  category?: string;
  unit?: 'buc' | 'kg';
  step?: number;
  source?: string;
  provisional?: boolean;
};

type OrderItem = {
  productId: string;
  barcode: string;
  name: string;
  pack?: string;
  price: number;
  qty: number;
  unit?: 'buc' | 'kg';
};

type CampaignOrder = {
  id: string;
  userId: string;
  userName: string;
  phone?: string;
  items: OrderItem[];
  total: number;
  status: 'submitted';
  updatedAt?: any;
};

const ADMIN_EMAIL = 'valerkasvetlicenco@icloud.com';

const statusLabels: Record<CampaignStatus, string> = {
  draft: 'În pregătire',
  open: 'Deschisă',
  closed: 'Închisă',
  sent: 'Trimisă furnizorului',
  received: 'Primită',
  distributed: 'Distribuită',
};

const lei = (value: number) => new Intl.NumberFormat('ro-MD', {
  style: 'currency',
  currency: 'MDL',
  maximumFractionDigits: 2,
}).format(value || 0);

function parsePrice(value: string) {
  const cleaned = value.trim().replace(/\s/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ăâ]/g, 'a')
    .replace(/[î]/g, 'i')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't');
}

function productId(barcode: string, name: string, pack = '') {
  const base = (barcode || `${name}-${pack}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `produs-${crypto.randomUUID().slice(0, 8)}`;
}

function parseCatalog(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [] as Omit<CampaignProduct, 'id'>[];

  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const rows = lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
  const first = rows[0].map(normalizeHeader);
  const hasHeader = first.some((cell) => /bar|cod|denum|nume|pret|price|ambal|pack|categ|unit/.test(cell));

  const findIndex = (patterns: RegExp[], fallback: number) => {
    const idx = first.findIndex((cell) => patterns.some((pattern) => pattern.test(cell)));
    return idx >= 0 ? idx : fallback;
  };

  const barcodeIndex = hasHeader ? findIndex([/bar/, /cod/, /ean/], 0) : 0;
  const nameIndex = hasHeader ? findIndex([/denum/, /nume/, /produs/], 1) : 1;
  const packIndex = hasHeader ? findIndex([/ambal/, /pack/, /buc/, /kg/], 2) : 2;
  const priceIndex = hasHeader ? findIndex([/pret/, /price/], 3) : 3;
  const categoryIndex = hasHeader ? findIndex([/categ/, /grupa/], 4) : 4;
  const unitIndex = hasHeader ? findIndex([/unit/, /uom/], -1) : -1;

  return rows.slice(hasHeader ? 1 : 0).map((row) => {
    const pack = row[packIndex] || '';
    const unitRaw = unitIndex >= 0 ? (row[unitIndex] || '').toLowerCase() : '';
    const unit: 'buc' | 'kg' = unitRaw.includes('kg') ? 'kg' : pack ? 'buc' : 'kg';
    return {
      barcode: row[barcodeIndex] || '',
      name: row[nameIndex] || '',
      pack,
      price: parsePrice(row[priceIndex] || ''),
      category: row[categoryIndex] || 'Bucuria',
      unit,
      step: unit === 'kg' ? 0.1 : 1,
      source: 'excel-import',
      provisional: false,
    };
  }).filter((item) => item.name && item.price > 0);
}

function roundQty(value: number, step: number) {
  const digits = step < 1 ? 1 : 0;
  return Number(Math.max(0, value).toFixed(digits));
}

export default function GroupOrdersPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [products, setProducts] = useState<CampaignProduct[]>([]);
  const [orders, setOrders] = useState<CampaignOrder[]>([]);
  const [myOrder, setMyOrder] = useState<CampaignOrder | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Toate');
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const approved = profile?.approved === true && profile?.blocked !== true;
  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase() === ADMIN_EMAIL;
  const selected = campaigns.find((item) => item.id === selectedId) || null;

  useEffect(() => onAuthStateChanged(auth, async (next) => {
    setUser(next);
    setProfile(null);
    if (!next) return;
    try {
      const snap = await getDoc(doc(db, 'marketUsers', next.uid));
      if (snap.exists()) setProfile(snap.data() as Profile);
    } catch (error) {
      setMessage(`Profilul nu poate fi încărcat: ${(error as Error).message}`);
    }
  }), []);

  useEffect(() => {
    if (!user || !approved) {
      setCampaigns([]);
      return;
    }
    return onSnapshot(collection(db, 'groupCampaigns'), (snapshot) => {
      const list = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Campaign));
      list.sort((a, b) => Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0));
      setCampaigns(list);
      setSelectedId((current) => current || list[0]?.id || '');
    }, (error) => setMessage(`Campaniile nu pot fi încărcate: ${error.message}`));
  }, [user, approved]);

  useEffect(() => {
    if (!selectedId || !approved) {
      setProducts([]);
      return;
    }
    return onSnapshot(collection(db, 'groupCampaigns', selectedId, 'products'), (snapshot) => {
      const list = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CampaignProduct));
      list.sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
      setProducts(list);
    });
  }, [selectedId, approved]);

  useEffect(() => {
    setOrders([]);
    setMyOrder(null);
    setQuantities({});
    if (!selectedId || !user || !approved) return;

    if (isAdmin) {
      return onSnapshot(collection(db, 'groupCampaigns', selectedId, 'orders'), (snapshot) => {
        const list = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CampaignOrder));
        setOrders(list);
        const mine = list.find((item) => item.userId === user.uid) || null;
        setMyOrder(mine);
        if (mine) setQuantities(Object.fromEntries(mine.items.map((item) => [item.productId, item.qty])));
      });
    }

    return onSnapshot(doc(db, 'groupCampaigns', selectedId, 'orders', user.uid), (snapshot) => {
      if (!snapshot.exists()) {
        setMyOrder(null);
        setQuantities({});
        return;
      }
      const order = { id: snapshot.id, ...snapshot.data() } as CampaignOrder;
      setMyOrder(order);
      setQuantities(Object.fromEntries(order.items.map((item) => [item.productId, item.qty])));
    });
  }, [selectedId, user, approved, isAdmin]);

  const categories = useMemo(() => ['Toate', ...Array.from(new Set(products.map((item) => item.category || 'Bucuria'))).sort()], [products]);

  const visibleProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products.filter((item) => {
      const text = `${item.name} ${item.barcode} ${item.category || ''} ${item.pack || ''}`.toLowerCase();
      return (category === 'Toate' || (item.category || 'Bucuria') === category)
        && (!needle || text.includes(needle));
    });
  }, [products, search, category]);

  const currentItems = useMemo(() => products
    .map((product) => ({ product, qty: Number(quantities[product.id] || 0) }))
    .filter((entry) => entry.qty > 0), [products, quantities]);

  const currentTotal = currentItems.reduce((sum, entry) => sum + entry.product.price * entry.qty, 0);

  const summary = useMemo(() => {
    const map = new Map<string, { name: string; barcode: string; qty: number; total: number; unit: string }>();
    orders.forEach((order) => order.items.forEach((item) => {
      const current = map.get(item.productId) || {
        name: item.name,
        barcode: item.barcode,
        qty: 0,
        total: 0,
        unit: item.unit || 'buc',
      };
      current.qty += item.qty;
      current.total += item.qty * item.price;
      map.set(item.productId, current);
    }));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  const seedPhotoCatalog = async (campaignId = selected?.id || 'bucuria') => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      bucuriaPhotoCatalog.forEach((item) => {
        const id = productId(item.barcode || '', item.name, item.pack || '');
        batch.set(doc(db, 'groupCampaigns', campaignId, 'products', id), {
          barcode: item.barcode || '',
          name: item.name,
          pack: item.pack || '',
          price: item.price,
          category: item.category,
          unit: item.unit || 'buc',
          step: item.step || 1,
          source: 'photo-list',
          provisional: true,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
      await batch.commit();
      setMessage(`${bucuriaPhotoCatalog.length} poziții Bucuria din fotografii au fost încărcate. Prețurile rămân provizorii până la Excel.`);
    } catch (error) {
      setMessage(`Catalogul foto nu a putut fi încărcat: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const createBucuria = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      await setDoc(doc(db, 'groupCampaigns', 'bucuria'), {
        title: 'Bucuria – Dulciuri',
        supplier: 'SOLDI SRL / SA Bucuria',
        status: 'draft',
        notes: 'Catalog provizoriu transcris din lista foto. Prețurile se reconfirmă la primirea Excelului oficial.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSelectedId('bucuria');
      setBusy(false);
      await seedPhotoCatalog('bucuria');
      setMessage(`Campania Bucuria a fost creată și ${bucuriaPhotoCatalog.length} poziții din poze au fost încărcate.`);
    } catch (error) {
      setMessage(`Campania nu a putut fi creată: ${(error as Error).message}`);
      setBusy(false);
    }
  };

  const setCampaignStatus = async (status: CampaignStatus) => {
    if (!isAdmin || !selected) return;
    setBusy(true);
    try {
      await setDoc(doc(db, 'groupCampaigns', selected.id), { status, updatedAt: serverTimestamp() }, { merge: true });
      setMessage(`Status schimbat: ${statusLabels[status]}.`);
    } finally {
      setBusy(false);
    }
  };

  const importCatalog = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAdmin || !selected) return;
    const parsed = parseCatalog(importText);
    if (!parsed.length) {
      setMessage('Nu am găsit rânduri valide. Folosește coloanele: Cod bare, Denumire, Ambalaj, Preț, Categorie, Unitate.');
      return;
    }
    setBusy(true);
    try {
      const batch = writeBatch(db);
      parsed.forEach((item) => {
        const id = productId(item.barcode, item.name, item.pack || '');
        batch.set(doc(db, 'groupCampaigns', selected.id, 'products', id), {
          ...item,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
      await batch.commit();
      setImportText('');
      setMessage(`${parsed.length} produse au fost importate/actualizate din Excel/CSV.`);
    } catch (error) {
      setMessage(`Importul nu a reușit: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const readCsvFile = async (file?: File) => {
    if (!file) return;
    try {
      setImportText(await file.text());
      setMessage('Fișierul a fost citit. Verifică datele și apasă Importă.');
    } catch {
      setMessage('Fișierul nu poate fi citit.');
    }
  };

  const changeQty = (product: CampaignProduct, delta: number) => {
    if (selected?.status !== 'open') return;
    const step = Number(product.step || (product.unit === 'kg' ? 0.1 : 1));
    setQuantities((current) => ({
      ...current,
      [product.id]: roundQty(Number(current[product.id] || 0) + delta * step, step),
    }));
  };

  const setQty = (product: CampaignProduct, value: number) => {
    const step = Number(product.step || (product.unit === 'kg' ? 0.1 : 1));
    setQuantities((current) => ({ ...current, [product.id]: roundQty(value, step) }));
  };

  const submitOrder = async () => {
    if (!user || !profile || !selected || selected.status !== 'open') return;
    const items: OrderItem[] = currentItems.map(({ product, qty }) => ({
      productId: product.id,
      barcode: product.barcode,
      name: product.name,
      pack: product.pack || '',
      price: product.price,
      qty,
      unit: product.unit || 'buc',
    }));
    if (!items.length) {
      setMessage('Adaugă cel puțin un produs.');
      return;
    }
    setBusy(true);
    try {
      await setDoc(doc(db, 'groupCampaigns', selected.id, 'orders', user.uid), {
        userId: user.uid,
        userName: profile.displayName,
        phone: profile.phone || '',
        items,
        total: currentTotal,
        status: 'submitted',
        updatedAt: serverTimestamp(),
      });
      setMessage('Comanda ta a fost salvată. O poți modifica până la închiderea campaniei.');
    } catch (error) {
      setMessage(`Comanda nu a putut fi salvată: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <main className="group-shell"><section className="group-empty">
        <ShoppingBasket size={46}/><h1>Comenzi comune</h1>
        <p>Intră în Orbico Market și autentifică-te pentru a participa.</p>
        <Link to="/">Înapoi la Orbico Market</Link>
      </section></main>
    );
  }

  if (!approved) {
    return (
      <main className="group-shell"><section className="group-empty">
        <Users size={46}/><h1>Contul trebuie aprobat</h1>
        <p>Comenzile comune sunt disponibile doar colegilor aprobați.</p>
        <Link to="/">Înapoi la Orbico Market</Link>
      </section></main>
    );
  }

  return (
    <main className="group-shell">
      <header className="group-topbar">
        <Link to="/" className="group-back"><ArrowLeft size={18}/> Orbico Market</Link>
        <div><span>ORBICO MARKET · INTERN</span><h1>Comenzi comune</h1></div>
      </header>

      {message && <button className="group-message" onClick={() => setMessage('')}>{message}</button>}

      <section className="campaign-grid">
        <Link to="/comanda" className="campaign-card legacy-campaign">
          <div className="campaign-icon"><Store size={28}/></div>
          <div><span>COMANDĂ COMUNĂ</span><h2>Comanda lunii</h2><p>Nuci, fructe uscate și bunătățile din modulul existent.</p></div>
          <strong>Deschide →</strong>
        </Link>

        {campaigns.map((campaign) => (
          <button key={campaign.id} className={`campaign-card ${selectedId === campaign.id ? 'active' : ''}`} onClick={() => { setSelectedId(campaign.id); setCategory('Toate'); }}>
            <div className="campaign-icon">🍫</div>
            <div><span>{campaign.supplier}</span><h2>{campaign.title}</h2><p>{campaign.notes || 'Comandă comună pentru colegi.'}</p></div>
            <strong className={`campaign-status status-${campaign.status}`}>{statusLabels[campaign.status]}</strong>
          </button>
        ))}

        {isAdmin && !campaigns.some((item) => item.id === 'bucuria') && (
          <button className="campaign-card create-campaign" onClick={createBucuria} disabled={busy}>
            <div className="campaign-icon">＋</div>
            <div><span>ADMIN</span><h2>Creează Bucuria</h2><p>Creează campania și încarcă automat pozițiile din cele trei fotografii.</p></div>
            <strong>Configurează</strong>
          </button>
        )}
      </section>

      {selected && (
        <>
          <section className="campaign-hero">
            <div>
              <span className="eyebrow">{selected.supplier}</span>
              <h2>{selected.title}</h2>
              <p>{selected.notes}</p>
              <div className="campaign-meta">
                <span><PackageCheck size={15}/> {products.length} poziții</span>
                <span><CalendarDays size={15}/> {statusLabels[selected.status]}</span>
                {products.some((item) => item.provisional) && <span className="provisional-chip">⚠ prețuri din lista foto</span>}
              </div>
            </div>
            {isAdmin && (
              <div className="status-actions">
                <button onClick={() => setCampaignStatus('draft')} disabled={busy}>Pregătire</button>
                <button onClick={() => setCampaignStatus('open')} disabled={busy || products.length === 0}>Deschide</button>
                <button onClick={() => setCampaignStatus('closed')} disabled={busy}>Închide</button>
                <button onClick={() => setCampaignStatus('sent')} disabled={busy}>Trimisă</button>
                <button onClick={() => setCampaignStatus('received')} disabled={busy}>Primită</button>
                <button onClick={() => setCampaignStatus('distributed')} disabled={busy}>Distribuită</button>
              </div>
            )}
          </section>

          {isAdmin && (
            <section className="import-panel">
              <div className="section-title"><FileSpreadsheet size={22}/><div><h3>Catalog Bucuria</h3><p>Poți încărca pozițiile foto acum; Excelul oficial le va actualiza ulterior.</p></div></div>
              <div className="photo-seed-row">
                <button className="primary" onClick={() => seedPhotoCatalog()} disabled={busy}>Încarcă / actualizează pozițiile din poze ({bucuriaPhotoCatalog.length})</button>
                <span>Catalog provizoriu. Verifică prețurile înainte de a deschide campania.</span>
              </div>
              <form onSubmit={importCatalog}>
                <textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={'Cod bare\tDenumire\tAmbalaj\tPreț\tCategorie\tUnitate'} />
                <div className="import-actions">
                  <label className="file-button"><input type="file" accept=".csv,.txt" onChange={(event) => readCsvFile(event.target.files?.[0])}/> Alege CSV</label>
                  <button className="primary" disabled={busy || !importText.trim()}>Importă / actualizează</button>
                </div>
              </form>
            </section>
          )}

          <section className="catalog-section catalog-shop">
            <div className="catalog-toolbar">
              <label className="search-box"><Search size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Caută Bucuria, cod de bare, categorie..." /></label>
              <div className="my-total"><span>Totalul meu</span><strong>{lei(currentTotal)}</strong></div>
            </div>

            <div className="bucuria-categories">
              {categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
            </div>

            {visibleProducts.length > 0 ? (
              <div className="bucuria-grid">
                {visibleProducts.map((product) => {
                  const qty = Number(quantities[product.id] || 0);
                  const step = Number(product.step || (product.unit === 'kg' ? 0.1 : 1));
                  return (
                    <article className={`bucuria-product ${qty > 0 ? 'selected' : ''}`} key={product.id}>
                      <div className="bucuria-product-top"><span>{product.category || 'Bucuria'}</span>{product.provisional && <small>foto</small>}</div>
                      <h3>{product.name}</h3>
                      <p>{product.pack || (product.unit === 'kg' ? 'vrac / kg' : 'bucată')}</p>
                      {product.barcode && <code>{product.barcode}</code>}
                      <div className="bucuria-price"><strong>{lei(product.price)}</strong><span>/ {product.unit || 'buc'}</span></div>
                      <div className="qty-stepper">
                        <button onClick={() => changeQty(product, -1)} disabled={selected.status !== 'open' || qty <= 0}><Minus size={17}/></button>
                        <input type="number" min="0" step={step} value={qty || ''} placeholder="0" disabled={selected.status !== 'open'} onChange={(event) => setQty(product, Number(event.target.value || 0))}/>
                        <button onClick={() => changeQty(product, 1)} disabled={selected.status !== 'open'}><Plus size={17}/></button>
                      </div>
                      <div className="line-total">{qty > 0 ? `${qty} ${product.unit || 'buc'} · ${lei(product.price * qty)}` : 'Adaugă în comandă'}</div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="group-empty compact"><Search size={35}/><h2>Nu am găsit produse</h2><p>Schimbă categoria sau termenul de căutare.</p></div>
            )}

            <div className="submit-bar sticky-order-bar">
              <div><ShoppingBasket size={20}/><span>{currentItems.length} poziții selectate</span><strong>{lei(currentTotal)}</strong>{myOrder && <small><CheckCircle2 size={14}/> comandă salvată</small>}</div>
              <button className="primary" onClick={submitOrder} disabled={busy || selected.status !== 'open' || currentItems.length === 0}>{myOrder ? 'Actualizează comanda' : 'Trimite comanda'}</button>
            </div>
            {selected.status !== 'open' && <p className="order-locked-note">Comanda nu este încă deschisă. Administratorul o poate deschide după verificarea prețurilor.</p>}
          </section>

          {isAdmin && (
            <section className="admin-summary">
              <div className="section-title"><Users size={22}/><div><h3>Centralizare administrator</h3><p>{orders.length} colegi au trimis comanda.</p></div></div>
              <div className="summary-grid">
                <div className="summary-card"><span>Total comenzi</span><strong>{orders.length}</strong></div>
                <div className="summary-card"><span>Valoare totală</span><strong>{lei(orders.reduce((sum, item) => sum + Number(item.total || 0), 0))}</strong></div>
              </div>
              <div className="product-table-wrap">
                <table className="product-table"><thead><tr><th>Produs</th><th>Cod</th><th>Cantitate totală</th><th>Valoare</th></tr></thead><tbody>
                  {summary.map((item) => <tr key={`${item.barcode}-${item.name}`}><td><strong>{item.name}</strong></td><td>{item.barcode || '—'}</td><td>{Number(item.qty.toFixed(2))} {item.unit}</td><td>{lei(item.total)}</td></tr>)}
                  {summary.length === 0 && <tr><td colSpan={4}>Încă nu sunt comenzi.</td></tr>}
                </tbody></table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
