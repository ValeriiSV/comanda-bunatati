import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { saveExternalAdminSession } from '@/lib/firebaseRest';
import type { AdminSection } from '@/components/AdminLayout';
import AdminStablePage from './AdminStablePage';

const sectionByPath: Record<string, AdminSection> = {
  '/admin': 'dashboard',
  '/admin/comenzi': 'orders',
  '/admin/produse': 'products',
  '/admin/program': 'schedule',
  '/admin/plati': 'payments',
  '/admin/setari': 'settings',
};

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const location = useLocation();
  const section = sectionByPath[location.pathname] || 'dashboard';

  useEffect(() => {
    let finished = false;
    const finish = () => {
      if (!finished) {
        finished = true;
        setReady(true);
      }
    };

    const timer = window.setTimeout(finish, 1500);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const idToken = await user.getIdToken(true);
          saveExternalAdminSession({
            idToken,
            uid: user.uid,
            email: (user.email || '').toLowerCase(),
          });
        }
      } catch {
        // AdminStablePage va afișa loginul dacă sesiunea nu poate fi reînnoită.
      } finally {
        window.clearTimeout(timer);
        finish();
        unsubscribe();
      }
    });

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f2f5ed] text-[#607269]">
        <p>Se pregătește sesiunea…</p>
      </main>
    );
  }

  return <AdminStablePage section={section} />;
}
