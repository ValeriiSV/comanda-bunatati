import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut, updateProfile as updateAuthProfile, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Camera, LogOut, Save, UserCircle2 } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import './profile.css';

type Profile = {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  department?: string;
  avatarUrl?: string;
};

const MAX_AVATAR = 170_000;

async function compressAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Alege o imagine validă.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Imaginea originală este prea mare. Limita este 8 MB.');

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Imaginea nu poate fi citită.'));
      img.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    canvas.width = 420;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Browserul nu poate procesa imaginea.');
    const sx = Math.max(0, (image.naturalWidth - side) / 2);
    const sy = Math.max(0, (image.naturalHeight - side) / 2);
    ctx.drawImage(image, sx, sy, side, side, 0, 0, 420, 420);

    for (const quality of [0.72, 0.62, 0.52, 0.42, 0.34]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= MAX_AVATAR) return dataUrl;
    }
    throw new Error('Imaginea rămâne prea mare după compresie.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ displayName: '', phone: '', department: '', avatarUrl: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => onAuthStateChanged(auth, async (next) => {
    setUser(next);
    if (!next) return;
    try {
      const snap = await getDoc(doc(db, 'marketUsers', next.uid));
      if (!snap.exists()) return;
      const data = snap.data() as Profile;
      setProfile(data);
      setForm({
        displayName: data.displayName || next.displayName || '',
        phone: data.phone || '',
        department: data.department || '',
        avatarUrl: data.avatarUrl || '',
      });
    } catch (error) {
      setMessage(`Profilul nu poate fi încărcat: ${(error as Error).message}`);
    }
  }), []);

  const chooseAvatar = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const avatarUrl = await compressAvatar(file);
      setForm((current) => ({ ...current, avatarUrl }));
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!form.displayName.trim()) return setMessage('Numele nu poate fi gol.');
    setBusy(true);
    setMessage('');
    try {
      await updateDoc(doc(db, 'marketUsers', user.uid), {
        displayName: form.displayName.trim(),
        phone: form.phone.trim(),
        department: form.department.trim(),
        avatarUrl: form.avatarUrl,
        updatedAt: serverTimestamp(),
      });
      await updateAuthProfile(user, { displayName: form.displayName.trim() });
      setProfile((current) => current ? { ...current, ...form, displayName: form.displayName.trim() } : current);
      setMessage('Profilul a fost salvat.');
    } catch (error) {
      setMessage(`Nu am putut salva profilul: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <main className="profile-page">
        <section className="profile-card profile-empty">
          <UserCircle2 size={52} />
          <h1>Profilul meu</h1>
          <p>Trebuie să fii autentificat în Orbico Market.</p>
          <Link to="/">Înapoi la Market</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <section className="profile-card">
        <div className="profile-topbar">
          <button onClick={() => navigate('/')}><ArrowLeft size={18}/> Orbico Market</button>
          <button className="profile-logout" onClick={async () => { await signOut(auth); navigate('/'); }}><LogOut size={17}/> Ieși</button>
        </div>

        <div className="profile-heading">
          <div className="profile-avatar-wrap">
            {form.avatarUrl ? <img src={form.avatarUrl} alt="Poza de profil" /> : <UserCircle2 size={80} />}
            <label className="profile-camera" title="Schimbă poza">
              <Camera size={18}/>
              <input type="file" accept="image/*" onChange={(e) => chooseAvatar(e.target.files?.[0])}/>
            </label>
          </div>
          <div>
            <span>CONT ORBICO MARKET</span>
            <h1>{form.displayName || 'Profilul meu'}</h1>
            <p>{profile?.email || user.email}</p>
          </div>
        </div>

        {message && <div className="profile-message">{message}</div>}

        <form className="profile-form" onSubmit={save}>
          <label>Nume și prenume
            <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Nume și prenume" />
          </label>
          <label>Telefon
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Ex: 069 123 456" />
          </label>
          <label>Departament / echipă
            <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Ex: Sales, Logistics, Finance" />
          </label>
          <label>Email
            <input value={profile?.email || user.email || ''} disabled />
          </label>

          <div className="profile-photo-row">
            <span>Poza de profil se comprimă automat și rămâne în Firebase Spark.</span>
            {form.avatarUrl && <button type="button" onClick={() => setForm({ ...form, avatarUrl: '' })}>Șterge poza</button>}
          </div>

          <button className="profile-save" disabled={busy}><Save size={18}/> {busy ? 'Se salvează…' : 'Salvează profilul'}</button>
        </form>
      </section>
    </main>
  );
}
