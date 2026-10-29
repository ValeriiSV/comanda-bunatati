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
  Target,
  WalletCards,
} from 'lucide-react';

export type AdminSection =
  | 'dashboard'
  | 'orders'
  | 'packing'
  | 'products'
  | 'goals'
  | 'schedule'
  | 'campaign'
  | 'payments'
  | 'settings';

const navigationGroups = [
  {
    label: 'Privire generală',
    items: [
      { section: 'dashboard', to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Comenzi',
    items: [
      { section: 'orders', to: '/admin/comenzi', label: 'Comenzi', icon: ShoppingBag },
      { section: 'packing', to: '/admin/pregatire', label: 'Pregătire & ridicare', icon: ScanLine },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { section: 'products', to: '/admin/produse', label: 'Produse', icon: Package },
      { section: 'goals', to: '/admin/praguri', label: 'Praguri colective', icon: Target },
    ],
  },
  {
    label: 'Comunicare',
    items: [
      { section: 'schedule', to: '/admin/program', label: 'Program', icon: CalendarClock },
      { section: 'campaign', to: '/admin/viber', label: 'Campanie Viber', icon: MessageCircle },
    ],
  },
  {
    label: 'Finanțe & sistem',
    items: [
      { section: 'payments', to: '/admin/plati', label: 'Plăți / MIA', icon: WalletCards },
      { section: 'settings', to: '/admin/setari', label: 'Setări', icon: Settings },
    ],
  },
] as const;

const sectionCopy: Record<AdminSection, { eyebrow: string; title: string; description: string }> = {
  dashboard: { eyebrow: 'Privire de ansamblu', title: 'Dashboard', description: 'Cifrele importante și starea rundei curente.' },
  orders: { eyebrow: 'Administrare', title: 'Comenzi', description: 'Editează comenzile, plata și exporturile.' },
  packing: { eyebrow: 'Operațiuni', title: 'Pregătire & ridicare', description: 'Pregătește comenzile, scanează QR și marchează predarea.' },
  products: { eyebrow: 'Catalog', title: 'Produse', description: 'Adaugă, modifică sau ascunde produsele din catalog.' },
  goals: { eyebrow: 'Catalog', title: 'Praguri colective', description: 'Configurează ținte de cantitate și prețuri de grup.' },
  schedule: { eyebrow: 'Runda de comandă', title: 'Program și termen', description: 'Deschide sau închide runda și configurează termenul.' },
  campaign: { eyebrow: 'Comunicare', title: 'Campanie Viber', description: 'Generează și distribuie mesajul rundei în grupul colegilor.' },
  payments: { eyebrow: 'Încasări', title: 'Plăți și MIA', description: 'Unicul loc pentru beneficiarul și datele de plată MIA.' },
  settings: { eyebrow: 'Panou manager', title: 'Setări', description: 'Sesiune, acces și operațiuni tehnice.' },
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
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[260px_minmax(0,1fr)]">
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

          <nav aria-label="Navigare panou manager" className="flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:space-y-4 lg:overflow-visible lg:px-3">
            {navigationGroups.map((group) => (
              <div key={group.label} className="contents lg:block">
                <p className="mb-1 hidden px-3 text-[10px] font-bold uppercase tracking-[.14em] text-[#9aa59f] lg:block">{group.label}</p>
                <div className="contents lg:block lg:space-y-1">
                  {group.items.map((item) => {
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
                </div>
              </div>
            ))}
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
