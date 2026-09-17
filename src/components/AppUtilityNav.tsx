import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, ShoppingBasket, UserCircle2 } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import '@/pages/profile.css';

type MiniProfile = { displayName?: string; avatarUrl?: string };

export default function AppUtilityNav() {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [profile, setProfile] = useState<MiniProfile | null>(null);
  const [marketNav, setMarketNav] = useState<Element | null>(null);

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

  useEffect(() => {
    if (location.pathname !== '/') {
      setMarketNav(null);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      setMarketNav(document.querySelector('.market-nav'));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  if (location.pathname === '/comanda') {
    return (
      <Link to="/comenzi-comune" className="app-utility app-utility-back" aria-label="Înapoi la Comenzi comune">
        <ArrowLeft size={18} /> <span>Comenzi comune</span>
      </Link>
    );
  }

  if (location.pathname === '/') {
    return (
      <>
        {marketNav && createPortal(
          <Link to="/comenzi-comune" className="mobile-monthly-nav" aria-label="Deschide Comenzi comune">
            <ShoppingBasket size={18} /> <span>Comenzi comune</span>
          </Link>,
          marketNav,
        )}
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
