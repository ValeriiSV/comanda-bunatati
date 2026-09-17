import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './nuts-order-brand.css';

export default function NutsOrderBrand() {
  useEffect(() => {
    document.title = 'Nuci & Fructe Uscate · Orbico Market';

    const rename = () => {
      document.querySelectorAll('h1,h2,h3,p,span,strong').forEach((node) => {
        const text = node.textContent || '';
        if (/comanda lunii/i.test(text)) {
          node.textContent = text.replace(/comanda lunii/gi, 'Nuci & Fructe Uscate');
        }
      });
    };

    const frame = window.requestAnimationFrame(rename);
    const timer = window.setTimeout(rename, 250);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
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
