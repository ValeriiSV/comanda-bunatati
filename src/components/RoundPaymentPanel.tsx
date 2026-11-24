import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCopy, RefreshCw, Share2, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SimpleQrCode from '@/components/SimpleQrCode';
import { getDocument, listCollection, updateDocument, updateDocumentsAtomically } from '@/lib/firebaseRest';
import { effectiveRound, groupRoundOrders, allocateGroupDiscount, parseDiscountLei, orderDiscountBani, grossOrderBani, type GroupableOrder } from '@/lib/orderRounds';

type Snapshot = { activeRoundId: string; rounds: {id:string;label:string}[]; roundId: string; label: string; closed: boolean; orders: GroupableOrder[]; paymentLink: string; recipient: string };
const money = (bani: number) => new Intl.NumberFormat('ro-MD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bani / 100);
function validMiaLink(value: unknown) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && url.hostname === 'mia-qr.bnm.md' && !url.username && !url.password && !url.port && url.pathname.length > 1 ? url.href : '';
  } catch { return ''; }
}
async function readSnapshot(selectedRoundId?: string): Promise<Snapshot> {
  const [schedule, rows, collector, legacy] = await Promise.all([
    getDocument('settings/orderSchedule'), listCollection('groupOrders') as Promise<GroupableOrder[]>,
    getDocument('settings/miaCollector'), getDocument('settings/miaPayment'),
  ]);
  if (!schedule || typeof schedule.roundId !== 'string' || !schedule.roundId) throw new Error('Runda activă nu este configurată.');
  const payment = collector || legacy;
  const rounds = new Map<string,string>([[schedule.roundId,String(schedule.roundLabel || schedule.roundId)]]);
  rows.forEach(o=>{const round=effectiveRound(o);if(!rounds.has(round.roundId))rounds.set(round.roundId,round.roundLabel);});
  const roundId = selectedRoundId && rounds.has(selectedRoundId) ? selectedRoundId : schedule.roundId;
  return {
    activeRoundId:schedule.roundId, rounds:[...rounds].map(([id,label])=>({id,label})),
    roundId, label: rounds.get(roundId) || roundId, closed: roundId!==schedule.roundId || schedule.closed === true,
    orders: rows.filter(o => effectiveRound(o).roundId === roundId),
    paymentLink: validMiaLink(payment?.paymentLink), recipient: String(payment?.name || payment?.recipientName || ''),
  };
}

