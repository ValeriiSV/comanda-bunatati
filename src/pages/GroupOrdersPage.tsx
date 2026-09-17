import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, ChevronRight, ShoppingBasket, Users } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import './group-orders.css';

type Profile = {
  uid: string;
  email: string;
  displayName: string;
  approved: boolean;
  blocked?: boolean;
};

type BucuriaCampaign = {
  status?: 'draft' | 'open' | 'closed' | 'sent' | 'received' | 'distributed';
};

const statusLabel: Record<string, string> = {
  draft: 'În pregătire',
  open: 'Comandă deschisă',
  closed: 'Închisă',
  sent: 'Trimisă furnizorului',
  received: 'Primită',
  distributed: 'Distribuită',
};

export default function GroupOrdersPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bucuria, setBucuria] = useState<BucuriaCampaign | null>(null);

  const approved = profile?.approved === true && profile?.blocked !== true;

  useEffect(() => onAuthStateChanged(auth, async (next) => {
    setUser(next);
    setProfile(null);
    if (!next) return;
    try {
      const snap = await getDoc(doc(db, 'marketUsers', next.uid));
      if (snap.exists()) setProfile(snap.data() as Profile);
    } catch {
      // The page below will remain locked if profile cannot be loaded.
    }
  }), []);

  useEffect(() => {
    if (!user || !approved) return;
    return onSnapshot(doc(db, 'groupCampaigns', 'bucuria'), (snap) => {
      setBucuria(snap.exists() ? snap.data() as BucuriaCampaign : null);
    });
  }, [user, approved]);

  if (!user) {
    return (
      <main className="group-shell">
        <section className="group-empty">
          <ShoppingBasket size={48} />
          <h1>Comenzi comune</h1>
          <p>Autentifică-te în Orbico Market pentru a vedea comenzile comune.</p>
          <Link to="/">Înapoi la Orbico Market</Link>
        </section>
      </main>
    );
  }

  if (!approved) {
    return (
      <main className="group-shell">
        <section className="group-empty">
          <Users size={48} />
          <h1>Contul trebuie aprobat</h1>
          <p>Comenzile comune sunt disponibile doar colegilor aprobați.</p>
          <Link to="/">Înapoi la Orbico Market</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="group-shell group-landing">
      <header className="group-topbar">
        <Link to="/" className="group-back"><ArrowLeft size={18}/> Orbico Market</Link>
        <div>
          <span>ORBICO MARKET · INTERN</span>
          <h1>Comenzi comune</h1>
          <p>Alege comanda la care vrei să participi.</p>
        </div>
      </header>

      <section className="common-order-grid" aria-label="Comenzi disponibile">
        <Link to="/comanda" className="common-order-card nuts-order-card">
          <div className="common-card-cover nuts-cover">
            <img src="/nuci-fructe-logo.jpg" alt="Nuci și Fructe Uscate" />
          </div>
          <div className="common-card-body">
            <span>COMANDĂ COMUNĂ</span>
            <h2>Nuci & Fructe Uscate</h2>
            <p>Nuci, fructe uscate, miere și produsele cunoscute din comanda lunară.</p>
            <strong>Deschide comanda <ChevronRight size={18}/></strong>
          </div>
        </Link>

        <Link to="/comenzi-comune/bucuria" className="common-order-card bucuria-order-card">
          <div className="common-card-cover bucuria-cover" aria-hidden="true">
            <div className="bucuria-mark">B</div>
            <div>
              <b>BUCURIA</b>
              <small>DULCIURI</small>
            </div>
          </div>
          <div className="common-card-body">
            <span>SOLDI SRL / SA BUCURIA</span>
            <h2>Bucuria – Dulciuri</h2>
            <p>Catalog de dulciuri cu comandă rapidă, cantități și total automat.</p>
            <div className="common-card-bottom">
              <em className={`common-status status-${bucuria?.status || 'draft'}`}>
                {bucuria ? statusLabel[bucuria.status || 'draft'] : 'În pregătire'}
              </em>
              <strong>Deschide comanda <ChevronRight size={18}/></strong>
            </div>
          </div>
        </Link>
      </section>
    </main>
  );
}
