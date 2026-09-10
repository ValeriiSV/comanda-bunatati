import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import OrderPage from './pages/OrderPage';
import AdminPage from './pages/AdminPage';
import MiaPaymentPage from './pages/MiaPaymentPage';
import OrderStatusPage from './pages/OrderStatusPage';
import AppErrorBoundary from './components/AppErrorBoundary';
import './index.css';
import './wow.css';
import './product-images.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<OrderPage />} />
          <Route path="/status" element={<OrderStatusPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/mia" element={<MiaPaymentPage />} />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
