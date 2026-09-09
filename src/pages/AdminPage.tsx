import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AdminStablePage from './AdminStablePage';

export default function AdminPage() {
  return (
    <div className="relative">
      <Link
        to="/"
        className="fixed bottom-5 left-5 z-[100] inline-flex items-center gap-2 rounded-full border border-[#d9e3d7] bg-white px-4 py-2.5 text-sm font-semibold text-[#173d2c] shadow-lg transition hover:bg-[#f2f5ed]"
      >
        <ArrowLeft className="size-4" />
        Înapoi la catalog
      </Link>
      <AdminStablePage />
    </div>
  );
}
