import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MarketplacePage from './pages/MarketplacePage';
import OrderPage from './pages/OrderPage';
import GroupOrdersPage from './pages/GroupOrdersPage';
import BucuriaOrderPage from './pages/BucuriaOrderPage';
import AdminPage from './pages/AdminPage';
import MiaPaymentPage from './pages/MiaPaymentPage';
import OrderStatusPage from './pages/OrderStatusPage';
import ProfilePage from './pages/ProfilePage';
import AppErrorBoundary from './components/AppErrorBoundary';
import OrderDeadlinePublicEnhancer from './components/OrderDeadlinePublicEnhancer';
import AppUtilityNav from './components/AppUtilityNav';
import MarketplaceSellerPhoneEnhancer from './components/MarketplaceSellerPhoneEnhancer';
import NutsOrderBrand from './components/NutsOrderBrand';
import './index.css';
import './wow.css';
import './pages/marketplace-nav-cleanup.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AppUtilityNav />
        <Routes>
          <Route path="/" element={<><MarketplaceSellerPhoneEnhancer /><MarketplacePage /></>} />
          <Route path="/comenzi-comune" element={<GroupOrdersPage />} />
          <Route path="/comenzi-comune/bucuria" element={<BucuriaOrderPage />} />
          <Route path="/comanda" element={<><NutsOrderBrand /><OrderDeadlinePublicEnhancer /><OrderPage /></>} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route path="/status" element={<OrderStatusPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/mia" element={<MiaPaymentPage />} />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
