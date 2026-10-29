import type { ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  CalendarClock,
  ExternalLink,
  LayoutDashboard,
  MessageCircle,
  Package,
  ScanLine,
  Settings,
  ShoppingBag,
  WalletCards,
} from 'lucide-react';

export type AdminSection = 'dashboard' | 'orders' | 'packing' | 'products' | 'schedule' | 'campaign' | 'payments' | 'settings';

const navigation = [
  { section: 'dashboard', to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { section: 'orders', to: '/admin/comenzi', label: 'Comenzi', icon: ShoppingBag },
  { section: 'packing', to: '/admin/pregatire', label: 'Pregătire & ridicare', icon: ScanLine },
  { section: 'products', to: '/admin/produse', label: 'Produse', icon: Package },
  { section: 'schedule', to: '/admin/program', label: 'Program', icon: CalendarClock },
  { section: 'campaign', to: '/admin/viber', label: 'Campanie Viber', icon: MessageCircle },
  { section: 'payments', to: '/admin/plati', label: 'Plăți / MIA', icon: WalletCards },
  { section: 'settings', to: '/admin/setari', label: 'Setări', icon: Settings },
] as const;

const sectionCopy: Record<AdminSection, { eyebrow: string; title: string; description: string }> = {
  dashboard: { eyebrow: 'Privire de ansamblu', title: 'Dashboard', description: 'Situația rundei curente și fluxul comenzilor.' },
  orders: { eyebrow: 'Administrare', title: 'Comenzi', description: 'Comenzi, plăți, editare și exporturi pentru vânzător.' },
  packing: { eyebrow: 'Operațiuni', title: 'Pregătire & ridicare', description: 'Pregătește comenzile, scanează QR și marchează predarea.' },
  products: { eyebrow: 'Catalog', title: 'Produse', description: 'Adaugă, modifică sau ascunde produsele din catalog.' },
  schedule: { eyebrow: 'Runda de comandă', title: 'Program și termen', description: 'Configurează datele, mesajul public și ora limită.' },
  campaign: { eyebrow: 'Comunicare', title: 'Campanie Viber', description: 'Generează și distribuie mesajul rundei în grupul colegilor.' },
  payments: { eyebrow: 'Încasări', title: 'Plăți și MIA', description: 'Configurează beneficiarul și datele de transfer MIA.' },
  settings: { eyebrow: 'Panou manager', title: 'Setări', description: 'Sesiune, acces și scurtături administrative.' },
};

export default function AdminLayout({
  section,
  actions,
  children,
}: {
  section: AdminSection;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const copy = sectionCopy[section];

  return (
    <main className="min-h-screen bg-[#f2f5ed] text-[#173d2c]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="border-b border-[#d9e3d7] bg-white/90 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-4 py-4 lg:px-5 lg:py-6">
            <Link to="/admin" className="flex min-w-0 items-center gap-3">
              <img src="/valera-logo.svg?v=8" alt="Bunătăți cu Valera" className="size-11 shrink-0 rounded-full border border-[#d9e3d7] bg-white object-cover" />
              <div className="min-w-0">
                <strong className="block truncate font-serif text-lg">Bunătăți cu Valera</strong>
                <span className="block text-xs text-[#74837b]">Panoul managerului</span>
              </div>
            </Link>
            <Link to="/" className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#d9e3d7] text-[#607269] lg:hidden" title="Deschide catalogul">
              <ExternalLink className="size-4" />
            </Link>
          </div>

          <nav aria-label="Navigare panou manager" className="flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:space-y-1.5 lg:overflow-visible lg:px-3">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.section}
                  to={item.to}
                  end={'end' in item ? item.end : undefined}
                  className={({ isActive }) => `flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition lg:w-full ${isActive ? 'bg-[#173d2c] text-white shadow-sm' : 'border border-[#dfe7df] bg-white text-[#52645b] hover:bg-[#f2f5ed] lg:border-transparent lg:bg-transparent'}`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto hidden px-5 pb-6 pt-5 lg:block">
            <Link to="/" className="flex items-center gap-2 rounded-xl border border-[#d9e3d7] px-3.5 py-2.5 text-sm font-semibold text-[#607269] hover:bg-[#f2f5ed]">
              <ExternalLink className="size-4" /> Deschide catalogul
            </Link>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-[#d9e3d7] bg-white/75 px-4 py-5 backdrop-blur sm:px-7 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.12em] text-[#8b6b3f]">{copy.eyebrow}</p>
                <h1 className="mt-1 font-serif text-3xl font-semibold">{copy.title}</h1>
                <p className="mt-1 text-sm text-[#74837b]">{copy.description}</p>
              </div>
              {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </div>
          </header>

          <div className="p-4 sm:p-7 lg:p-8">{children}</div>
        </div>
      </div>
    </main>
  );
}
