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
  ClipboardPaste,
  FileSpreadsheet,
  PackageCheck,
  Search,
  ShoppingBasket,
  Store,
  Users,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
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
};

type OrderItem = {
  productId: string;
  barcode: string;
  name: string;
  pack?: string;
  price: number;
  qty: number;
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

function productId(barcode: string, name: string) {
  const base = (barcode || name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base || `produs-${Date.now()}`;
}

function parseCatalog(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [] as Omit<CampaignProduct, 'id'>[];

  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const rows = lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
  const first = rows[0].map(normalizeHeader);
  const hasHeader = first.some((cell) => /bar|cod|denum|nume|pret|price|ambal|pack|categ/.test(cell));

  const findIndex = (patterns: RegExp[], fallback: number) => {
    const idx = first.findIndex((cell) => patterns.some((pattern) => pattern.test(cell)));
    return idx >= 0 ? idx : fallback;
  };

  const barcodeIndex = hasHeader ? findIndex([/bar/, /cod/, /ean/], 0) : 0;
  const nameIndex = hasHeader ? findIndex([/denum/, /nume/, /produs/], 1) : 1;
  const packIndex = hasHeader ? findIndex([/ambal/, /pack/, /buc/, /kg/], 2) : 2;
  const priceIndex = hasHeader ? findIndex([/pret/, /price/], 3) : 3;
  const categoryIndex = hasHeader ? findIndex([/categ/, /grupa/], 4) : 4;

  return rows.slice(hasHeader ? 1 : 0).map((row) => ({
    barcode: row[barcodeIndex] || '',
    name: row[nameIndex] || '',
    pack: row[packIndex] || '',
    price: parsePrice(row[priceIndex] || ''),
    category: row[categoryIndex] || '',
  })).filter((item) => item.name && item.price > 0);
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
      list.sort((a, b) => String(b.createdAt?.seconds || '').localeCompare(String(a.createdAt?.seconds || '')));
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
      list.sort((a, b) => a.name.localeCompare(b.name));
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

  const visibleProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((item) => `${item.name} ${item.barcode} ${item.category || ''}`.toLowerCase().includes(needle));
  }, [products, search]);

  const currentItems = useMemo(() => products
    .map((product) => ({ product, qty: Number(quantities[product.id] || 0) }))
    .filter((entry) => entry.qty > 0), [products, quantities]);

  const currentTotal = currentItems.reduce((sum, entry) => sum + entry.product.price * entry.qty, 0);

  const summary = useMemo(() => {
    const map = new Map<string, { name: string; barcode: string; qty: number; total: number }>();
    orders.forEach((order) => order.items.forEach((item) => {
      const current = map.get(item.productId) || { name: item.name, barcode: item.barcode, qty: 0, total: 0 };
      current.qty += item.qty;
      current.total += item.qty * item.price;
      map.set(item.productId, current);
    }));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  const createBucuria = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      await setDoc(doc(db, 'groupCampaigns', 'bucuria'), {
        title: 'Bucuria – Dulciuri',
        supplier: 'SOLDI SRL / SA Bucuria',
        status: 'draft',
        notes: 'Lista de preț din 10.02.2025 este doar referință. Importă lista actuală înainte de deschiderea comenzilor.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSelectedId('bucuria');
      setMessage('Campania Bucuria a fost creată în modul „În pregătire”.');
    } catch (error) {
      setMessage(`Campania nu a putut fi creată: ${(error as Error).message}`);
    } finally {
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
      setMessage('Nu am găsit rânduri valide. Folosește coloanele: Cod bare, Denumire, Ambalaj, Preț, Categorie.');
      return;
    }
    setBusy(true);
    try {
      const batch = writeBatch(db);
      parsed.forEach((item) => {
        const id = productId(item.barcode, item.name);
        batch.set(doc(db, 'groupCampaigns', selected.id, 'products', id), {
          ...item,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
      await batch.commit();
      setImportText('');
      setMessage(`${parsed.length} produse au fost importate/actualizate.`);
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
      setMessage('Fișierul a fost citit. Verifică tabelul și apasă Importă.');
    } catch {
      setMessage('Fișierul nu poate fi citit.');
    }
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
      <main className="group-shell">
        <section className="group-empty">
          <ShoppingBasket size={46} />
          <h1>Comenzi comune</h1>
          <p>Intră în Orbico Market și autentifică-te pentru a participa.</p>
          <Link to="/">Înapoi la Orbico Market</Link>
        </section>
      </main>
    );
  }

  if (!approved) {
    return (
      <main className="group-shell">
        <section className="group-empty">
          <Users size={46} />
          <h1>Contul trebuie aprobat</h1>
          <p>Comenzile comune sunt disponibile doar colegilor aprobați.</p>
          <Link to="/">Înapoi la Orbico Market</Link>
        </section>
      </main>
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
          <div><span>MODUL EXISTENT</span><h2>Comanda lunii</h2><p>Bunătăți, nuci, fructe uscate și produsele din comanda actuală.</p></div>
          <strong>Deschide →</strong>
        </Link>

        {campaigns.map((campaign) => (
          <button key={campaign.id} className={`campaign-card ${selectedId === campaign.id ? 'active' : ''}`} onClick={() => setSelectedId(campaign.id)}>
            <div className="campaign-icon">🍫</div>
            <div><span>{campaign.supplier}</span><h2>{campaign.title}</h2><p>{campaign.notes || 'Comandă comună pentru colegi.'}</p></div>
            <strong className={`campaign-status status-${campaign.status}`}>{statusLabels[campaign.status]}</strong>
          </button>
        ))}

        {isAdmin && !campaigns.some((item) => item.id === 'bucuria') && (
          <button className="campaign-card create-campaign" onClick={createBucuria} disabled={busy}>
            <div className="campaign-icon">＋</div>
            <div><span>ADMIN</span><h2>Creează Bucuria</h2><p>Pregătește campania pentru importul listei actuale de preț.</p></div>
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
                <span><CalendarDays size={16}/> {statusLabels[selected.status]}</span>
                <span><ShoppingBasket size={16}/> {products.length} produse</span>
                {isAdmin && <span><Users size={16}/> {orders.length} comenzi</span>}
              </div>
            </div>
            {isAdmin && (
              <div className="status-actions">
                <button onClick={() => setCampaignStatus('draft')} disabled={busy}>Pregătire</button>
                <button className="primary" onClick={() => setCampaignStatus('open')} disabled={busy || products.length === 0}>Deschide</button>
                <button onClick={() => setCampaignStatus('closed')} disabled={busy}>Închide</button>
                <button onClick={() => setCampaignStatus('sent')} disabled={busy}>Trimisă</button>
                <button onClick={() => setCampaignStatus('received')} disabled={busy}>Primită</button>
                <button onClick={() => setCampaignStatus('distributed')} disabled={busy}>Distribuită</button>
              </div>
            )}
          </section>

          {isAdmin && (
            <section className="import-panel">
              <div className="section-title"><FileSpreadsheet size={22}/><div><h3>Import catalog</h3><p>Copiază direct din Excel sau încarcă CSV. Coloane recomandate: Cod bare | Denumire | Ambalaj | Preț | Categorie.</p></div></div>
              <form onSubmit={importCatalog}>
                <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={'Cod bare\tDenumire\tAmbalaj\tPreț\tCategorie\n4840095000000\tExemplu produs\t3\t52,43\tCaramele'} />
                <div className="import-actions">
                  <label className="file-button"><FileSpreadsheet size={17}/> Alege CSV<input type="file" accept=".csv,.txt,.tsv" onChange={(e) => readCsvFile(e.target.files?.[0])}/></label>
                  <button className="primary" type="submit" disabled={busy || !importText.trim()}><ClipboardPaste size={17}/> Importă / actualizează</button>
                </div>
              </form>
            </section>
          )}

          {products.length > 0 && (
            <section className="catalog-section">
              <div className="catalog-toolbar">
                <div className="search-box"><Search size={18}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Caută produs sau cod de bare..." /></div>
                <div className="my-total"><span>Totalul meu</span><strong>{lei(currentTotal)}</strong></div>
              </div>

              <div className="product-table-wrap">
                <table className="product-table">
                  <thead><tr><th>Produs</th><th>Cod</th><th>Ambalaj</th><th>Preț</th><th>Cantitate</th><th>Total</th></tr></thead>
                  <tbody>
                    {visibleProducts.map((product) => {
                      const qty = Number(quantities[product.id] || 0);
                      return (
                        <tr key={product.id}>
                          <td><strong>{product.name}</strong>{product.category && <small>{product.category}</small>}</td>
                          <td>{product.barcode || '—'}</td>
                          <td>{product.pack || '—'}</td>
                          <td>{lei(product.price)}</td>
                          <td><input className="qty-input" type="number" min="0" step="1" value={qty || ''} disabled={selected.status !== 'open'} onChange={(e) => setQuantities((current) => ({ ...current, [product.id]: Math.max(0, Number(e.target.value || 0)) }))}/></td>
                          <td><strong>{qty > 0 ? lei(product.price * qty) : '—'}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="submit-bar">
                <div><span>{currentItems.length} poziții</span><strong>{lei(currentTotal)}</strong>{myOrder && <small><CheckCircle2 size={14}/> Comandă salvată</small>}</div>
                <button className="primary" onClick={submitOrder} disabled={busy || selected.status !== 'open' || currentItems.length === 0}>{myOrder ? 'Actualizează comanda' : 'Trimite comanda'}</button>
              </div>
            </section>
          )}

          {products.length === 0 && (
            <section className="group-empty compact">
              <PackageCheck size={40}/>
              <h2>Catalogul este în pregătire</h2>
              <p>Lista din fotografia din 10.02.2025 nu este publicată ca preț actual. Adminul va importa lista nouă când o primește de la furnizor.</p>
            </section>
          )}

          {isAdmin && orders.length > 0 && (
            <section className="admin-summary">
              <div className="section-title"><Users size={22}/><div><h3>Centralizare pentru furnizor</h3><p>{orders.length} colegi au salvat comenzi.</p></div></div>
              <div className="summary-grid">
                <div className="summary-card"><span>Total comenzi</span><strong>{lei(orders.reduce((sum, order) => sum + Number(order.total || 0), 0))}</strong></div>
                <div className="summary-card"><span>Poziții distincte</span><strong>{summary.length}</strong></div>
              </div>
              <div className="product-table-wrap">
                <table className="product-table"><thead><tr><th>Produs</th><th>Cod</th><th>Cantitate totală</th><th>Valoare</th></tr></thead><tbody>{summary.map((item) => <tr key={`${item.barcode}-${item.name}`}><td><strong>{item.name}</strong></td><td>{item.barcode || '—'}</td><td><strong>{item.qty}</strong></td><td>{lei(item.total)}</td></tr>)}</tbody></table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
