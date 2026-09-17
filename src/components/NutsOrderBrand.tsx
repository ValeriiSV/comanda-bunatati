import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './nuts-order-brand.css';

export default function NutsOrderBrand() {
  useEffect(() => {
    document.title = 'Nuci & Fructe Uscate · Orbico Market';
    const frame = window.requestAnimationFrame(() => {
      document.querySelectorAll('h1,h2,h3').forEach((node) => {
        const text = (node.textContent || '').trim();
        if (text === 'Comanda lunii') node.textContent = 'Nuci & Fructe Uscate';
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <section className="nuts-brand-shell">
      <div className="nuts-brand-inner">
        <Link to="/comenzi-comune" className="nuts-brand-back"><ArrowLeft size={18}/> Comenzi comune</Link>
        <img src="/nuci-fructe-logo.jpg" alt="Nuci și Fructe Uscate" />
        <div>
          <span>ORBICO MARKET · COMANDĂ COMUNĂ</span>
          <h1>Nuci & Fructe Uscate</h1>
          <p>Nuci, fructe uscate, miere și bunătăți pentru comanda comună.</p>
        </div>
      </div>
    </section>
  );
}
