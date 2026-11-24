import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { saveExternalAdminSession } from '@/lib/firebaseRest';
import type { AdminSection } from '@/components/AdminLayout';
import AdminStablePage from './AdminStablePage';
import './manager.css';

const sectionByPath: Record<string, AdminSection> = {
  '/admin': 'dashboard',
  '/admin/comenzi': 'orders',
  '/admin/pregatire': 'packing',
  '/admin/produse': 'products',
  '/admin/praguri': 'goals',
  '/admin/program': 'schedule',
  '/admin/viber': 'campaign',
  '/admin/plati': 'payments',
  '/admin/setari': 'settings',
};

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const location = useLocation();
  const section = sectionByPath[location.pathname.replace(/\/$/, '')] || 'dashboard';
  useEffect(() => {
    const oldTitle = document.title;
    document.title = 'Bunătăți Manager';
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const oldViewport = viewport?.content;
    if (viewport) viewport.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
    const tags: [string, Record<string,string>][] = [
      ['link', {rel:'manifest', href:'/manager.webmanifest'}],
      ['link', {rel:'apple-touch-icon', href:'/manager-icon-180.png'}],
      ['meta', {name:'apple-mobile-web-app-capable', content:'yes'}],
      ['meta', {name:'apple-mobile-web-app-title', content:'Bunătăți Manager'}],
      ['meta', {name:'apple-mobile-web-app-status-bar-style', content:'default'}],
      ['meta', {name:'theme-color', content:'#f2f5ed'}],
    ];
    const nodes = tags.map(([name, attrs]) => { const node=document.createElement(name); Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,value)); document.head.appendChild(node); return node; });
    return () => { nodes.forEach(node=>node.remove()); document.title=oldTitle; if(viewport && oldViewport)viewport.content=oldViewport; };
  }, []);

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
