import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { saveExternalAdminSession } from '@/lib/firebaseRest';
import SellerExcelExport from '@/components/SellerExcelExport';
import AdminWowDashboard from '@/components/AdminWowDashboard';
import AdminStablePage from './AdminStablePage';

export default function AdminPage() {
  const [ready, setReady] = useState(false);

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

  return (
    <div className="relative">
      <Link
        to="/"
        className="fixed bottom-5 left-5 z-[100] inline-flex items-center gap-2 rounded-full border border-[#d9e3d7] bg-white px-4 py-2.5 text-sm font-semibold text-[#173d2c] shadow-lg transition hover:bg-[#f2f5ed]"
      >
        <ArrowLeft className="size-4" />
        Înapoi la catalog
      </Link>
      <AdminWowDashboard />
      <AdminStablePage />
      <SellerExcelExport />
    </div>
  );
}
