import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCopy, RefreshCw, Share2, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SimpleQrCode from '@/components/SimpleQrCode';
import { getDocument, listCollection, updateDocument } from '@/lib/firebaseRest';
import { effectiveRound, groupRoundOrders, type GroupableOrder } from '@/lib/orderRounds';

type Snapshot = { roundId: string; label: string; closed: boolean; orders: GroupableOrder[]; paymentLink: string; recipient: string };
const money = (bani: number) => new Intl.NumberFormat('ro-MD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bani / 100);
function validMiaLink(value: unknown) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && url.hostname === 'mia-qr.bnm.md' && !url.username && !url.password && !url.port && url.pathname.length > 1 ? url.href : '';
  } catch { return ''; }
}
async function readSnapshot(): Promise<Snapshot> {
  const [schedule, rows, collector, legacy] = await Promise.all([
    getDocument('settings/orderSchedule'), listCollection('groupOrders') as Promise<GroupableOrder[]>,
    getDocument('settings/miaCollector'), getDocument('settings/miaPayment'),
  ]);
  if (!schedule || typeof schedule.roundId !== 'string' || !schedule.roundId) throw new Error('Runda activă nu este configurată.');
  const payment = collector || legacy;
  return {
    roundId: schedule.roundId, label: String(schedule.roundLabel || schedule.roundId), closed: schedule.closed === true,
    orders: rows.filter(o => effectiveRound(o).roundId === schedule.roundId),
    paymentLink: validMiaLink(payment?.paymentLink), recipient: String(payment?.name || payment?.recipientName || ''),
  };
}