export default function RoundPaymentPanel({ onClosed }: { onClosed?: () => Promise<void> }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState(false);
  const [drafts, setDrafts] = useState<Record<string,string>>({});

  const load = async (roundId = snapshot?.roundId) => {
    setBusy(true); setError(''); setPrepared(false); setDrafts({}); setNotice('');
    try { setSnapshot(await readSnapshot(roundId)); }
    catch (e) { setSnapshot(null); setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);

  const groups = useMemo(() => groupRoundOrders(snapshot?.orders || []).sort((a,b) => (a.entries[0].customerName || '').localeCompare(b.entries[0].customerName || '', 'ro')), [snapshot]);
  const discountTotal = groups.reduce((sum,g) => sum+g.discountBani,0);
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

  const signature = (s: Snapshot) => JSON.stringify(s.orders.map(o => [o.id,o.customerName,o.phone,o.totalBani,o.discountBani || 0,o.paid,o.items]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
  const saveDiscount = async (key: string) => {
    if (!snapshot || busy) return;
    const value = parseDiscountLei(drafts[key] || '0');
    if (value === null) { setError('Introdu o reducere validă în lei, cu maximum 2 zecimale.'); return; }
    setBusy(true); setError(''); setPrepared(false); setNotice('');
    try {
      const fresh = await readSnapshot(snapshot.roundId);
      const group = groupRoundOrders(fresh.orders).find(g => g.key === key);
      if (fresh.roundId !== snapshot.roundId || signature(fresh) !== signature(snapshot) || !group) {
        setSnapshot(fresh); setDrafts({}); throw new Error('Lista s-a modificat. Verifică și introdu din nou reducerea.');
      }
      const updates = allocateGroupDiscount(group.entries,value);
      const changed = updates.filter(u => orderDiscountBani(group.entries.find(o=>o.id===u.id)!) !== u.discountBani);
      if (changed.length) await updateDocumentsAtomically(changed.map(u=>({path:`groupOrders/${u.id}`,data:{discountBani:u.discountBani,updatedAt:new Date()}})));
      setSnapshot(await readSnapshot(snapshot.roundId));
      setDrafts(prev=>{const next={...prev};delete next[key];return next;});
      setNotice('Reducerea a fost salvată. Suma finală a fost recalculată.');
      try { await onClosed?.(); } catch {}
    } catch(e) {setError(e instanceof Error ? e.message : String(e));}
    finally {setBusy(false);}
  };
  const changePayment = async (key:string, markPaid:boolean) => {
    if (!snapshot || busy || Object.keys(drafts).length) return;
    setBusy(true);setError('');setNotice('');setPrepared(false);
    try {
      const fresh=await readSnapshot(snapshot.roundId);
      const group=groupRoundOrders(fresh.orders).find(g=>g.key===key);
      if (!group || fresh.roundId!==snapshot.roundId || signature(fresh)!==signature(snapshot)) {
        setSnapshot(fresh);throw new Error('Lista s-a modificat. Verifică din nou înainte de confirmare.');
      }
      if(!fresh.closed) throw new Error('Închide runda înainte de confirmarea încasărilor.');
      if (!window.confirm(markPaid ? `Confirmi că ai primit ${money(group.totalBani-group.paidBani)} lei de la ${group.entries[0].customerName || 'client'}?` : 'Anulezi confirmarea plății pentru toate trimiterile acestui client?')) return;
      const changes=group.entries.filter(o=>Boolean(o.paid)!==markPaid);
      if(changes.length) await updateDocumentsAtomically(changes.map(o=>({path:`groupOrders/${o.id}`,data:{paid:markPaid,updatedAt:new Date()}})));
      setSnapshot(await readSnapshot(snapshot.roundId));setNotice(markPaid?'Achitarea a fost confirmată.':'Confirmarea achitării a fost anulată.');
      try {await onClosed?.();}catch{}
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  };
  const prepare = async () => {
    if (!snapshot || busy || snapshot.roundId!==snapshot.activeRoundId) return;
    if (Object.keys(drafts).length) {setError('Salvează toate reducerile înainte de confirmare.');return;}
    setBusy(true);setError('');setPrepared(false);setNotice('');
    try {
      let fresh = await readSnapshot();
      if (fresh.roundId !== snapshot.roundId) { setSnapshot(fresh); throw new Error('Runda activă s-a schimbat. Verifică lista nouă.'); }
      if (!fresh.paymentLink) throw new Error('Salvează mai întâi linkul MIA oficial, generat de bancă.');
      if (!fresh.orders.length) throw new Error('Nu există comenzi în această rundă.');
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
    {snapshot && <label className="block rounded-2xl border bg-white p-3 text-xs font-semibold">Runda<select className="mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm" disabled={busy} value={snapshot.roundId} onChange={e=>{if(Object.keys(drafts).length&&!window.confirm('Schimbi runda fără a salva reducerile?'))return;void load(e.target.value);}}>{snapshot.rounds.map(r=><option key={r.id} value={r.id}>{r.label}{r.id===snapshot.activeRoundId?' · Activă':' · Istoric'}</option>)}</select></label>}
    <div className="rounded-[28px] bg-gradient-to-br from-[#173d2c] to-[#315b32] p-5 text-white">
      <div className="flex items-center justify-between gap-3"><WalletCards className="size-7"/><span className="rounded-full bg-white/15 px-3 py-1 text-xs">{snapshot ? snapshot.closed ? 'Rundă închisă' : 'În așteptarea confirmării' : 'Se încarcă'}</span></div>
      <p className="mt-4 text-sm text-white/75">{snapshot?.label || 'Runda curentă'} · Rest de încasat</p>
      <strong className="block text-3xl tabular-nums">{money(remaining)} lei</strong>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-4"><div><p className="text-xs text-white/70">Total inițial</p><strong>{money(total+discountTotal)} lei</strong></div><div><p className="text-xs text-white/70">Reduceri</p><strong>{money(discountTotal)} lei</strong></div><div><p className="text-xs text-white/70">Total final</p><strong>{money(total)} lei</strong></div><div><p className="text-xs text-white/70">Achitat</p><strong>{money(paid)} lei</strong></div></div>
    </div>
    {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-2xl bg-[#e8f3df] p-3 text-sm">{notice}</p>}
    <div className="rounded-[24px] border bg-white p-4">
      <div className="flex items-center justify-between gap-2"><h2 className="font-serif text-xl font-semibold">Lista de achitare</h2><Button variant="outline" onClick={()=>void load()} disabled={busy}><RefreshCw/> Actualizează</Button></div>
      <p className="mt-2 text-xs text-[#74837b]">O singură poziție per telefon și rundă. Plățile deja înregistrate se scad.</p>
      {groups.map(g=>{
        const locked=g.entries.filter(o=>o.paid).reduce((sum,o)=>sum+orderDiscountBani(o),0);
        const max=locked+g.entries.filter(o=>!o.paid).reduce((sum,o)=>sum+grossOrderBani(o),0);
        const draft=drafts[g.key];
        const parsed=draft===undefined?g.discountBani:parseDiscountLei(draft);
        const valid=parsed!==null&&parsed>=locked&&parsed<=max;
        return <div key={g.key} className="space-y-3 border-b py-4 last:border-b-0">
          <div className="flex justify-between gap-2"><strong className="break-words">{g.entries[0].customerName || 'Client'}</strong><span className="text-xs text-[#74837b]">{g.paid ? 'Achitat integral' : g.paidBani ? `Achitat: ${money(g.paidBani)} lei` : 'Neachitat'}</span></div>
          <div className="grid grid-cols-3 gap-2 text-xs"><div>Total inițial<strong className="block text-sm">{money(g.grossBani)} lei</strong></div><div>Reducere<strong className="block text-sm text-[#315b32]">−{money(g.discountBani)} lei</strong></div><div>Total final<strong className="block text-sm">{money(g.totalBani)} lei</strong></div></div>
          <div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-xs font-semibold">Reducere (lei)<input className="mt-1 h-11 w-full rounded-xl border bg-[#f7faf4] px-3 text-base" inputMode="decimal" value={draft ?? (g.discountBani/100).toFixed(2)} disabled={busy||g.paid} onChange={e=>{setPrepared(false);setDrafts(prev=>({...prev,[g.key]:e.target.value}));}}/></label><Button type="button" variant="outline" disabled={busy||g.paid||draft===undefined||!valid} onClick={()=>void saveDiscount(g.key)}>Salvează</Button>{draft!==undefined&&<Button type="button" variant="ghost" onClick={()=>setDrafts(prev=>{const next={...prev};delete next[g.key];return next;})}>Anulează</Button>}</div>
          {!valid&&<p className="text-xs text-red-600">Reducere permisă: {money(locked)} – {money(max)} lei.</p>}
          {g.paid&&<p className="text-xs text-[#74837b]">Reducerea este blocată pentru plata deja înregistrată.</p>}
          <p className="text-sm font-semibold text-[#173d2c]">Rest de achitat: {money(g.totalBani-g.paidBani)} lei {draft!==undefined&&valid&&parsed!==null&&<span className="ml-2 text-xs font-normal">După salvare: {money(g.grossBani-parsed-g.paidBani)} lei</span>}</p>
          <Button type="button" variant={g.paid?'outline':'default'} className="w-full" disabled={busy||!snapshot?.closed||Object.keys(drafts).length>0} onClick={()=>void changePayment(g.key,!g.paid)}><CheckCircle2/> {g.paid?'Anulează confirmarea plății':'Confirmă achitarea'}</Button>
        </div>;
      })}
      {!groups.length && <p className="py-4 text-sm text-[#74837b]">Nu există comenzi în runda curentă.</p>}
      <Button className="mt-4 h-auto min-h-12 w-full whitespace-normal bg-[#173d2c] py-3" disabled={busy || !snapshot || !groups.length || !snapshot.paymentLink || snapshot.roundId!==snapshot.activeRoundId || Object.keys(drafts).length>0} onClick={()=>void prepare()}><CheckCircle2/> {snapshot?.closed ? 'Confirmă lista pentru achitare' : 'Confirmă cu vânzătorul și închide runda'}</Button>
      {snapshot && snapshot.roundId!==snapshot.activeRoundId && <p className="mt-3 text-xs text-[#74837b]">Rundă istorică: poți gestiona achitările, dar nu genera un nou anunț pentru runda activă.</p>}
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
