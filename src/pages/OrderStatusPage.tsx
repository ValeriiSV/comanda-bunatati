import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, PackageCheck, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePublicOrderMeta } from '@/hooks/usePublicOrderMeta';

const stages = ['Trimisă', 'Confirmată', 'Comandată furnizorului', 'Gata de ridicare'];
const LAST_ORDER_KEY = 'bunatati_last_order_v2';

function normalizeCode(value: string) {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return '';
  return trimmed.startsWith('CMD-') ? trimmed : `CMD-${trimmed.replace(/^CMD-?/i, '')}`;
}

function readLocalStatus(code: string) {
  try {
    const raw = localStorage.getItem(LAST_ORDER_KEY);
    if (!raw) return '';
    const data = JSON.parse(raw) as { orderCode?: string };
    return data.orderCode?.toUpperCase() === code ? 'Trimisă' : '';
  } catch {
    return '';
  }
}

export default function OrderStatusPage() {
  const [params] = useSearchParams();
  const initial = normalizeCode(params.get('code') || '');
  const [input, setInput] = useState(initial);
  const [code, setCode] = useState(initial);
  const { statuses, loading } = usePublicOrderMeta();

  const status = useMemo(() => {
    if (!code) return '';
    return statuses[code] || readLocalStatus(code);
  }, [code, statuses]);

  const currentIndex = status ? Math.max(0, stages.indexOf(status)) : -1;

  return (
    <main className="liquid-page min-h-screen px-4 py-8 text-[#173d2c] sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
          <ArrowLeft className="size-4" /> Înapoi la catalog
        </Link>

        <section className="glass-strong glass-shine mt-5 rounded-[32px] p-6 sm:p-9">
          <div className="flex items-start gap-4">
            <span className="glass grid size-14 shrink-0 place-items-center rounded-2xl text-[#315b32]"><PackageCheck className="size-7" /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#8b6b3f]">Urmărește comanda</p>
              <h1 className="mt-1 font-serif text-3xl font-semibold sm:text-4xl">Unde este comanda mea?</h1>
              <p className="mt-2 text-sm leading-6 text-[#68776f]">Introdu codul primit după trimitere, de exemplu CMD-A1B2C3.</p>
            </div>
          </div>

          <form
            className="mt-7 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              setCode(normalizeCode(input));
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#75847c]" />
              <Input value={input} onChange={(event) => setInput(event.target.value)} className="glass-input h-12 rounded-2xl pl-10 uppercase" placeholder="CMD-XXXXXX" />
            </div>
            <Button className="h-12 rounded-2xl bg-[#173d2c] px-6" type="submit">Verifică</Button>
          </form>

          {code && (
            <div className="mt-7">
              {status ? (
                <>
                  <div className="glass rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[.12em] text-[#7b8981]">{code}</p>
                    <p className="mt-1 text-xl font-bold text-[#173d2c]">{status}</p>
                  </div>
                  <div className="mt-6 space-y-2">
                    {stages.map((stage, index) => {
                      const done = index <= currentIndex;
                      return (
                        <div key={stage} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${done ? 'glass' : 'border border-white/50 bg-white/25'}`}>
                          {done ? <CheckCircle2 className="size-5 text-[#3f7040]" /> : <Circle className="size-5 text-[#a9b3ad]" />}
                          <span className={done ? 'font-semibold text-[#244b34]' : 'text-[#8b9790]'}>{stage}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#cdd9cd] bg-white/35 p-5 text-sm leading-6 text-[#6c7c73]">
                  {loading ? 'Se verifică statusul…' : 'Codul nu apare încă în statusurile publice. Dacă ai trimis comanda chiar acum, statusul inițial este „Trimisă”; managerul îl va actualiza pe măsură ce comanda avansează.'}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
