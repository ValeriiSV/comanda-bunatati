import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import OrderPage from './pages/OrderPage';
import AdminPage from './pages/AdminPage';
import MiaPaymentPage from './pages/MiaPaymentPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OrderPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/mia" element={<MiaPaymentPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