export default function RoundPaymentPanel({ onClosed }: { onClosed?: () => Promise<void> }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState(false);

  const load = async () => {
    setBusy(true); setError(''); setPrepared(false); setNotice('');
    try { setSnapshot(await readSnapshot()); }
    catch (e) { setSnapshot(null); setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);

  const groups = useMemo(() => groupRoundOrders(snapshot?.orders || []).sort((a,b) => (a.entries[0].customerName || '').localeCompare(b.entries[0].customerName || '', 'ro')), [snapshot]);
  const total = groups.reduce((sum,g) => sum+g.totalBani,0);
  const paid = groups.reduce((sum,g) => sum+g.paidBani,0);
  const remaining = total-paid;
  const payable = groups.filter(g => g.totalBani > g.paidBani);
  const message = snapshot && prepared && snapshot.closed && snapshot.paymentLink && payable.length ? [
    '🥜 Bunătăți împreună cu Valera', snapshot.label, '',
    '✅ Comanda a fost confirmată cu vânzătorul. Vă rog să achitați următoarele sume:',
    ...payable.map((g,i) => `${i+1}. ${(g.entries[0].customerName || 'Client').replace(/\s+/g,' ').trim()} — ${money(g.totalBani-g.paidBani)} lei`),
    '', `Total de încasat: ${money(remaining)} lei`, '',
    '💳 Achitare prin MIA:', snapshot.paymentLink,
    'Deschideți linkul, verificați beneficiarul și introduceți suma indicată lângă numele vostru. Mulțumesc!',
  ].join('\n') : '';

  const prepare = async () => {
    if (!snapshot || busy) return;
    setBusy(true);setError('');setPrepared(false);setNotice('');
    try {
      let fresh = await readSnapshot();
      if (fresh.roundId !== snapshot.roundId) { setSnapshot(fresh); throw new Error('Runda activă s-a schimbat. Verifică lista nouă.'); }
      if (!fresh.paymentLink) throw new Error('Salvează mai întâi linkul MIA oficial, generat de bancă.');
      if (!fresh.orders.length) throw new Error('Nu există comenzi în această rundă.');
      const signature = (s: Snapshot) => JSON.stringify(s.orders.map(o => [o.id,o.customerName,o.phone,o.totalBani,o.paid,o.items]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
      if (signature(fresh) !== signature(snapshot)) { setSnapshot(fresh); throw new Error('Comenzile sau plățile s-au modificat. Verifică lista actualizată înainte de confirmare.'); }
      if (!window.confirm('Confirmi că vânzătorul a acceptat produsele și cantitățile, iar sumele sunt finale? Runda va fi închisă și se va pregăti mesajul Viber.')) return;
      if (!fresh.closed) {
        await updateDocument('settings/orderSchedule', { closed: true, updatedAt: new Date() });
        const closed = await readSnapshot();
        setSnapshot(closed);
        if (closed.roundId !== fresh.roundId || !closed.closed || signature(closed) !== signature(fresh)) throw new Error('Lista s-a schimbat la închiderea rundei. Verifică și confirmă din nou.');
        fresh = closed;
      }
      setSnapshot(fresh);setPrepared(true);setNotice('Lista de achitare este pregătită. Verifică mesajul înainte de distribuire.');
      try { await onClosed?.(); } catch { /* Lista proprie este deja actualizată. */ }
    } catch(e) {setError(e instanceof Error ? e.message : String(e));}
    finally {setBusy(false);}
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(message);setNotice('Mesaj copiat. Lipește-l în grupul Viber.'); }
    catch { setError('Nu am putut copia automat. Selectează textul din caseta mesajului.'); }
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({text:message});
      else await copy();
    } catch(e) { if (!(e instanceof DOMException && e.name==='AbortError')) setError('Distribuirea nu a reușit. Folosește Copiază mesajul.'); }
  };
  const saveQr = () => {
    const svg=document.querySelector('#round-payment-qr svg');
    if(!svg) {setError('QR indisponibil. Folosește linkul MIA.');return;}
    const xml=new XMLSerializer().serializeToString(svg);
    const url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml;charset=utf-8'}));
    const img=new Image();
    img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=720;canvas.height=720;const ctx=canvas.getContext('2d');if(!ctx){URL.revokeObjectURL(url);return;}ctx.fillStyle='#fff';ctx.fillRect(0,0,720,720);ctx.drawImage(img,0,0,720,720);URL.revokeObjectURL(url);canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');const file=URL.createObjectURL(blob);a.href=file;a.download='achitare-mia.png';a.click();window.setTimeout(()=>URL.revokeObjectURL(file),10000);},'image/png');};
    img.onerror=()=>{URL.revokeObjectURL(url);setError('Nu am putut exporta QR-ul. Folosește linkul.');};img.src=url;
  };

  return <section className="space-y-4">
    <div className="rounded-[28px] bg-gradient-to-br from-[#173d2c] to-[#315b32] p-5 text-white">
      <div className="flex items-center justify-between gap-3"><WalletCards className="size-7"/><span className="rounded-full bg-white/15 px-3 py-1 text-xs">{snapshot ? snapshot.closed ? 'Rundă închisă' : 'În așteptarea confirmării' : 'Se încarcă'}</span></div>
      <p className="mt-4 text-sm text-white/75">{snapshot?.label || 'Runda curentă'} · Rest de încasat</p>
      <strong className="block text-3xl tabular-nums">{money(remaining)} lei</strong>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-4"><div><p className="text-xs text-white/70">Total</p><strong>{money(total)} lei</strong></div><div><p className="text-xs text-white/70">Achitat</p><strong>{money(paid)} lei</strong></div></div>
    </div>
    {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-2xl bg-[#e8f3df] p-3 text-sm">{notice}</p>}
    <div className="rounded-[24px] border bg-white p-4">
      <div className="flex items-center justify-between gap-2"><h2 className="font-serif text-xl font-semibold">Lista de achitare</h2><Button variant="outline" onClick={()=>void load()} disabled={busy}><RefreshCw/> Actualizează</Button></div>
      <p className="mt-2 text-xs text-[#74837b]">O singură poziție per telefon și rundă. Plățile deja înregistrate se scad.</p>
      {groups.map(g=><div key={g.key} className="flex items-center justify-between gap-3 border-b py-3 last:border-b-0"><div className="min-w-0"><strong className="block break-words text-sm">{g.entries[0].customerName || 'Client'}</strong><p className="text-xs text-[#74837b]">{g.paid ? 'Achitat integral' : g.paidBani ? `Achitat: ${money(g.paidBani)} lei` : 'Neachitat'}</p></div><strong className="shrink-0 tabular-nums">{money(g.totalBani-g.paidBani)} lei</strong></div>)}
      {!groups.length && <p className="py-4 text-sm text-[#74837b]">Nu există comenzi în runda curentă.</p>}
      <Button className="mt-4 h-auto min-h-12 w-full whitespace-normal bg-[#173d2c] py-3" disabled={busy || !snapshot || !groups.length || !snapshot.paymentLink} onClick={()=>void prepare()}><CheckCircle2/> {snapshot?.closed ? 'Confirmă lista pentru achitare' : 'Confirmă cu vânzătorul și închide runda'}</Button>
      {snapshot && !snapshot.paymentLink && <p className="mt-3 text-xs text-[#a15328]">Pentru distribuire, configurează mai jos linkul MIA oficial. Nu folosim un link implicit.</p>}
    </div>
    {prepared && snapshot && <div className="space-y-4 rounded-[24px] border bg-white p-4">
      <h2 className="font-serif text-xl font-semibold">Mesaj pentru grupul Viber</h2>
      {message ? <><textarea aria-label="Mesaj de achitare" readOnly value={message} className="min-h-64 w-full rounded-2xl border bg-[#f7faf4] p-3 text-sm leading-6"/><div className="flex flex-wrap gap-2"><Button onClick={()=>void share()} className="bg-[#173d2c]"><Share2/> Distribuie în Viber</Button><Button variant="outline" onClick={()=>void copy()}><ClipboardCopy/> Copiază mesajul</Button></div><p className="text-xs text-[#74837b]">Alege grupul Viber din meniul iOS. Verifică lista din nou dacă ai modificat comenzi după confirmare.</p>
      <a href={snapshot.paymentLink} target="_blank" rel="noreferrer" className="block break-all text-sm font-semibold underline">Verifică linkul MIA</a>
      {snapshot.recipient && <p className="text-sm">Beneficiar configurat: {snapshot.recipient}</p>}
      {new TextEncoder().encode(snapshot.paymentLink).length <= 106 && <div className="flex flex-wrap items-center gap-3"><div id="round-payment-qr" className="size-32 rounded-xl border bg-white p-2"><SimpleQrCode value={snapshot.paymentLink} className="size-full" title="QR MIA"/></div><Button variant="outline" onClick={saveQr}>Salvează QR PNG</Button></div>}
      </> : <p className="text-sm">Nu mai există sume de încasat.</p>}
    </div>}
  </section>;
}
