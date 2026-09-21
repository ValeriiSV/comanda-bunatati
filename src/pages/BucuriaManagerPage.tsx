import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import {
  ArrowLeft,
  Check,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileSpreadsheet,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { bucuriaPhotoCatalog } from '@/lib/bucuriaPhotoCatalog';
import { BucuriaLogo } from '@/components/BrandLogos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
function orderDate(order: Order) {
  const raw = order.updatedAt as any;
  if (raw instanceof Date) return raw;
  if (raw && typeof raw.toDate === 'function') return raw.toDate();
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
function monthKey(date: Date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}
function monthLabel(key: string) {
  const parts = key.split('-').map(Number);
  return new Intl.DateTimeFormat('ro-MD', { month: 'long', year: 'numeric' }).format(new Date(parts[0], parts[1] - 1, 1));
}

type ImportProductRow = {
  barcode: string;
  name: string;
  pack: string;
  price: number;
  category: string;
  unit: 'buc' | 'kg';
  step: number;
  active: boolean;
};

function normalizeHeader(value: unknown) {
  return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function cellValue(row: Record<string, unknown>, aliases: string[]) {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const found = entries.find(([key]) => normalizeHeader(key) === normalizeHeader(alias));
    if (found) return found[1];
  }
  return '';
}

function parsePrice(value: unknown) {
  const normalized = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const result = Number(normalized);
  return Number.isFinite(result) ? result : 0;
}

function parseBoolean(value: unknown) {
  const normalized = normalizeHeader(value);
  if (!normalized) return true;
  return !['0', 'nu', 'no', 'false', 'inactiv', 'ascuns'].includes(normalized);
}

function mapImportRow(row: Record<string, unknown>): ImportProductRow | null {
  const name = String(cellValue(row, ['Denumire', 'Produs', 'Nume', 'Name'])).trim();
  const price = parsePrice(cellValue(row, ['Preț', 'Pret', 'Price', 'Pret lei', 'Preț lei']));
  if (!name || price < 0) return null;

  const rawUnit = normalizeHeader(cellValue(row, ['Unitate', 'UM', 'U.M.', 'Unit']));
  const unit: 'buc' | 'kg' = rawUnit.includes('kg') ? 'kg' : 'buc';
  const rawStep = parsePrice(cellValue(row, ['Pas', 'Pas cantitate', 'Step']));
  const step = rawStep > 0 ? rawStep : unit === 'kg' ? 0.1 : 1;

  return {
    barcode: String(cellValue(row, ['Cod bare', 'Cod de bare', 'Barcode', 'EAN', 'Cod EAN'])).trim(),
    name,
    pack: String(cellValue(row, ['Ambalaj', 'Pack', 'Pachet'])).trim(),
    price,
    category: String(cellValue(row, ['Categorie', 'Category'])).trim() || 'Bucuria',
    unit,
    step,
    active: parseBoolean(cellValue(row, ['Activ', 'Active', 'Status'])),
  };
}

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
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [collectorName, setCollectorName] = useState('');
  const [collectorPhone, setCollectorPhone] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportProductRow[]>([]);
  const [importFileName, setImportFileName] = useState('');

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

  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(doc(db, 'settings', 'miaCollector'), (snap) => {
      const data = snap.exists() ? snap.data() as { name?: string; phone?: string } : {};
      setCollectorName(data.name || '');
      setCollectorPhone(data.phone || '');
    }, (error) => setMessage(error.message));
  }, [isAdmin]);

  const monthOptions = useMemo(() => {
    const keys = new Set(orders.map((order) => monthKey(orderDate(order))));
    keys.add(monthKey(new Date()));
    return [...keys].sort().reverse();
  }, [orders]);
  const visibleOrders = useMemo(() => orders.filter((order) => monthKey(orderDate(order)) === selectedMonth), [orders, selectedMonth]);

  const total = visibleOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const paidTotal = visibleOrders.filter((order) => order.paid).reduce((sum, order) => sum + Number(order.total || 0), 0);
  const unpaidTotal = Math.max(0, total - paidTotal);
  const unpaidCount = visibleOrders.filter((order) => !order.paid).length;

  const summary = useMemo(() => {
    const map = new Map<string, { productId: string; name: string; barcode?: string; qty: number; total: number; unit?: string }>();
    visibleOrders.forEach((order) => order.items.forEach((item) => {
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
  }, [visibleOrders]);

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
    visibleOrders.forEach((order) => order.items.forEach((item) => rows.push([
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

  const saveMiaCollector = async () => {
    if (!collectorPhone.trim()) {
      setMessage('Introdu numărul de telefon MIA al persoanei care colectează banii.');
      return;
    }
    setBusy(true);
    try {
      await setDoc(doc(db, 'settings', 'miaCollector'), {
        name: collectorName.trim(),
        phone: collectorPhone.trim(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setMessage('Colectorul MIA P2P a fost actualizat pentru toate paginile.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const exportSellerExcel = () => {
    const escape = (value: unknown) => String(value ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const rows = summary.map((item) =>
      '<tr><td>' + escape(item.name) + '</td><td>' + escape(qtyLabel(item.qty, item.unit)) + '</td><td>' + Number(item.total || 0).toFixed(2) + '</td></tr>'
    ).join('');
    const html = '<!doctype html><html><head><meta charset="UTF-8"></head><body><table border="1">' +
      '<tr><th colspan="3">Lista pentru vânzător Bucuria — ' + escape(monthLabel(selectedMonth)) + '</th></tr>' +
      '<tr><th>Produs</th><th>Cantitate</th><th>Sumă (lei)</th></tr>' + rows +
      '<tr><th>TOTAL GENERAL</th><th></th><th>' + Number(total || 0).toFixed(2) + '</th></tr>' +
      '</table></body></html>';
    const url = URL.createObjectURL(new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lista-vanzator-bucuria-' + selectedMonth + '.xls';
    link.click();
    URL.revokeObjectURL(url);
  };

  const logout = async () => {
    try { await signOut(auth); } catch {}
    window.location.replace('/bucuria/manager');
  };

  const deleteAllProducts = async () => {
    if (!products.length) {
      setMessage('Catalogul Bucuria este deja gol.');
      return;
    }
    if (!window.confirm(`Ștergi toate cele ${products.length} poziții din catalogul Bucuria? Comenzile colegilor NU vor fi șterse.`)) return;
    if (!window.confirm('Confirmare finală: această acțiune nu poate fi anulată. Continui?')) return;

    setBusy(true);
    try {
      const chunks: Product[][] = [];
      for (let i = 0; i < products.length; i += 400) chunks.push(products.slice(i, i + 400));
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((product) => batch.delete(doc(db, 'groupCampaigns', 'bucuria', 'products', product.id)));
        await batch.commit();
      }
      setProductSearch('');
      setMessage('Toate pozițiile Bucuria au fost șterse. Comenzile au rămas intacte.');
    } catch (error) {
      setMessage('Ștergerea catalogului a eșuat: ' + (error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const parseExcelFile = async (file: File) => {
    setImportBusy(true);
    setMessage('');
    try {
      const url = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
      const XLSX: any = await import(/* @vite-ignore */ url);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' }) as Record<string, unknown>[];
      const mapped = rows.map(mapImportRow).filter((row): row is ImportProductRow => !!row);
      if (!mapped.length) throw new Error('Nu am găsit rânduri valide. Verifică denumirea și prețul.');
      setImportPreview(mapped);
      setImportFileName(file.name);
      setMessage(`Fișier citit: ${mapped.length} poziții pregătite pentru import.`);
    } catch (error) {
      setImportPreview([]);
      setImportFileName('');
      setMessage('Importul nu a putut citi fișierul: ' + (error as Error).message);
    } finally {
      setImportBusy(false);
    }
  };

  const commitExcelImport = async () => {
    if (!importPreview.length) return;
    if (!window.confirm(`Importi ${importPreview.length} poziții în catalogul Bucuria?`)) return;
    setImportBusy(true);
    try {
      const chunks: ImportProductRow[][] = [];
      for (let i = 0; i < importPreview.length; i += 400) chunks.push(importPreview.slice(i, i + 400));
      let offset = 0;
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((row, index) => {
          const id = safeId(`${row.barcode || 'fara-cod'}-${row.name}-${offset + index}`) || `produs-${Date.now()}-${offset + index}`;
          batch.set(doc(db, 'groupCampaigns', 'bucuria', 'products', id), {
            ...row,
            source: 'excel-import',
            updatedAt: serverTimestamp(),
          }, { merge: true });
        });
        await batch.commit();
        offset += chunk.length;
      }
      setMessage(`${importPreview.length} poziții au fost importate din Excel.`);
      setImportPreview([]);
      setImportFileName('');
    } catch (error) {
      setMessage('Importul în Firestore a eșuat: ' + (error as Error).message);
    } finally {
      setImportBusy(false);
    }
  };

  const downloadImportTemplate = () => {
    const rows = [
      ['Cod bare','Denumire','Ambalaj','Preț','Categorie','Unitate','Pas','Activ'],
      ['4840095000000','Exemplu produs','1/250','25.50','Bucuria','buc','1','DA'],
      ['4840095000001','Exemplu vrac','','89.90','Bomboane','kg','0.1','DA'],
    ];
    const csv = '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"','""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'model-import-bucuria.csv';
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
    return <main className="grid min-h-screen place-items-center bg-[#f2f5ed] p-5 text-[#173d2c]">
      <section className="w-full max-w-md rounded-[28px] border border-[#d9e3d7] bg-white p-8 text-center shadow-xl">
        <BucuriaLogo className="mx-auto mb-5 h-20 w-40" />
        <h1 className="font-serif text-3xl font-semibold">Panoul managerului</h1>
        <p className="mt-2 text-sm text-[#74837b]">Autentifică-te în Orbico Market cu contul de administrator.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/" className="rounded-xl bg-[#173d2c] px-4 py-2.5 text-sm font-semibold text-white">Orbico Market</Link>
          <Link to="/bucuria" className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Bucuria</Link>
        </div>
      </section>
    </main>;
  }

  if (!isAdmin) {
    return <main className="grid min-h-screen place-items-center bg-[#f2f5ed] p-5 text-[#173d2c]">
      <section className="w-full max-w-md rounded-[28px] border border-[#d9e3d7] bg-white p-8 text-center shadow-xl">
        <BucuriaLogo className="mx-auto mb-5 h-20 w-40" />
        <h1 className="font-serif text-3xl font-semibold">Acces administrator</h1>
        <p className="mt-2 text-sm text-[#74837b]">Contul autentificat nu are drepturi de manager.</p>
        <Link to="/bucuria" className="mt-6 inline-flex rounded-xl border px-4 py-2.5 text-sm font-semibold">Înapoi la Bucuria</Link>
      </section>
    </main>;
  }

  const editingOrder = orderEditId ? visibleOrders.find((order) => order.id === orderEditId) : null;

  return <main className="min-h-screen bg-[#f2f5ed] text-[#173d2c]">
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/bucuria" className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#d9e3d7] bg-white p-1">
            <BucuriaLogo className="size-full" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-serif text-2xl font-semibold">Panoul managerului</h1>
            <p className="text-xs text-[#74837b]">Bucuria</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link to="/bucuria" className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium"><ArrowLeft size={16}/> Bucuria</Link>
          <Button type="button" variant="outline" onClick={() => window.location.reload()} disabled={busy}><RefreshCw/> Reîncarcă</Button>
          <Button type="button" onClick={exportCsv} className="bg-[#173d2c]"><Download/> CSV</Button>
          <Button type="button" variant="outline" size="icon" onClick={logout} title="Ieșire"><LogOut/></Button>
        </div>
      </div>
    </header>

    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-8">
      {message && <button type="button" onClick={() => setMessage('')} className="w-full rounded-xl bg-[#e8f3df] p-3 text-left text-sm text-[#315b32]">{message}</button>}

      <section className="rounded-[24px] border border-[#cfe0cf] bg-[#f5faf2] p-5">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-[#6d7f72]">MIA P2P</p>
        <h2 className="mt-1 font-serif text-2xl font-semibold">Colector MIA P2P</h2>
        <p className="mt-1 text-sm text-[#74837b]">Aceeași persoană apare automat la Nuci, Bucuria și viitoarele comenzi.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input value={collectorName} onChange={(event) => setCollectorName(event.target.value)} placeholder="Numele persoanei care colectează" className="bg-white"/>
          <Input type="tel" inputMode="tel" value={collectorPhone} onChange={(event) => setCollectorPhone(event.target.value)} placeholder="+373 6X XXX XXX" className="bg-white"/>
          <Button type="button" onClick={saveMiaCollector} disabled={busy || !collectorPhone.trim()} className="bg-[#173d2c]"><Save/> Salvează MIA</Button>
        </div>
        {collectorPhone.trim() && <p className="mt-3 text-xs text-[#6f7f76]">QR-ul public conține numărul <strong>{collectorPhone.trim()}</strong>. Suma se introduce manual.</p>}
      </section>

      <section className="rounded-[22px] border bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div><p className="font-semibold">Perioada comenzilor</p><p className="text-xs text-[#74837b]">Istoric separat pe luni</p></div>
          <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="h-11 rounded-xl border px-3">
            {monthOptions.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
          </select>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Comenzi" value={String(visibleOrders.length)} />
        <Stat label="Total de încasat" value={money(total)} />
        <Stat label="Încasat" value={money(paidTotal)} />
      </section>

      <section className="overflow-hidden rounded-[24px] border bg-white">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Comenzi individuale · {monthLabel(selectedMonth)}</h2>
            <p className="mt-1 text-sm text-[#74837b]">Modifică produse, cantități, plată sau șterge comanda colegului.</p>
          </div>
          <span className="rounded-full bg-[#eef3e8] px-3 py-1.5 text-sm font-semibold">{visibleOrders.length} comenzi</span>
        </div>

        {editingOrder && <div className="border-b bg-[#f7faf4] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[.1em] text-[#74837b]">Editezi comanda</p><h3 className="text-lg font-semibold">{editingOrder.userName}</h3></div>
            <div className="text-left sm:text-right"><p className="text-xs text-[#74837b]">Total recalculat</p><strong className="font-serif text-2xl">{money(orderDraftTotal)}</strong></div>
          </div>
          <div className="mt-4 space-y-2">
            {orderDraft.map((item, index) => {
              const product = products.find((candidate) => candidate.id === item.productId);
              const step = Number(product?.step || (item.unit === 'kg' ? 0.1 : 1));
              return <div key={item.productId + '-' + index} className="flex flex-col gap-3 rounded-2xl border bg-white p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1"><strong className="block truncate">{item.name}</strong><span className="text-xs text-[#74837b]">{money(item.price)} / {item.unit || 'buc'}</span></div>
                <div className="flex items-center gap-1 rounded-xl border bg-[#f7f9f5] p-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => setOrderDraft((current) => current.map((entry, i) => i === index ? { ...entry, qty: roundQty(Math.max(0, Number(entry.qty) - step)) } : entry))}>−</Button>
                  <strong className="min-w-20 text-center text-sm">{qtyLabel(item.qty, item.unit)}</strong>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setOrderDraft((current) => current.map((entry, i) => i === index ? { ...entry, qty: roundQty(Number(entry.qty) + step) } : entry))}>+</Button>
                </div>
                <Button type="button" variant="ghost" size="icon" className="text-red-600" onClick={() => setOrderDraft((current) => current.filter((_, i) => i !== index))}><Trash2/></Button>
              </div>;
            })}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <select value={orderProductToAdd} onChange={(event) => setOrderProductToAdd(event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border bg-white px-3">
              <option value="">Alege un produs de adăugat</option>
              {availableOrderProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.price)}</option>)}
            </select>
            <Button type="button" variant="outline" onClick={addOrderItem} disabled={!orderProductToAdd}><Plus/> Adaugă produs</Button>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={cancelOrderEdit}>Renunță</Button>
            <Button type="button" onClick={() => saveOrderEdit(editingOrder)} className="bg-[#173d2c]"><Save/> Salvează comanda</Button>
          </div>
        </div>}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Nume</TableHead><TableHead>Telefon</TableHead><TableHead>Produse</TableHead><TableHead>Total</TableHead><TableHead>Plată</TableHead><TableHead className="text-right">Acțiuni</TableHead></TableRow></TableHeader>
            <TableBody>
              {visibleOrders.map((order) => <TableRow key={order.id} className={orderEditId === order.id ? 'bg-[#f7faf4]' : ''}>
                <TableCell><strong>{order.userName}</strong><span className="block text-xs text-[#829087]">{orderDate(order).toLocaleDateString('ro-MD')}</span></TableCell>
                <TableCell>{order.phone || '—'}</TableCell>
                <TableCell className="min-w-72">{order.items.map((item, index) => <span key={item.productId + '-' + index} className="mr-1.5 mb-1.5 inline-flex rounded-full bg-[#eef3e8] px-2.5 py-1 text-xs">{item.name} · {qtyLabel(item.qty, item.unit)}</span>)}</TableCell>
                <TableCell className="font-semibold">{money(order.total)}</TableCell>
                <TableCell><Button type="button" size="sm" variant={order.paid ? 'secondary' : 'outline'} onClick={() => togglePaid(order)}>{order.paid && <Check/>} {order.paid ? 'Achitat' : 'Neachitat'}</Button></TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="icon" onClick={() => startOrderEdit(order)}><Pencil/></Button><Button type="button" variant="ghost" size="icon" className="text-red-600" onClick={() => removeOrder(order)}><Trash2/></Button></div></TableCell>
              </TableRow>)}
              {visibleOrders.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-[#74837b]">Nu există comenzi în această lună.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#e4d4b8] bg-[#fffaf0] p-5">
        <h2 className="font-serif text-2xl font-semibold">Următoarea comandă</h2>
        <p className="mt-1 text-sm text-[#74837b]">Termenul și mesajul afișat colegilor pe pagina Bucuria.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[260px_1fr_auto]">
          <Input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="bg-white"/>
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Mesaj pentru colegi" className="bg-white"/>
          <Button type="button" onClick={saveCampaign} disabled={busy} className="bg-[#173d2c]"><Save/> Salvează</Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {statuses.map((status) => <Button key={status} type="button" size="sm" variant={campaign?.status === status ? 'secondary' : 'outline'} onClick={() => changeStatus(status)} disabled={busy}>{labels[status]}</Button>)}
        </div>
      </section>

      <section className="rounded-[24px] border bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-serif text-2xl font-semibold">Produse</h2><p className="mt-1 text-sm text-[#74837b]">Catalog Bucuria: adaugă, modifică, ascunde sau șterge produse.</p></div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={downloadImportTemplate}><FileSpreadsheet/> Model import</Button>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium hover:bg-[#f6f8f4]">
              <Upload className="size-4"/> {importBusy ? 'Se citește…' : 'Import Excel'}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={importBusy || busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void parseExcelFile(file); event.currentTarget.value = ''; }}/>
            </label>
            <Button type="button" variant="destructive" onClick={deleteAllProducts} disabled={busy || importBusy || products.length === 0}><Trash2/> Șterge toate</Button>
            <Button type="button" onClick={() => startProductEdit()} className="bg-[#173d2c]"><Plus/> Produs nou</Button>
          </div>
        </div>

        {importPreview.length > 0 && <div className="mt-5 rounded-2xl border border-[#cfe0cf] bg-[#f5faf2] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[.1em] text-[#6d7f72]">Import Excel</p><h3 className="font-semibold">{importFileName}</h3><p className="text-sm text-[#74837b]">{importPreview.length} poziții pregătite pentru import.</p></div>
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => { setImportPreview([]); setImportFileName(''); }}>Anulează</Button><Button type="button" onClick={commitExcelImport} disabled={importBusy} className="bg-[#173d2c]"><Upload/> {importBusy ? 'Se importă…' : 'Importă pozițiile'}</Button></div>
          </div>
          <div className="mt-4 max-h-64 overflow-auto rounded-xl border bg-white">
            <Table>
              <TableHeader><TableRow><TableHead>Cod bare</TableHead><TableHead>Denumire</TableHead><TableHead>Preț</TableHead><TableHead>Unitate</TableHead><TableHead>Categorie</TableHead></TableRow></TableHeader>
              <TableBody>{importPreview.slice(0, 50).map((row, index) => <TableRow key={row.barcode + '-' + index}><TableCell>{row.barcode || '—'}</TableCell><TableCell>{row.name}</TableCell><TableCell>{money(row.price)}</TableCell><TableCell>{row.unit}</TableCell><TableCell>{row.category}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
          {importPreview.length > 50 && <p className="mt-2 text-xs text-[#74837b]">Previzualizare: primele 50 din {importPreview.length} poziții.</p>}
        </div>}

        <label className="relative mt-4 block max-w-lg"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#74837b]"/><Input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Caută produs sau cod de bare" className="pl-9"/></label>

        {productEditId && <div className="mt-5 rounded-2xl border border-[#dce7d7] bg-[#f5f8f1] p-4">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{productEditId === 'new' ? 'Adaugă un produs nou' : 'Modifică produsul'}</h3><Button type="button" variant="ghost" size="icon" onClick={() => setProductEditId(null)}><X/></Button></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input value={productDraft.name} onChange={(event) => setProductDraft({ ...productDraft, name: event.target.value })} placeholder="Denumire"/>
            <Input value={productDraft.barcode} onChange={(event) => setProductDraft({ ...productDraft, barcode: event.target.value })} placeholder="Cod bare"/>
            <Input value={productDraft.pack} onChange={(event) => setProductDraft({ ...productDraft, pack: event.target.value })} placeholder="Ambalaj"/>
            <Input type="number" step="0.01" value={productDraft.price} onChange={(event) => setProductDraft({ ...productDraft, price: event.target.value })} placeholder="Preț"/>
            <Input value={productDraft.category} onChange={(event) => setProductDraft({ ...productDraft, category: event.target.value })} placeholder="Categorie"/>
            <select value={productDraft.unit} onChange={(event) => setProductDraft({ ...productDraft, unit: event.target.value as 'buc' | 'kg' })} className="h-9 rounded-md border bg-white px-3 text-sm"><option value="buc">buc</option><option value="kg">kg</option></select>
            <Input type="number" step="0.1" value={productDraft.step} onChange={(event) => setProductDraft({ ...productDraft, step: event.target.value })} placeholder="Pas cantitate"/>
            <label className="flex items-center gap-2 rounded-md border bg-white px-3 text-sm"><input type="checkbox" checked={productDraft.active} onChange={(event) => setProductDraft({ ...productDraft, active: event.target.checked })}/> Activ</label>
          </div>
          <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setProductEditId(null)}>Renunță</Button><Button type="button" onClick={saveProduct} className="bg-[#173d2c]"><Save/> Salvează produsul</Button></div>
        </div>}

        <div className="mt-5 overflow-x-auto rounded-2xl border">
          <Table>
            <TableHeader><TableRow><TableHead>Produs</TableHead><TableHead>Cod bare</TableHead><TableHead>Categorie</TableHead><TableHead>Preț</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Acțiuni</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredProducts.map((product) => <TableRow key={product.id}>
                <TableCell><strong>{product.name}</strong><span className="block text-xs text-[#829087]">{product.pack || '—'}</span></TableCell>
                <TableCell>{product.barcode || '—'}</TableCell>
                <TableCell>{product.category || 'Bucuria'}</TableCell>
                <TableCell>{money(product.price)} / {product.unit || 'buc'}</TableCell>
                <TableCell>{product.active === false ? 'Ascuns' : 'Activ'}</TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => toggleProduct(product)}>{product.active === false ? 'Arată' : 'Ascunde'}</Button><Button type="button" variant="ghost" size="icon" onClick={() => startProductEdit(product)}><Pencil/></Button><Button type="button" variant="ghost" size="icon" className="text-red-600" onClick={() => removeProduct(product)}><Trash2/></Button></div></TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-[24px] border bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-serif text-2xl font-semibold">Lista pentru vânzător</h2><p className="mt-1 text-sm text-[#74837b]">Cantitatea și suma totală pentru luna selectată.</p></div>
          <Button type="button" variant="outline" onClick={exportSellerExcel}><Download/> Export Excel</Button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {summary.map((item) => <div key={item.productId} className="rounded-xl bg-[#f2f6ee] px-4 py-3">
            <div className="flex items-start justify-between gap-3"><span className="font-medium">{item.name}</span><strong>{qtyLabel(item.qty, item.unit)}</strong></div>
            <p className="mt-1 text-xs text-[#74837b]">{item.barcode || 'fără cod'} · {money(item.total)}</p>
          </div>)}
          {summary.length === 0 && <p className="text-sm text-[#74837b]">Lista va apărea după primele comenzi.</p>}
        </div>
        <div className="mt-4 flex justify-end border-t pt-4"><span className="text-sm text-[#74837b]">Total general:&nbsp;</span><strong>{money(total)}</strong></div>
      </section>
    </div>
  </main>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[22px] border bg-white p-5"><p className="text-sm text-[#74837b]">{label}</p><strong className="mt-1 block font-serif text-3xl">{value}</strong></div>;
}
