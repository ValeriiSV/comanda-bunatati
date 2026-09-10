import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ChevronRight, Minus, Plus, Search, ShoppingBag, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { categories, linePrice, priceLabel, quantityLabel, type Category, type Product } from '@/lib/products';
import { useProducts, type ManagedProduct } from '@/hooks/useProducts';
import { formatOrderDate, useOrderSchedule, type OrderSchedule } from '@/hooks/useOrderSchedule';
import { submitPublicOrder } from '@/lib/orderApi';

type Cart = Record<string, number>;

const MIA_LINK = 'https://mia-qr.bnm.md/1/m/BNM/MCB983a07f55265457d90654eb9f97574fc';

const categoryMeta: Record<Category, { icon: string; note: string }> = {
  Nuci: { icon: '🥜', note: 'nuci crude, prăjite și sortimente speciale' },
  Miere: { icon: '🍯', note: 'miere naturală de salcâm' },
  'Fructe uscate': { icon: '🍑', note: 'fructe uscate, aromate și gustoase' },
  Conserve: { icon: '🍒', note: 'fructe conservate în suc propriu' },
  'Semințe': { icon: '🌱', note: 'semințe, chia, quinoa și mixuri' },
  Mix: { icon: '🥣', note: 'mix de nuci, fructe uscate și semințe' },
  'Cafea boabe': { icon: '☕', note: 'cafea boabe din Italia' },
  'Olive conservate': { icon: '🫒', note: 'olive și măsline · producător Grecia' },
  'Ulei de olive': { icon: '🫗', note: 'extra virgin, prima presare, pentru salate' },
  Bomboane: { icon: '🍬', note: 'ambalaj de 0,5 kg · producător Ucraina' },
  Drajeuri: { icon: '🍫', note: 'porții de 250 g' },
};

function money(value: number) {
  return new Intl.NumberFormat('ro-MD', { maximumFractionDigits: 2 }).format(value);
}

