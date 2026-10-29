import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import OrderPage from './pages/OrderPage';
import AdminPage from './pages/AdminPage';
import OrderStatusPage from './pages/OrderStatusPage';
import AppErrorBoundary from './components/AppErrorBoundary';
import OrderDeadlinePublicEnhancer from './components/OrderDeadlinePublicEnhancer';
import './index.css';
import './wow.css';

const BunatatiPage = () => (
  <>
    <OrderDeadlinePublicEnhancer />
    <OrderPage />
  </>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<BunatatiPage />} />
          <Route path="/comanda" element={<BunatatiPage />} />
          <Route path="/status" element={<OrderStatusPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/comenzi" element={<AdminPage />} />
          <Route path="/admin/pregatire" element={<AdminPage />} />
          <Route path="/admin/produse" element={<AdminPage />} />
          <Route path="/admin/praguri" element={<AdminPage />} />
          <Route path="/admin/program" element={<AdminPage />} />
          <Route path="/admin/viber" element={<AdminPage />} />
          <Route path="/admin/plati" element={<AdminPage />} />
          <Route path="/admin/setari" element={<AdminPage />} />
          <Route path="/admin/mia" element={<Navigate to="/admin/plati" replace />} />

          {/* Rutele vechi Orbico Market rămân doar ca redirect ca linkurile salvate să nu se rupă. */}
          <Route path="/comenzi-comune" element={<Navigate to="/" replace />} />
          <Route path="/comenzi-comune/bucuria" element={<Navigate to="/" replace />} />
          <Route path="/bucuria" element={<Navigate to="/" replace />} />
          <Route path="/bucuria/status" element={<Navigate to="/status" replace />} />
          <Route path="/bucuria/manager" element={<Navigate to="/admin" replace />} />
          <Route path="/profil" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
