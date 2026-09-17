import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import {
  ArrowLeft,
  Check,
  CircleDollarSign,
  ClipboardList,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { bucuriaPhotoCatalog } from '@/lib/bucuriaPhotoCatalog';
import './bucuria-admin-pages.css';

type Profile = { role?: string };
type Status = 'draft' | 'open' | 'closed' | 'sent' | 'received' | 'distributed';
type Campaign = { status?: Status; title?: string; supplier?: string; deadline?: string; notes?: string };
type Item = { productId: string; name: string; barcode?: string; pack?: string; qty: number; price: number; unit?: 'buc' | 'kg' };
type Order = { id: string; userId: string; userName: string; phone?: string; items: Item[]; total: number; status: string; paid?: boolean; updatedAt?: any };
type Product = { id: string; name: string; barcode?: string; pack?: string; price: number; category?: string; unit?: 'buc' | 'kg'; step?: number; active?: boolean; source?: string };
type ProductDraft = { name: string; barcode: string; pack: string; price: string; category: string; unit: 'buc' | 'kg'; step: string; active: boolean };

const ADMIN_EMAIL = 'valerkasvetlicenco@icloud.com';
const statuses: Status[] = ['draft', 'open', 'closed', 'sent', 'received', 'distributed'];
const labels: Record<Status, string> = {
  draft: 'În pregătire',
  open: 'Deschisă',
  closed: 'Închisă',
  sent: 'Trimisă furnizorului',
  received: 'Primită',
  distributed: 'Distribuită',
};
const emptyProduct: ProductDraft = { name: '', barcode: '', pack: '', price: '', category: 'Bucuria', unit: 'buc', step: '1', active: true };
const money = (value: number) => `${new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 2 }).format(value || 0)} lei`;
const qtyLabel = (qty: number, unit = 'buc') => `${qty.toLocaleString('ro-MD', { maximumFractionDigits: 2 })} ${unit}`;
const safeId = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
const timeValue = (value: any) => typeof value?.toMillis === 'function' ? value.toMillis() : 0;
const roundQty = (value: number) => Math.round(value * 1000) / 1000;

export default function BucuriaManagerPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isAdmin, setIsAdmin] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [orderEditId, setOrderEditId] = useState<string | null>(null);
  const [orderDraft, setOrderDraft] = useState<Item[]>([]);
  const [orderProductToAdd, setOrderProductToAdd] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productEditId, setProductEditId] = useState<string | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProduct);

  useEffect(() => onAuthStateChanged(auth, async (next) => {
    setUser(next);
    setIsAdmin(false);
    if (!next) return;
    if (next.email?.toLowerCase() === ADMIN_EMAIL) { setIsAdmin(true); return; }
    try {
      const snap = await getDoc(doc(db, 'marketUsers', next.uid));
      setIsAdmin(snap.exists() && (snap.data() as Profile).role === 'admin');
    } catch {
      setIsAdmin(false);
    }
  }), []);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribeCampaign = onSnapshot(doc(db, 'groupCampaigns', 'bucuria'), (snap) => {
      const data = snap.exists() ? snap.data() as Campaign : null;
      setCampaign(data);
      setDeadline(data?.deadline || '');
      setNotes(data?.notes || '');
    }, (error) => setMessage(error.message));

    const unsubscribeOrders = onSnapshot(collection(db, 'groupCampaigns', 'bucuria', 'orders'), (snap) => {
      setOrders(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Order)).sort((a, b) => timeValue(b.updatedAt) - timeValue(a.updatedAt)));
    }, (error) => setMessage(error.message));

    const unsubscribeProducts = onSnapshot(collection(db, 'groupCampaigns', 'bucuria', 'products'), (snap) => {
      setProducts(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Product)).sort((a, b) => a.name.localeCompare(b.name, 'ro')));
    }, (error) => setMessage(error.message));

    return () => {
      unsubscribeCampaign();
      unsubscribeOrders();
      unsubscribeProducts();
    };
  }, [isAdmin]);

  const total = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const paidTotal = orders.filter((order) => order.paid).reduce((sum, order) => sum + Number(order.total || 0), 0);
  const unpaidTotal = Math.max(0, total - paidTotal);
  const unpaidCount = orders.filter((order) => !order.paid).length;

  const summary = useMemo(() => {
    const map = new Map<string, { productId: string; name: string; barcode?: string; qty: number; total: number; unit?: string }>();
    orders.forEach((order) => order.items.forEach((item) => {
      const current = map.get(item.productId) || {
        productId: item.productId,
        name: item.name,
        barcode: item.barcode,
        qty: 0,
        total: 0,
        unit: item.unit,
      };
      current.qty += Number(item.qty || 0);
      current.total += Number(item.qty || 0) * Number(item.price || 0);
      map.set(item.productId, current);
    }));
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [orders]);

  const topProducts = summary.slice(0, 5);
  const filteredProducts = useMemo(() => {
    const needle = productSearch.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((product) => `${product.name} ${product.barcode || ''} ${product.category || ''}`.toLowerCase().includes(needle));
  }, [products, productSearch]);
  const availableOrderProducts = products.filter((product) => product.active !== false);
  const orderDraftTotal = orderDraft.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);

  const changeStatus = async (status: Status) => {
    setBusy(true);
    try {
      await setDoc(doc(db, 'groupCampaigns', 'bucuria'), { status, updatedAt: serverTimestamp() }, { merge: true });
      setMessage(`Status schimbat: ${labels[status]}.`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveCampaign = async () => {
    setBusy(true);
    try {
      await setDoc(doc(db, 'groupCampaigns', 'bucuria'), { deadline, notes, updatedAt: serverTimestamp() }, { merge: true });
      setMessage('Termenul și mesajul campaniei au fost salvate.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const togglePaid = async (order: Order) => {
    try {
      await setDoc(doc(db, 'groupCampaigns', 'bucuria', 'orders', order.id), {
        paid: !order.paid,
        managerUpdatedAt: serverTimestamp(),
      }, { merge: true });
      setMessage(order.paid ? 'Comanda a fost marcată neachitată.' : 'Comanda a fost marcată achitată.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const removeOrder = async (order: Order) => {
    if (!window.confirm(`Ștergi comanda lui ${order.userName}?`)) return;
    try {
      await deleteDoc(doc(db, 'groupCampaigns', 'bucuria', 'orders', order.id));
      setMessage('Comanda a fost ștearsă.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const startOrderEdit = (order: Order) => {
    setOrderEditId(order.id);
    setOrderDraft(order.items.map((item) => ({ ...item })));
    setOrderProductToAdd('');
  };

  const cancelOrderEdit = () => {
    setOrderEditId(null);
    setOrderDraft([]);
    setOrderProductToAdd('');
  };

  const addOrderItem = () => {
    const product = products.find((item) => item.id === orderProductToAdd);
    if (!product) return;
    const step = Number(product.step || (product.unit === 'kg' ? 0.1 : 1));
    setOrderDraft((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) => item.productId === product.id
          ? { ...item, qty: roundQty(Number(item.qty || 0) + step), price: Number(product.price || item.price) }
          : item);
      }
      return [...current, {
        productId: product.id,
        name: product.name,
        barcode: product.barcode || '',
        pack: product.pack || '',
        qty: step,
        price: Number(product.price || 0),
        unit: product.unit || 'buc',
      }];
    });
    setOrderProductToAdd('');
  };

  const saveOrderEdit = async (order: Order) => {
    const items = orderDraft.filter((item) => Number(item.qty) > 0);
    if (!items.length) {
      setMessage('Comanda trebuie să conțină cel puțin un produs.');
      return;
    }
    const nextTotal = items.reduce((sum, item) => sum + Number(item.qty) * Number(item.price), 0);
    try {
      await setDoc(doc(db, 'groupCampaigns', 'bucuria', 'orders', order.id), {
        items,
        total: nextTotal,
        managerUpdatedAt: serverTimestamp(),
      }, { merge: true });
      cancelOrderEdit();
      setMessage('Comanda a fost actualizată și totalul a fost recalculat.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const exportCsv = () => {
    const rows: string[][] = [['Colegul', 'Telefon', 'Achitat', 'Produs', 'Cod bare', 'Cantitate', 'Unitate', 'Pret', 'Subtotal']];
    orders.forEach((order) => order.items.forEach((item) => rows.push([
      order.userName,
      order.phone || '',
      order.paid ? 'DA' : 'NU',
      item.name,
      item.barcode || '',
      String(item.qty),
      item.unit || 'buc',
      String(item.price),
      String(item.qty * item.price),
    ])));
    const csv = '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `bucuria-comenzi-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const seedCatalog = async () => {
    if (!window.confirm('Actualizezi catalogul Bucuria cu pozițiile din fotografii?')) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      bucuriaPhotoCatalog.forEach((product, index) => {
        const id = safeId(`${product.barcode || 'fara-cod'}-${product.name}-${product.pack || ''}-${index}`);
        batch.set(doc(db, 'groupCampaigns', 'bucuria', 'products', id), {
          ...product,
          active: true,
          source: 'photo-list-2025',
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
      await batch.commit();
      setMessage(`${bucuriaPhotoCatalog.length} poziții au fost actualizate.`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startProductEdit = (product?: Product) => {
    if (!product) {
      setProductEditId('new');
      setProductDraft(emptyProduct);
      return;
    }
    setProductEditId(product.id);
    setProductDraft({
      name: product.name,
      barcode: product.barcode || '',
      pack: product.pack || '',
      price: String(product.price || ''),
      category: product.category || 'Bucuria',
      unit: product.unit || 'buc',
      step: String(product.step || (product.unit === 'kg' ? 0.1 : 1)),
      active: product.active !== false,
    });
  };

  const saveProduct = async () => {
    if (!productDraft.name.trim() || Number(productDraft.price) < 0) {
      setMessage('Completează denumirea și un preț valid.');
      return;
    }
    const id = productEditId === 'new' ? safeId(`${productDraft.barcode || productDraft.name}-${Date.now()}`) : productEditId!;
    try {
      await setDoc(doc(db, 'groupCampaigns', 'bucuria', 'products', id), {
        name: productDraft.name.trim(),
        barcode: productDraft.barcode.trim(),
        pack: productDraft.pack.trim(),
        price: Number(productDraft.price),
        category: productDraft.category.trim() || 'Bucuria',
        unit: productDraft.unit,
        step: Number(productDraft.step) || (productDraft.unit === 'kg' ? 0.1 : 1),
        active: productDraft.active,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setProductEditId(null);
      setMessage('Produsul a fost salvat.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const toggleProduct = async (product: Product) => {
    try {
      await setDoc(doc(db, 'groupCampaigns', 'bucuria', 'products', product.id), {
        active: product.active === false,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const removeProduct = async (product: Product) => {
    if (!window.confirm(`Ștergi ${product.name}?`)) return;
    try {
      await deleteDoc(doc(db, 'groupCampaigns', 'bucuria', 'products', product.id));
      setMessage('Produsul a fost șters.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  if (!user) {
    return <main className="bucuria-page-shell"><section className="bucuria-page-card empty"><h1>Manager Bucuria</h1><p>Autentifică-te ca administrator.</p><Link to="/">Orbico Market</Link></section></main>;
  }
  if (!isAdmin) {
    return <main className="bucuria-page-shell"><section className="bucuria-page-card empty"><h1>Acces administrator</h1><p>Pagina Manager este disponibilă doar administratorului Orbico Market.</p><Link to="/bucuria">Înapoi la Bucuria</Link></section></main>;
  }

  return <main className="bucuria-page-shell manager-full">
    <header className="bucuria-page-head manager-head">
      <Link to="/bucuria"><ArrowLeft size={18}/> Bucuria</Link>
      <div><span>CONTROL CENTER · BUCURIA</span><h1>Manager Bucuria</h1><p>SOLDI SRL / SA Bucuria</p></div>
      <div className="manager-head-actions">
        <button onClick={() => window.location.reload()}><RefreshCw size={16}/> Actualizează</button>
        <button onClick={exportCsv}><Download size={16}/> Export CSV</button>
        <Link to="/admin/mia"><CircleDollarSign size={16}/> MIA</Link>
      </div>
    </header>

    {message && <button className="bucuria-page-message" onClick={() => setMessage('')}>{message}</button>}

    <section className="manager-kpis">
      <article><Users size={20}/><span>Comenzi luna aceasta</span><strong>{orders.length}</strong></article>
      <article><ClipboardList size={20}/><span>Total comandat</span><strong>{money(total)}</strong></article>
      <article><Check size={20}/><span>Încasat</span><strong>{money(paidTotal)}</strong></article>
      <article><CircleDollarSign size={20}/><span>Neachitate</span><strong>{money(unpaidTotal)}</strong><small>{unpaidCount} comenzi</small></article>
    </section>

    <section className="manager-grid-two">
      <article className="bucuria-page-card manager-card">
        <div className="bucuria-page-title"><div><span>TOP PRODUSE</span><h2>Cele mai comandate</h2></div></div>
        <div className="manager-top-products">
          {topProducts.length ? topProducts.map((item) => <div key={item.productId}>
            <div><strong>{item.name}</strong><small>{qtyLabel(item.qty, item.unit)}</small></div>
            <b>{money(item.total)}</b>
            <i style={{ width: `${Math.max(8, (item.total / Math.max(topProducts[0]?.total || 1, 1)) * 100)}%` }}/>
          </div>) : <p>Nu sunt date încă.</p>}
        </div>
      </article>

      <article className="bucuria-page-card manager-card">
        <div className="bucuria-page-title"><div><span>FLUXUL COMENZILOR</span><h2>Activitate recentă</h2></div></div>
        <div className="manager-flow">
          {orders.slice(0, 6).map((order) => <div key={order.id}>
            <span className={order.paid ? 'flow-dot paid' : 'flow-dot'}/>
            <div><strong>{order.userName}</strong><small>{order.items.length} poziții · {order.paid ? 'achitată' : 'neachitată'}</small></div>
            <b>{money(order.total)}</b>
          </div>)}
          {!orders.length && <p>Nu sunt comenzi încă.</p>}
        </div>
      </article>
    </section>

    <section className="bucuria-page-card manager-card">
      <div className="bucuria-page-title"><div><span>PANOUL MANAGERULUI</span><h2>Controlul campaniei</h2></div></div>
      <div className="manager-campaign-fields">
        <label><span>Termen limită</span><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)}/></label>
        <label className="wide"><span>Mesaj pentru colegi</span><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: Comanda se închide vineri la 15:00"/></label>
        <button onClick={saveCampaign} disabled={busy}><Save size={16}/> Salvează</button>
      </div>
      <div className="bucuria-status-buttons manager-statuses">
        {statuses.map((status) => <button key={status} className={campaign?.status === status ? 'active' : ''} onClick={() => changeStatus(status)} disabled={busy}>{labels[status]}</button>)}
      </div>
    </section>

    <section className="bucuria-page-card manager-card">
      <div className="bucuria-page-title"><div><span>COMENZI COLEGI</span><h2>Gestionarea comenzilor</h2><p>Marchează plata, modifică pozițiile sau șterge o comandă.</p></div></div>
      <div className="manager-orders">
        {orders.length === 0 ? <p>Nu sunt comenzi încă.</p> : orders.map((order) => <article key={order.id}>
          <div className="manager-order-head">
            <div><strong>{order.userName}</strong><small>{order.phone || 'Fără telefon'} · {order.items.length} poziții</small></div>
            <b>{money(order.total)}</b>
          </div>
          <div className="manager-order-actions">
            <button className={order.paid ? 'paid' : ''} onClick={() => togglePaid(order)}><Check size={15}/> {order.paid ? 'Achitată' : 'Marchează achitată'}</button>
            <button onClick={() => startOrderEdit(order)}><Pencil size={15}/> Modifică</button>
            <button className="danger" onClick={() => removeOrder(order)}><Trash2 size={15}/> Șterge</button>
          </div>

          {orderEditId === order.id && <div className="manager-order-edit">
            <div className="edit-items">
              {orderDraft.map((item, index) => <label key={`${item.productId}-${index}`}>
                <span>{item.name}</span>
                <input type="number" min="0" step={item.unit === 'kg' ? '0.1' : '1'} value={item.qty} onChange={(event) => setOrderDraft((current) => current.map((entry, i) => i === index ? { ...entry, qty: Number(event.target.value) } : entry))}/>
                <small>{item.unit || 'buc'} · {money(item.price)} / {item.unit || 'buc'}</small>
              </label>)}
            </div>

            <div className="order-add-row">
              <select value={orderProductToAdd} onChange={(event) => setOrderProductToAdd(event.target.value)}>
                <option value="">Adaugă alt produs în comandă…</option>
                {availableOrderProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.price)}</option>)}
              </select>
              <button onClick={addOrderItem} disabled={!orderProductToAdd}><Plus size={15}/> Adaugă</button>
              <strong>Total recalculat: {money(orderDraftTotal)}</strong>
            </div>

            <div className="edit-actions">
              <button onClick={cancelOrderEdit}><X size={15}/> Anulează</button>
              <button className="primary" onClick={() => saveOrderEdit(order)}><Save size={15}/> Salvează comanda</button>
            </div>
          </div>}
        </article>)}
      </div>
    </section>

    <section className="manager-grid-two">
      <article className="bucuria-page-card manager-card">
        <div className="bucuria-page-title"><div><span>CENTRALIZARE</span><h2>Total pe produs</h2></div></div>
        <div className="bucuria-summary-list">
          {summary.length === 0 ? <p>Centralizarea va apărea după primele comenzi.</p> : summary.map((item) => <div key={item.productId}>
            <div><strong>{item.name}</strong><small>{item.barcode || 'fără cod'}</small></div>
            <span>{qtyLabel(item.qty, item.unit)}</span>
            <b>{money(item.total)}</b>
          </div>)}
        </div>
      </article>

      <article className="bucuria-page-card manager-card">
        <div className="bucuria-page-title">
          <div><span>CATALOG</span><h2>{products.length} produse</h2></div>
          <button className="manager-inline-btn" onClick={seedCatalog} disabled={busy}><RefreshCw size={15}/> Lista foto</button>
        </div>
        <label className="manager-search"><Search size={16}/><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Caută produs sau cod..."/></label>
        <div className="manager-product-list">
          {filteredProducts.slice(0, 30).map((product) => <div key={product.id}>
            <div><strong>{product.name}</strong><small>{product.barcode || 'fără cod'} · {product.category || 'Bucuria'}</small></div>
            <span>{money(product.price)}</span>
            <button onClick={() => toggleProduct(product)}>{product.active === false ? 'Ascuns' : 'Activ'}</button>
            <button onClick={() => startProductEdit(product)}><Pencil size={14}/></button>
            <button className="danger" onClick={() => removeProduct(product)}><Trash2 size={14}/></button>
          </div>)}
        </div>
        <button className="manager-add-product" onClick={() => startProductEdit()}><Plus size={16}/> Produs nou</button>
      </article>
    </section>

    {productEditId && <section className="bucuria-page-card manager-card product-editor">
      <div className="bucuria-page-title"><div><span>CATALOG</span><h2>{productEditId === 'new' ? 'Produs nou' : 'Modifică produsul'}</h2></div></div>
      <div className="product-form">
        <label><span>Denumire</span><input value={productDraft.name} onChange={(event) => setProductDraft({ ...productDraft, name: event.target.value })}/></label>
        <label><span>Cod bare</span><input value={productDraft.barcode} onChange={(event) => setProductDraft({ ...productDraft, barcode: event.target.value })}/></label>
        <label><span>Ambalaj</span><input value={productDraft.pack} onChange={(event) => setProductDraft({ ...productDraft, pack: event.target.value })}/></label>
        <label><span>Preț</span><input type="number" step="0.01" value={productDraft.price} onChange={(event) => setProductDraft({ ...productDraft, price: event.target.value })}/></label>
        <label><span>Categorie</span><input value={productDraft.category} onChange={(event) => setProductDraft({ ...productDraft, category: event.target.value })}/></label>
        <label><span>Unitate</span><select value={productDraft.unit} onChange={(event) => setProductDraft({ ...productDraft, unit: event.target.value as 'buc' | 'kg' })}><option value="buc">buc</option><option value="kg">kg</option></select></label>
        <label><span>Pas cantitate</span><input type="number" step="0.1" value={productDraft.step} onChange={(event) => setProductDraft({ ...productDraft, step: event.target.value })}/></label>
        <label className="check-field"><input type="checkbox" checked={productDraft.active} onChange={(event) => setProductDraft({ ...productDraft, active: event.target.checked })}/><span>Produs activ</span></label>
      </div>
      <div className="edit-actions">
        <button onClick={() => setProductEditId(null)}><X size={15}/> Anulează</button>
        <button className="primary" onClick={saveProduct}><Save size={15}/> Salvează produsul</button>
      </div>
    </section>}
  </main>;
}
