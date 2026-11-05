import { useMemo, useState } from 'react';
import { Check, Copy, Link2, Send, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrderSchedule } from '@/hooks/useOrderSchedule';
import { usePublicOrderMeta } from '@/hooks/usePublicOrderMeta';

const ORDER_URL = 'https://comanda-bunatati.pages.dev';

function formatDate(value?: string, time?: string) {
  if (!value) return 'va fi anunțat';
  const [y, m, d] = value.split('-').map(Number);
  const text = new Intl.DateTimeFormat('ro-MD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
  return time ? `${text}, ora ${time}` : text;
}

function cleanInfoMessage(value?: string) {
  const message = (value || '').trim();
  if (!message) return '';
  const normalized = message.toLowerCase();
  if (
    normalized === 'comanda curentă este deschisă.' ||
    normalized === 'comanda curenta este deschisa.' ||
    normalized === 'comanda este deschisă.' ||
    normalized === 'comanda este deschisa.'
  ) return '';
  return message;
}

export default function ViberCampaignPanel() {
  const { schedule } = useOrderSchedule();
  const { stats } = usePublicOrderMeta();
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const body = useMemo(() => {
    const info = cleanInfoMessage(schedule.message);

    return [
      '🥜 Bunătăți împreună cu Valera',
      '',
      schedule.closed ? '🔒 Comanda curentă este închisă.' : '🟢 Comanda este deschisă!',
      `⏰ Termen: ${formatDate(schedule.dates[0], schedule.cutoffTime)}`,
      stats.orderCount
        ? `🔥 Suntem deja la ${stats.orderCount} comenzi și ${new Intl.NumberFormat('ro-MD').format(stats.totalBani / 100)} lei.`
        : '',
      info ? `ℹ️ ${info}` : '',
      '',
      '👉 Comandă aici:',
    ].filter(Boolean).join('\n');
  }, [
    schedule.closed,
    schedule.dates,
    schedule.cutoffTime,
    schedule.message,
    stats.orderCount,
    stats.totalBani,
  ]);

  const previewMessage = `${body}\n${ORDER_URL}`;

  const copy = async () => {
    await navigator.clipboard.writeText(previewMessage);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(ORDER_URL);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1800);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'Bunătăți împreună cu Valera',
        text: body,
        url: ORDER_URL,
      });
      return;
    }
    await copy();
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-[26px] border bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-[#7d8a82]">Campaign Center</p>
        <h2 className="mt-1 font-serif text-3xl font-semibold">Anunț pentru Viber</h2>
        <p className="mt-2 text-sm text-[#74837b]">Mesajul se construiește automat din termen și cifrele live.</p>

        <textarea
          readOnly
          value={previewMessage}
          className="mt-5 min-h-72 w-full resize-none rounded-2xl border bg-[#f7faf4] p-4 text-sm leading-6"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void share()} className="bg-[#173d2c]">
            <Share2 /> Trimite în Viber
          </Button>
          <Button variant="outline" onClick={() => void copy()}>
            {copied ? <Check /> : <Copy />} {copied ? 'Copiat' : 'Copiază mesajul'}
          </Button>
          <Button variant="outline" onClick={() => void copyLink()}>
            {linkCopied ? <Check /> : <Link2 />} {linkCopied ? 'Link copiat' : 'Copiază linkul'}
          </Button>
        </div>

        <p className="mt-3 text-xs leading-5 text-[#87928c]">
          Pe iPhone, „Trimite în Viber” deschide meniul nativ de distribuire. Alege Viber de acolo; linkul este transmis separat și nu mai poate fi tăiat de schema viber://.
        </p>
      </section>

      <aside className="rounded-[26px] bg-gradient-to-br from-[#173d2c] to-[#315b32] p-5 text-white">
        <Send className="size-8" />
        <h3 className="mt-4 font-serif text-2xl font-semibold">Trimite exact când contează</h3>
        <p className="mt-2 text-sm leading-6 text-white/70">Mesajul și linkul sunt acum distribuite separat, pentru compatibilitate mai bună cu Viber pe iPhone.</p>
        <div className="mt-5 space-y-2 text-sm">
          <div className="rounded-2xl bg-white/10 p-3">🟢 Deschidere comandă</div>
          <div className="rounded-2xl bg-white/10 p-3">⏰ Reminder 24h</div>
          <div className="rounded-2xl bg-white/10 p-3">🔥 Ultimele 2 ore</div>
        </div>
      </aside>
    </div>
  );
}
