import { Link } from 'react-router-dom';
import { ArrowLeft, PackageCheck, Settings2 } from 'lucide-react';
import BucuriaOrderPage from './BucuriaOrderPage';
import './bucuria-shop.css';

export default function BucuriaShopPage() {
  return (
    <div className="bucuria-shop-wrap">
      <header className="bucuria-shop-header">
        <div className="bucuria-shop-header-inner">
          <Link to="/comenzi-comune" className="bucuria-shop-back"><ArrowLeft size={18}/> Comenzi comune</Link>
          <div className="bucuria-shop-brand">
            <span className="bucuria-shop-mark">🍫</span>
            <div><strong>Bucuria – Dulciuri</strong><small>SOLDI SRL / SA Bucuria</small></div>
          </div>
          <nav className="bucuria-shop-nav">
            <Link to="/bucuria/status"><PackageCheck size={17}/><span>Status</span></Link>
            <Link to="/bucuria/manager"><Settings2 size={17}/><span>Manager</span></Link>
          </nav>
        </div>
      </header>
      <BucuriaOrderPage />
    </div>
  );
}
