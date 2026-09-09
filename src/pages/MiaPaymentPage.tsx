import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Save, Smartphone, WalletCards } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMiaPayment } from '@/hooks/useMiaPayment';

export default function MiaPaymentPage() {
  const { payment } = useMiaPayment();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setRecipientName(payment.recipientName || '');
    setPhone(payment.phone || '');
    setPaymentLink(payment.paymentLink || '');
  }, [payment.recipientName, payment.phone, payment.paymentLink]);

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setAuthorized(false);
      setChecking(false);
      return;
    }
    const admin = await getDoc(doc(db, 'admins', user.uid));
    if (!admin.exists()) {
      await signOut(auth);
      setAuthorized(false);
      setChecking(false);
      return;
    }
    setAuthorized(true);
    setChecking(false);
  }), []);

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await setDoc(doc(db, 'settings', 'miaPayment'), {
        recipientName: recipientName.trim(),
        phone: phone.trim(),
        paymentLink: paymentLink.trim(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setNotice('Datele MIA au fost salvate. Colegii le vor vedea după trimiterea comenzii.');
    } catch {
      setError('Nu am putut salva setările MIA. Verifică regulile Firestore pentru colecția settings.');
    } finally {
      setSaving(false);
    }
  };

  if (checking) return <main className="grid min-h-screen place-items-center bg-[#f2f5ed] text-[#607269]">Se verifică accesul…</main>;

  if (!authorized) return <main className="grid min-h-screen place-items-center bg-[#f2f5ed] p-5 text-[#173d2c]">
    <section className="w-full max-w-md rounded-[28px] border border-[#d9e3d7] bg-white p-7 text-center shadow-[0_24px_70px_rgba(23,61,44,.12)]">
      <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-[#e8f0e2]"><WalletCards /></span>
      <h1 className="font-serif text-3xl font-semibold">Setări MIA</h1>
      <p className="mt-3 text-sm leading-6 text-[#74837b]">Autentifică-te mai întâi în panoul managerului.</p>
      <Link to="/admin"><Button className="mt-6 bg-[#173d2c]">Mergi la Admin</Button></Link>
    </section>
  </main>;

  return <main className="min-h-screen bg-[#f2f5ed] p-4 text-[#173d2c] sm:p-8">
    <div className="mx-auto max-w-3xl">
      <Link to="/admin" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#607269]"><ArrowLeft className="size-4" /> Înapoi la Admin</Link>
      <section className="rounded-[28px] border border-[#d9e3d7] bg-white p-6 shadow-[0_20px_60px_rgba(23,61,44,.08)] sm:p-8">
        <div className="mb-7 flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#e8f0e2]"><WalletCards /></span>
          <div><h1 className="font-serif text-3xl font-semibold">Încasare prin MIA</h1><p className="mt-1 text-sm leading-6 text-[#74837b]">Configurează unde colegii îți transferă banii după ce trimit comanda.</p></div>
        </div>

        {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p className="mb-4 rounded-xl bg-[#e8f3df] p-3 text-sm text-[#315b32]">{notice}</p>}

        <div className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Numele beneficiarului</span><Input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Ex: Valeriu" className="h-11" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Numărul asociat MIA</span><Input type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+373 6X XXX XXX" className="h-11" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Link MIA de plată <span className="font-normal text-[#87928c]">(opțional)</span></span><Input type="url" value={paymentLink} onChange={(event) => setPaymentLink(event.target.value)} placeholder="Lipește aici linkul MIA generat de banca ta" className="h-11" /><span className="mt-1.5 block text-xs leading-5 text-[#87928c]">Dacă îl lași gol, colegii vor vedea numărul MIA și suma de transfer. Dacă îl completezi, apare și butonul „Plătește prin MIA”.</span></label>
        </div>

        <Button onClick={save} disabled={saving || !phone.trim()} className="mt-6 h-11 bg-[#173d2c]"><Save /> {saving ? 'Se salvează…' : 'Salvează setările MIA'}</Button>

        <div className="mt-8 rounded-2xl border border-[#dce5d9] bg-[#f7faf4] p-5">
          <p className="text-xs font-bold uppercase tracking-[.1em] text-[#607269]">Previzualizare</p>
          <div className="mt-3 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white"><Smartphone /></span><div><p className="font-semibold">{recipientName || 'Beneficiar MIA'}</p><p className="text-sm text-[#607269]">{phone || 'Numărul MIA nu este setat'}</p></div></div>
          {paymentLink && <Button variant="outline" className="mt-4" onClick={() => window.open(paymentLink, '_blank', 'noopener,noreferrer')}><ExternalLink /> Testează linkul MIA</Button>}
        </div>
      </section>
    </div>
  </main>;
}
