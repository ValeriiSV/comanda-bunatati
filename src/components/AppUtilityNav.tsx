import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, CalendarDays, UserCircle2 } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import '@/pages/profile.css';

type MiniProfile = { displayName?: string; avatarUrl?: string };

export default function AppUtilityNav() {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [profile, setProfile] = useState<MiniProfile | null>(null);

  useEffect(() => onAuthStateChanged(auth, async (next) => {
    setUser(next);
    setProfile(null);
    if (!next) return;
    try {
      const snap = await getDoc(doc(db, 'marketUsers', next.uid));
      if (snap.exists()) setProfile(snap.data() as MiniProfile);
    } catch {
      // Navigation remains usable even if profile data cannot be loaded.
    }
  }), []);

  if (location.pathname === '/comanda') {
    return (
      <Link to="/" className="app-utility app-utility-back" aria-label="Înapoi la Orbico Market">
        <ArrowLeft size={18} /> <span>Orbico Market</span>
      </Link>
    );
  }

  if (location.pathname === '/') {
    return (
      <>
        <Link to="/comanda" className="app-utility app-utility-monthly" aria-label="Deschide Comanda lunii">
          <CalendarDays size={18} /> <span>Comanda lunii</span>
        </Link>
        {user && (
          <Link to="/profil" className="app-utility app-utility-profile" aria-label="Deschide profilul meu">
            {profile?.avatarUrl
              ? <img src={profile.avatarUrl} alt="" />
              : <UserCircle2 size={21} />}
            <span>{profile?.displayName || 'Profilul meu'}</span>
          </Link>
        )}
      </>
    );
  }

  return null;
}
