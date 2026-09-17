import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import './group-orders-hub.css';

export default function GroupOrdersHubPage() {
  return (
    <main className="orders-hub-shell">
      <header className="orders-hub-topbar">
        <Link to="/" className="orders-hub-back"><ArrowLeft size={18}/> Orbico Market</Link>
        <div>
          <span>ORBICO MARKET · INTERN</span>
          <h1>Comenzi comune</h1>
          <p>Alege furnizorul și continuă comanda.</p>
        </div>
      </header>

      <section className="orders-hub-grid" aria-label="Comenzi comune disponibile">
        <Link to="/comanda" className="orders-hub-card nuts-card">
          <div className="orders-hub-media">
            <img src="/nuci-fructe-logo.svg" alt="Nuci și fructe uscate" />
          </div>
          <div className="orders-hub-content">
            <span>COMANDĂ COMUNĂ</span>
            <h2>Nuci și fructe uscate</h2>
            <p>Nuci, semințe, fructe uscate, miere și produsele din catalogul actual.</p>
            <strong>Deschide comanda <ChevronRight size={18}/></strong>
          </div>
        </Link>

        <Link to="/comenzi-comune/bucuria" className="orders-hub-card bucuria-card">
          <div className="orders-hub-media bucuria-media">
            <div className="bucuria-mark">B</div>
            <div><b>BUCURIA</b><small>Dulciuri</small></div>
          </div>
          <div className="orders-hub-content">
            <span>SOLDI SRL / SA BUCURIA</span>
            <h2>Bucuria – Dulciuri</h2>
            <p>Caramele, ciocolată, zefir, biscuiți, drajeuri și alte produse Bucuria.</p>
            <strong>Deschide comanda <ChevronRight size={18}/></strong>
          </div>
        </Link>
      </section>
    </main>
  );
}
