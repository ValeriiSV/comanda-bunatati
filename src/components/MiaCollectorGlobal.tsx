import { useMemo, useState } from 'react';
import { Check, Copy, QrCode, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useMiaCollector } from '@/hooks/useMiaCollector';

function normalizePhone(value: string) {
  return value.replace(/[^+\d]/g, '');
}

function shouldShow(pathname: string) {
  if (pathname === '/' || pathname === '/comenzi-comune' || pathname === '/profil') return false;
  if (pathname.startsWith('/admin')) return false;
  if (pathname.endsWith('/manager') || pathname.endsWith('/status')) return false;
  return true;
}

export default function MiaCollectorGlobal() {
  const { pathname } = useLocation();
  const { collector, loading } = useMiaCollector();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const phone = useMemo(() => normalizePhone(collector.phone), [collector.phone]);
  const qrUrl = useMemo(
    () => phone ? `https://quickchart.io/qr?size=260&margin=2&text=${encodeURIComponent(phone)}` : '',
    [phone],
  );

  if (!shouldShow(pathname) || loading || !phone) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copiază numărul MIA:', phone);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[82px] right-4 z-[70] inline-flex items-center gap-2 rounded-full border border-white/70 bg-[#173d2c] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(23,61,44,.28)] lg:bottom-5"
        aria-label="Plată MIA P2P"
      >
        <QrCode className="size-4" />
        MIA P2P
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <section
            className="w-full max-w-sm rounded-[28px] border border-white/80 bg-[#f8faf5] p-5 text-[#173d2c] shadow-[0_30px_90px_rgba(0,0,0,.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.12em] text-[#7b8b82]">Transfer MIA P2P</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold">Persoana care colectează banii</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full bg-white text-[#607269] shadow-sm">
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-white p-4 text-center shadow-sm">
              <img src={qrUrl} alt={`QR pentru numărul MIA ${phone}`} className="mx-auto size-52 rounded-xl" />
              <p className="mt-4 text-sm text-[#74837b]">Scanează QR-ul sau copiază numărul și fă transferul P2P prin MIA.</p>
              {collector.name && <strong className="mt-3 block text-lg">{collector.name}</strong>}
              <button
                type="button"
                onClick={copy}
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#edf3e8] px-4 py-2 font-semibold"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {phone}
              </button>
            </div>

            <p className="mt-4 text-xs leading-5 text-[#7f8c84]">
              QR-ul conține numai numărul de telefon. În aplicația băncii, alege MIA P2P, verifică beneficiarul și introdu suma manual.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
