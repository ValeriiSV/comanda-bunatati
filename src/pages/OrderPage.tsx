import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Minus, Plus, Search, ShoppingBag, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { categories, linePrice, priceLabel, type Category, type Product } from '@/lib/products';
import { useProducts, type ManagedProduct } from '@/hooks/useProducts';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Cart = Record<string, number>;

const categoryMeta: Record<Category, { icon: string; note: string }> = {
  Nuci: { icon: '🥜', note: 'crude, coapte și speciale' },
  'Fructe uscate': { icon: '🍑', note: 'dulci, moi și aromate' },
  Bomboane: { icon: '🍬', note: 'pentru pauza de cafea' },
  Drajeuri: { icon: '🍫', note: 'porții de 250 g' },
};

function money(value: number) {
  return new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 2 }).format(value);
}

function CartPanel({ cart, setCart, products }: { cart: Cart; setCart: React.Dispatch<React.SetStateAction<Cart>>; products: Product[] }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const lines = products.filter((product) => cart[product.id] > 0);
  const total = lines.reduce((sum, product) => sum + linePrice(product, cart[product.id]), 0);

  const change = (id: string, delta: number) => {
    setCart((current) => ({ ...current, [id]: Math.max(0, (current[id] || 0) + delta) }));
  };

  const submit = async () => {
    if (!name.trim() || !lines.length) return;
    setSending(true);
    setSuccess(null);
    try {
      const orderCode = `CMD-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      await addDoc(collection(db, 'groupOrders'), {
        orderCode,
        customerName: name.trim(),
        note: note.trim(),
        totalBani: Math.round(total * 100),
        paid: false,
        createdAt: serverTimestamp(),
        items: lines.map((product) => ({ productId: product.id, productName: product.name, category: product.category, grams: cart[product.id], lineTotalBani: Math.round(linePrice(product, cart[product.id]) * 100) })),
      });
      setCart({});
      setNote('');
      setSuccess(orderCode);
    } catch {
      alert('Nu am putut trimite comanda. Încearcă din nou.');
    } finally {
      setSending(false);
    }
  };

  if (success) {
    return <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 grid size-16 place-items-center rounded-full bg-[#e5f2d5] text-[#315b32]"><CheckCircle2 className="size-8" /></span>
      <h2 className="font-serif text-3xl font-semibold text-[#173d2c]">Comandă trimisă</h2>
      <p className="mt-3 max-w-xs text-[#607269]">Codul tău este <strong className="text-[#173d2c]">{success}</strong>. Managerul vede deja comanda.</p>
      <Button className="mt-7 h-11 rounded-full bg-[#173d2c] px-5" onClick={() => setSuccess(null)}>Comandă din nou</Button>
    </div>;
  }

  return <div className="flex h-full flex-col">
    <div className="flex-1 overflow-y-auto px-5 pb-5">
      {lines.length === 0 ? <div className="flex min-h-[280px] flex-col items-center justify-center text-center text-[#74837b]">
        <ShoppingBag className="mb-4 size-11 stroke-1" /><p className="font-medium text-[#315b32]">Coșul este gol</p><p className="mt-1 max-w-[230px] text-sm">Adaugă bunătățile dorite din catalog.</p>
      </div> : <div className="space-y-3">{lines.map((product) => <div key={product.id} className="rounded-2xl border border-[#dfe8df] bg-white p-4">
        <div className="flex items-start justify-between gap-4"><div><p className="font-medium text-[#173d2c]">{product.name}</p><p className="mt-1 text-sm text-[#74837b]">{money(linePrice(product, cart[product.id]))} lei</p></div>
          <div className="flex items-center gap-1 rounded-full bg-[#f0f5eb] p-1"><Button aria-label={`Scade ${product.name}`} variant="ghost" size="icon-sm" className="rounded-full" onClick={() => change(product.id, -product.stepGrams)}><Minus /></Button><span className="min-w-14 text-center text-sm font-semibold text-[#315b32]">{cart[product.id]} g</span><Button aria-label={`Adaugă ${product.name}`} variant="ghost" size="icon-sm" className="rounded-full" onClick={() => change(product.id, product.stepGrams)}><Plus /></Button></div>
        </div>
      </div>)}</div>}
    </div>
    <div className="border-t border-[#dfe8df] bg-[#fbfcf8] p-5">
      <div className="mb-4 flex items-end justify-between"><span className="text-sm text-[#607269]">Total de plată</span><strong className="font-serif text-3xl text-[#173d2c]">{money(total)} lei</strong></div>
      <div className="space-y-3"><Input className="h-11 rounded-xl border-[#cedbce] bg-white px-3" placeholder="Numele și prenumele *" value={name} onChange={(event) => setName(event.target.value)} /><Input className="h-11 rounded-xl border-[#cedbce] bg-white px-3" placeholder="Notă pentru manager (opțional)" value={note} onChange={(event) => setNote(event.target.value)} /><Button disabled={!name.trim() || !lines.length || sending} onClick={submit} className="h-12 w-full rounded-xl bg-[#f2a444] text-base font-semibold text-[#17301f] hover:bg-[#e89531]">{sending ? 'Se trimite…' : 'Trimite comanda'} <ChevronRight /></Button></div>
    </div>
  </div>;
}

export default function OrderApp() {
  const { products: firestoreProducts, loading, error } = useProducts();
  const products = useMemo(() => firestoreProducts.filter((product) => product.active !== false), [firestoreProducts]);
  const [activeCategory, setActiveCategory] = useState<Category>('Nuci');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Cart>({});
  const [agentNotice, setAgentNotice] = useState('');
  const filtered = useMemo(() => products.filter((product) => product.category === activeCategory && product.name.toLowerCase().includes(search.toLowerCase())), [activeCategory, search, products]);
  const itemCount = Object.values(cart).filter(Boolean).length;
  const total = products.reduce((sum, product) => sum + linePrice(product, cart[product.id] || 0), 0);
  const change = (productId: string, delta: number) => setCart((current) => ({ ...current, [productId]: Math.max(0, (current[productId] || 0) + delta) }));

  useEffect(() => {
    setCart((current) => Object.fromEntries(Object.entries(current).filter(([id]) => products.some((product) => product.id === id))));
  }, [products]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: Record<string, unknown>) => void } }).modelContext;
    if (!context || !products.length) return;
    context.registerTool({
      name: 'submit_team_order',
      title: 'Trimite o comandă de bunătăți',
      description: 'Trimite o comandă nouă de nuci, fructe uscate sau dulciuri pentru un coleg. Folosește ID-urile din catalog și cantități conforme cu pasul produsului.',
      inputSchema: {
        type: 'object', required: ['customerName', 'items'], additionalProperties: false,
        properties: {
          customerName: { type: 'string', minLength: 1, maxLength: 80 },
          note: { type: 'string', maxLength: 300 },
          items: { type: 'array', minItems: 1, items: { type: 'object', required: ['productId', 'grams'], additionalProperties: false, properties: { productId: { type: 'string', enum: products.map((product) => product.id) }, grams: { type: 'integer', minimum: 1, maximum: 20000 } } } },
        },
      },
      execute: async (input: unknown) => {
        const order = input as { customerName: string; note?: string; items: Array<{ productId: string; grams: number }> };
        const selected = order.items.map((item) => {
          const product = products.find((candidate) => candidate.id === item.productId);
          if (!product || item.grams % product.stepGrams !== 0) throw new Error('Produs sau cantitate nevalidă');
          return { product, grams: item.grams, lineTotalBani: Math.round(linePrice(product, item.grams) * 100) };
        });
        const orderCode = `CMD-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
        const totalBani = selected.reduce((sum, item) => sum + item.lineTotalBani, 0);
        await addDoc(collection(db, 'groupOrders'), { orderCode, customerName: order.customerName.trim(), note: order.note?.trim() || '', totalBani, paid: false, createdAt: serverTimestamp(), items: selected.map(({ product, grams, lineTotalBani }) => ({ productId: product.id, productName: product.name, category: product.category, grams, lineTotalBani })) });
        setCart({});
        setAgentNotice(`Comanda ${orderCode} a fost trimisă.`);
        return { orderCode, totalLei: totalBani / 100 };
      },
    });
  }, [products]);

  return <main className="min-h-screen bg-[#f6f7f0] pb-28 text-[#173d2c] lg:pb-0">
    {agentNotice && <div role="status" className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-[#173d2c] px-5 py-3 text-sm font-medium text-white shadow-xl">{agentNotice}</div>}
    <header className="sticky top-0 z-30 border-b border-[#d9e2d8]/80 bg-[#f6f7f0]/92 backdrop-blur-xl"><div className="mx-auto flex h-18 max-w-[1440px] items-center justify-between px-4 sm:px-8"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[#173d2c] text-xl">🌰</span><div><p className="font-serif text-xl font-bold leading-none">Bunătăți împreună</p><p className="mt-1 text-xs text-[#74837b]">Comanda echipei</p></div></div><Link className="text-sm font-medium text-[#607269] transition hover:text-[#173d2c]" to="/admin">Manager</Link></div></header>
    <div className="mx-auto max-w-[1440px] lg:grid lg:grid-cols-[minmax(0,1fr)_390px]">
      <section className="min-w-0 px-4 py-5 sm:px-8 lg:py-7">
        <div className="relative mb-7 min-h-[250px] overflow-hidden rounded-[28px] bg-[#173d2c] text-white shadow-[0_22px_70px_rgba(23,61,44,.14)]"><img src="/catalog-hero.png" alt="Nuci și fructe uscate aranjate în boluri" className="absolute inset-0 size-full object-cover object-center" /><div className="absolute inset-0 bg-gradient-to-r from-[#173d2c] via-[#173d2c]/90 to-transparent" /><div className="relative flex min-h-[250px] max-w-xl flex-col justify-center p-7 sm:p-10"><span className="mb-4 flex w-fit items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[.12em] text-[#f8c982]"><Sparkles className="size-3.5" /> Comandă deschisă</span><h1 className="font-serif text-4xl font-semibold leading-[1.05] sm:text-5xl">Alege ce-ți place.<br />Noi comandăm împreună.</h1><p className="mt-4 max-w-md text-sm leading-6 text-white/75 sm:text-base">Cantitatea crește automat în pasul setat pentru fiecare produs. Prețul și totalul se calculează din Firebase.</p></div></div>
        {error && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div className="flex gap-2 overflow-x-auto pb-1">{categories.map((category) => <button key={category} onClick={() => setActiveCategory(category)} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition ${activeCategory === category ? 'bg-[#173d2c] text-white shadow-md' : 'border border-[#d6e0d5] bg-white text-[#607269] hover:border-[#9aae9b]'}`}><span className="mr-1.5">{categoryMeta[category].icon}</span>{category}</button>)}</div><label className="relative block w-full xl:w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#839087]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 rounded-full border-[#d6e0d5] bg-white pl-10" placeholder="Caută un produs" /></label></div>
        <div className="mb-4 flex items-baseline justify-between"><div><h2 className="font-serif text-3xl font-semibold">{activeCategory}</h2><p className="mt-1 text-sm text-[#74837b]">{categoryMeta[activeCategory].note}</p></div><span className="text-sm text-[#839087]">{loading ? 'Se încarcă…' : `${filtered.length} produse`}</span></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((product: ManagedProduct) => { const amount = cart[product.id] || 0; return <article key={product.id} className={`group rounded-[22px] border bg-white p-5 transition ${amount ? 'border-[#7f9e76] shadow-[0_14px_34px_rgba(23,61,44,.09)]' : 'border-[#dfe7dc] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(23,61,44,.07)]'}`}><div className="mb-7 flex items-start justify-between gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#eef3e8] text-xl">{categoryMeta[product.category].icon}</span><div className="flex flex-wrap justify-end gap-1.5">{product.isNew && <span className="rounded-full bg-[#e3f2d7] px-2.5 py-1 text-xs font-semibold text-[#315b32]">Nou</span>}{product.promo && <span className="rounded-full bg-[#fff0d9] px-2.5 py-1 text-xs font-semibold text-[#a65d13]">Promo</span>}<span className="rounded-full bg-[#f5efe1] px-2.5 py-1 text-xs font-semibold text-[#9a6222]">{priceLabel(product)}</span></div></div><h3 className="min-h-12 text-[17px] font-semibold leading-6">{product.name}</h3>{amount ? <div className="mt-4 flex items-center justify-between"><div className="flex items-center gap-1 rounded-full bg-[#eef3e8] p-1"><Button aria-label={`Scade ${product.name}`} variant="ghost" size="icon-sm" className="rounded-full" onClick={() => change(product.id, -product.stepGrams)}><Minus /></Button><strong className="min-w-14 text-center text-sm">{amount} g</strong><Button aria-label={`Adaugă ${product.name}`} variant="ghost" size="icon-sm" className="rounded-full" onClick={() => change(product.id, product.stepGrams)}><Plus /></Button></div><strong>{money(linePrice(product, amount))} lei</strong></div> : <Button onClick={() => change(product.id, product.stepGrams)} variant="outline" className="mt-4 h-10 w-full rounded-xl border-[#c9d7c7] text-[#315b32] hover:bg-[#eef3e8]"><Plus /> Adaugă {product.stepGrams} g</Button>}</article>; })}</div>
      </section>
      <aside className="sticky top-18 hidden h-[calc(100vh-4.5rem)] border-l border-[#d9e2d8] bg-[#fbfcf8] lg:block"><div className="border-b border-[#dfe8df] px-5 py-5"><h2 className="font-serif text-2xl font-semibold">Comanda mea</h2><p className="mt-1 text-sm text-[#74837b]">{itemCount ? `${itemCount} produse alese` : 'Alege produsele din catalog'}</p></div><CartPanel cart={cart} setCart={setCart} products={products} /></aside>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d5dfd4] bg-white/95 p-3 backdrop-blur-xl lg:hidden"><Sheet><SheetTrigger render={<Button className="h-13 w-full rounded-2xl bg-[#173d2c] px-5 text-base" />}><ShoppingBag /> Vezi comanda <span className="ml-auto">{money(total)} lei</span></SheetTrigger><SheetContent side="bottom" className="max-h-[88vh] rounded-t-[28px] bg-[#fbfcf8]"><SheetHeader className="border-b border-[#dfe8df] px-5 py-4"><SheetTitle className="font-serif text-2xl">Comanda mea</SheetTitle><SheetDescription>{itemCount ? `${itemCount} produse alese` : 'Coșul este gol'}</SheetDescription></SheetHeader><CartPanel cart={cart} setCart={setCart} products={products} /></SheetContent></Sheet></div>
  </main>;
}