function ScheduleNotice({ schedule, compact = false }: { schedule: OrderSchedule; compact?: boolean }) {
  if (!schedule.dates.length) return null;
  return (
    <div className={`glass glass-shine rounded-2xl ${compact ? 'p-3' : 'p-4 sm:p-5'}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f7dfb8]/75 text-[#8b581c] shadow-sm backdrop-blur-md"><CalendarDays className="size-4" /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.1em] text-[#9a6222]">Următoarea comandă</p>
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-sm font-semibold text-[#5d4527]">
            {schedule.dates.map((date, index) => <span key={date}>{formatOrderDate(date)}{index < schedule.dates.length - 1 ? ' •' : ''}</span>)}
          </div>
          {schedule.message && <p className="mt-2 text-xs leading-5 text-[#7d674d]">{schedule.message}</p>}
        </div>
      </div>
    </div>
  );
}

function MiaQrCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`glass glass-shine rounded-2xl ${compact ? 'p-3' : 'p-4 sm:p-5'}`}>
      <div className={`flex ${compact ? 'items-center gap-3' : 'flex-col items-center gap-3 text-center sm:flex-row sm:text-left'}`}>
        <a href={MIA_LINK} target="_blank" rel="noreferrer" aria-label="Deschide MIA" className="rounded-2xl bg-white/70 p-1 shadow-sm backdrop-blur-md">
          <img src="/mia-qr.svg?v=5" alt="QR pentru transfer prin MIA" className={compact ? 'size-24 rounded-xl bg-white p-1' : 'size-32 rounded-2xl bg-white p-1'} />
        </a>
        <div>
          <p className="text-sm font-bold text-[#173d2c]">Transfer prin MIA</p>
          <p className="mt-1 text-xs leading-5 text-[#74837b]">Scanează QR-ul și introdu suma pe care o ai de transferat.</p>
        </div>
      </div>
    </div>
  );
}

function CartPanel({ cart, setCart, products, schedule }: {
  cart: Cart;
  setCart: React.Dispatch<React.SetStateAction<Cart>>;
  products: Product[];
  schedule: OrderSchedule;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');
  const lines = products.filter((product) => cart[product.id] > 0);
  const total = lines.reduce((sum, product) => sum + linePrice(product, cart[product.id]), 0);

  const change = (id: string, delta: number) => {
    setCart((current) => ({ ...current, [id]: Math.max(0, (current[id] || 0) + delta) }));
  };

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !lines.length || sending) return;
    setSending(true);
    setSubmitError('');
    setSuccess(null);

    const orderCode = `CMD-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    try {
      await submitPublicOrder({
        orderCode,
        customerName: name.trim(),
        phone: phone.trim(),
        totalBani: Math.round(total * 100),
        scheduledOrderDates: schedule.dates,
        items: lines.map((product) => ({
          productId: product.id,
          productName: product.name,
          category: product.category,
          grams: cart[product.id],
          lineTotalBani: Math.round(linePrice(product, cart[product.id]) * 100),
        })),
      });
      setCart({});
      setPhone('');
      setSuccess(orderCode);
    } catch (error) {
      console.error('Order submit failed:', error);
      const message = error instanceof Error ? error.message : String(error);
      setSubmitError(`Comanda nu a fost trimisă. ${message.includes('403') ? 'Firebase a refuzat accesul. Verifică regulile groupOrders.' : 'Verifică internetul și încearcă din nou.'}`);
    } finally {
      setSending(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center px-5 py-6 text-center">
        <span className="glass mb-5 grid size-16 place-items-center rounded-full text-[#315b32]"><CheckCircle2 className="size-8" /></span>
        <h2 className="font-serif text-3xl font-semibold text-[#173d2c]">Comandă trimisă</h2>
        <p className="mt-3 max-w-xs text-[#607269]">Codul tău este <strong className="text-[#173d2c]">{success}</strong>. Managerul vede deja comanda.</p>
        {schedule.dates.length > 0 && <p className="glass mt-3 max-w-xs rounded-xl px-4 py-2.5 text-sm text-[#7a5325]">Comanda comună este planificată pentru <strong>{schedule.dates.map(formatOrderDate).join(' / ')}</strong>.</p>}
        <div className="mt-5 w-full max-w-sm"><MiaQrCard compact /></div>
        <Button className="mt-6 h-11 rounded-full bg-[#173d2c] px-5 shadow-lg" onClick={() => setSuccess(null)}>Comandă din nou</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="glass-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1">
        {lines.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center text-center text-[#74837b]">
            <ShoppingBag className="mb-4 size-11 stroke-1" />
            <p className="font-medium text-[#315b32]">Coșul este gol</p>
            <p className="mt-1 max-w-[230px] text-sm">Adaugă bunătățile dorite din catalog.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map((product) => (
              <div key={product.id} className="glass-chip rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="font-medium text-[#173d2c]">{product.name}</p><p className="mt-1 text-sm text-[#74837b]">{money(linePrice(product, cart[product.id]))} lei</p></div>
                  <div className="flex items-center gap-1 rounded-full bg-white/45 p-1 backdrop-blur-md">
                    <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => change(product.id, -product.stepGrams)}><Minus /></Button>
                    <span className="min-w-14 text-center text-sm font-semibold text-[#315b32]">{quantityLabel(product, cart[product.id])}</span>
                    <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => change(product.id, product.stepGrams)}><Plus /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/60 bg-white/42 p-5 backdrop-blur-2xl">
        <div className="mb-4 flex items-end justify-between"><span className="text-sm text-[#607269]">Total de plată</span><strong className="font-serif text-3xl text-[#173d2c]">{money(total)} lei</strong></div>
        <div className="space-y-3">
          <Input className="glass-input h-11 rounded-xl px-3" placeholder="Numele și prenumele *" value={name} onChange={(event) => setName(event.target.value)} />
          {schedule.dates.length > 0 ? <ScheduleNotice schedule={schedule} compact /> : <div className="glass rounded-xl border-dashed p-3 text-sm text-[#74837b]">Data următoarei comenzi nu este încă stabilită.</div>}
          <Input type="tel" inputMode="tel" autoComplete="tel" className="glass-input h-11 rounded-xl px-3" placeholder="Număr de telefon *" value={phone} onChange={(event) => setPhone(event.target.value)} />
          {submitError && <p className="rounded-xl bg-red-50/85 p-3 text-sm text-red-700 backdrop-blur-md">{submitError}</p>}
          <Button disabled={!name.trim() || !phone.trim() || !lines.length || sending} onClick={submit} className="h-12 w-full rounded-xl bg-[#f2a444]/95 text-base font-semibold text-[#17301f] shadow-lg backdrop-blur-md hover:bg-[#e89531]">
            {sending ? 'Se trimite…' : 'Trimite comanda'} <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OrderApp() {
  const { products: firestoreProducts, loading, error } = useProducts();
  const { schedule } = useOrderSchedule();
  const products = useMemo(() => firestoreProducts.filter((product) => product.active !== false), [firestoreProducts]);
  const [activeCategory, setActiveCategory] = useState<Category>('Nuci');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Cart>({});

  const filtered = useMemo(
    () => products.filter((product) => product.category === activeCategory && product.name.toLowerCase().includes(search.toLowerCase())),
    [activeCategory, search, products],
  );
  const itemCount = Object.values(cart).filter(Boolean).length;
  const total = products.reduce((sum, product) => sum + linePrice(product, cart[product.id] || 0), 0);
  const change = (productId: string, delta: number) => setCart((current) => ({ ...current, [productId]: Math.max(0, (current[productId] || 0) + delta) }));

  return (
    <main className="liquid-page min-h-screen pb-28 text-[#173d2c] lg:pb-0">
      <header className="sticky top-0 z-30 bg-[#f3f5ed]/35 backdrop-blur-xl">
        <div className="glass glass-shine mx-auto my-2 flex h-16 max-w-[1440px] items-center justify-between rounded-[24px] px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/valera-logo.svg?v=6" alt="Bunătăți împreună cu Valera" className="size-12 shrink-0 rounded-full border border-white/70 bg-white/65 object-cover shadow-sm" />
            <div className="min-w-0"><p className="truncate font-serif text-lg font-bold leading-none sm:text-2xl">Bunătăți împreună cu Valera</p><p className="mt-1 text-xs text-[#74837b]">Comanda echipei</p></div>
          </div>
          <Link className="glass-chip ml-3 shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-[#315b32] transition hover:bg-white/75" to="/admin">Manager</Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] lg:grid lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-w-0 px-4 py-5 sm:px-8 lg:py-7">
          <div className="relative mb-5 min-h-[250px] overflow-hidden rounded-[30px] bg-[#173d2c] text-white shadow-[0_24px_70px_rgba(23,61,44,.16)] ring-1 ring-white/35">
            <img src="/catalog-hero.png" alt="Nuci și fructe uscate" className="absolute inset-0 size-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#173d2c]/96 via-[#173d2c]/82 to-[#173d2c]/15" />
            <div className="relative flex min-h-[250px] max-w-xl flex-col justify-center p-7 sm:p-10">
              <span className="glass-dark mb-4 flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[.12em] text-[#f8c982]"><Sparkles className="size-3.5" /> Comandă deschisă</span>
              <h1 className="font-serif text-4xl font-semibold leading-[1.05] sm:text-5xl">Alege ce-ți place.<br />Noi comandăm împreună.</h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-white/80 sm:text-base">Alege cantitatea dorită, trimite comanda și achită prin MIA.</p>
            </div>
          </div>

          <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            {schedule.dates.length > 0 ? <ScheduleNotice schedule={schedule} /> : <div className="glass rounded-2xl border-dashed p-4 text-sm text-[#74837b]">Data următoarei comenzi nu este încă stabilită.</div>}
            <MiaQrCard />
          </div>

          {error && <p className="mb-4 rounded-xl bg-amber-50/80 p-3 text-sm text-amber-800 backdrop-blur-lg">{error}</p>}

          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="glass-scrollbar flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`glass-chip shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition ${activeCategory === category ? 'bg-[#173d2c]/90 text-white shadow-lg ring-1 ring-white/35' : 'text-[#54685e] hover:bg-white/72'}`}
                >
                  <span className="mr-1.5">{categoryMeta[category].icon}</span>{category}
                </button>
              ))}
            </div>
            <label className="glass relative block w-full shrink-0 rounded-full xl:w-72">
              <Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[#708078]" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 rounded-full border-transparent bg-transparent pl-10 shadow-none focus-visible:ring-[#769277]/40" placeholder="Caută un produs" />
            </label>
          </div>

          <div className="mb-4 flex items-baseline justify-between"><div><h2 className="font-serif text-3xl font-semibold">{activeCategory}</h2><p className="mt-1 text-sm text-[#74837b]">{categoryMeta[activeCategory].note}</p></div><span className="text-sm text-[#839087]">{loading ? 'Se încarcă…' : `${filtered.length} produse`}</span></div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product: ManagedProduct) => {
              const amount = cart[product.id] || 0;
              return (
                <article key={product.id} className={`glass glass-shine glass-card-hover rounded-[24px] p-5 ${amount ? 'border-[#91ab88]/65 shadow-[0_18px_38px_rgba(23,61,44,.12)] ring-1 ring-[#8daa82]/25' : ''}`}>
                  <div className="mb-7 flex items-start justify-between gap-3">
                    <span className="grid size-11 place-items-center rounded-2xl bg-white/55 text-xl shadow-sm backdrop-blur-md">{categoryMeta[product.category].icon}</span>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {product.isNew && <span className="rounded-full bg-[#e3f2d7]/80 px-2.5 py-1 text-xs font-semibold text-[#315b32] backdrop-blur-md">Nou</span>}
                      {product.promo && <span className="rounded-full bg-[#fff0d9]/85 px-2.5 py-1 text-xs font-semibold text-[#a65d13] backdrop-blur-md">Promo</span>}
                      <span className="rounded-full bg-[#f5efe1]/75 px-2.5 py-1 text-xs font-semibold text-[#9a6222] backdrop-blur-md">{priceLabel(product)}</span>
                    </div>
                  </div>
                  <h3 className="min-h-12 text-[17px] font-semibold leading-6">{product.name}</h3>
                  {amount ? (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="glass-chip flex items-center gap-1 rounded-full p-1">
                        <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => change(product.id, -product.stepGrams)}><Minus /></Button>
                        <strong className="min-w-14 text-center text-sm">{quantityLabel(product, amount)}</strong>
                        <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => change(product.id, product.stepGrams)}><Plus /></Button>
                      </div>
                      <strong>{money(linePrice(product, amount))} lei</strong>
                    </div>
                  ) : (
                    <Button onClick={() => change(product.id, product.stepGrams)} variant="outline" className="glass-chip mt-4 h-10 w-full rounded-xl border-white/60 text-[#315b32] hover:bg-white/75"><Plus /> Adaugă {quantityLabel(product, product.stepGrams)}</Button>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="sticky top-20 hidden h-[calc(100vh-5rem)] p-3 pl-0 lg:block">
          <div className="glass-strong glass-shine flex h-full min-h-0 flex-col overflow-hidden rounded-[28px]">
            <div className="border-b border-white/60 px-5 py-5"><h2 className="font-serif text-2xl font-semibold">Comanda mea</h2><p className="mt-1 text-sm text-[#74837b]">{itemCount ? `${itemCount} produse alese` : 'Alege produsele din catalog'}</p></div>
            <div className="min-h-0 flex-1"><CartPanel cart={cart} setCart={setCart} products={products} schedule={schedule} /></div>
          </div>
        </aside>
      </div>

      <div className="glass fixed inset-x-3 bottom-3 z-40 rounded-[24px] p-2 lg:hidden">
        <Sheet>
          <SheetTrigger render={<Button className="glass-dark h-13 w-full rounded-[20px] px-5 text-base text-white" />}><ShoppingBag /> Vezi comanda <span className="ml-auto">{money(total)} lei</span></SheetTrigger>
          <SheetContent side="bottom" className="glass-strong max-h-[88vh] rounded-t-[30px] border-white/70 bg-white/68"><SheetHeader className="border-b border-white/60 px-5 py-4"><SheetTitle className="font-serif text-2xl">Comanda mea</SheetTitle><SheetDescription>{itemCount ? `${itemCount} produse alese` : 'Coșul este gol'}</SheetDescription></SheetHeader><CartPanel cart={cart} setCart={setCart} products={products} schedule={schedule} /></SheetContent>
        </Sheet>
      </div>
    </main>
  );
}
