import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, BarChart3, Boxes, ClipboardList, Hourglass, LayoutDashboard, LogOut, Menu, Moon, PackagePlus, Pill, ScanBarcode, Search,
  Settings as SettingsIcon, Sun, SunMoon, Truck, X, ArrowRightLeft,
} from 'lucide-react';
import { can, computeAlerts, ROLE_LABEL, summarizeMedicine, type Permission } from '@medistock/core';
import { useData } from '../lib/store';
import { useTheme } from '../lib/theme';
import { BandPill, cx, StockBadge } from '../components/ui';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-md">
      <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-brand text-on-brand"><Pill size={18} strokeWidth={2} /></span>
      <span className="font-display text-lg font-bold tracking-tight text-ink">MediStock</span>
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { ds, today, user } = useData();
  const alerts = useMemo(() => computeAlerts(ds, today).filter((a) => a.status === 'open'), [ds, today]);
  const expiring = alerts.filter((a) => a.kind === 'expiry' && (a.band === 'expired' || a.band === 'critical')).length;
  const groups: { title?: string; items: { to: string; label: string; icon: React.ReactNode; count?: number; perm?: Permission; end?: boolean }[] }[] = [
    { items: [
      { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} />, end: true },
      { to: '/inventory', label: 'Inventory', icon: <Boxes size={18} /> },
      { to: '/expiry', label: 'Expiry Center', icon: <Hourglass size={18} />, count: expiring },
      { to: '/alerts', label: 'Alerts', icon: <Bell size={18} />, count: alerts.length },
    ] },
    { title: 'Stock', items: [
      { to: '/receive', label: 'Receive stock', icon: <PackagePlus size={18} />, perm: 'receive' },
      { to: '/dispense', label: 'Dispense & adjust', icon: <ArrowRightLeft size={18} />, perm: 'dispense' },
    ] },
    { title: 'Purchasing', items: [
      { to: '/suppliers', label: 'Suppliers', icon: <Truck size={18} /> },
      { to: '/orders', label: 'Purchase orders', icon: <ClipboardList size={18} />, perm: 'orders' },
    ] },
    { title: 'Insights', items: [
      { to: '/reports', label: 'Reports', icon: <BarChart3 size={18} />, perm: 'reports' },
      { to: '/settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
    ] },
  ];
  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-4">
      <div className="px-2"><Logo /></div>
      {groups.map((g, i) => (
        <div key={i}>
          {g.title && <div className="label mb-1.5 px-3 text-[11px] text-ink-3">{g.title}</div>}
          <ul className="space-y-0.5">
            {g.items.filter((it) => !it.perm || can(user.role, it.perm)).map((it) => (
              <li key={it.to}>
                <NavLink to={it.to} end={it.end} onClick={onNavigate}
                  className={({ isActive }) => cx('flex h-10 items-center gap-3 rounded-md px-3 text-[15px] font-medium transition-colors',
                    isActive ? 'bg-brand-tint text-brand' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
                  {it.icon}
                  <span className="flex-1">{it.label}</span>
                  {!!it.count && <span className="num rounded-pill bg-surface px-1.5 text-xs text-ink-2 ring-1 ring-line">{it.count}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="mt-auto rounded-md border border-line bg-surface-2 p-3 text-sm">
        <div className="font-medium text-ink">{ds.settings.pharmacyName}</div>
        <div className="text-ink-3">{user.fullName} · {ROLE_LABEL[user.role]}</div>
      </div>
    </nav>
  );
}

function SearchScan() {
  const { ds, today } = useData();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !(e.target as HTMLElement).closest('input,textarea,select')) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return ds.medicines
      .filter((m) => m.name.toLowerCase().includes(s) || m.genericName.toLowerCase().includes(s) || m.barcode.includes(s))
      .slice(0, 7)
      .map((m) => summarizeMedicine(ds, m, today));
  }, [q, ds, today]);

  const go = (id: string) => { navigate(`/inventory/${id}`); setQ(''); setOpen(false); ref.current?.blur(); };

  return (
    <div className="relative w-full max-w-[520px]">
      <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        ref={ref}
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="search-results"
        aria-label="Search medicines or scan a barcode"
        placeholder="Search medicines or scan a barcode"
        className="input h-10 pl-10 pr-10"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Escape') { setQ(''); setOpen(false); }
          if (e.key === 'Enter') {
            // A scanner types the barcode then Enter: jump straight to the medicine.
            const exact = ds.medicines.find((m) => m.barcode === q.trim());
            if (exact) return go(exact.id);
            if (results[active]) go(results[active].medicine.id);
          }
        }}
      />
      <ScanBarcode size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
      {open && results.length > 0 && (
        <ul id="search-results" role="listbox" className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-overlay">
          {results.map((r, i) => (
            <li key={r.medicine.id} role="option" aria-selected={i === active}>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => go(r.medicine.id)} onMouseEnter={() => setActive(i)}
                className={cx('flex w-full items-center gap-3 px-3 py-2 text-left', i === active && 'bg-surface-2')}>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink">{r.medicine.name} <span className="font-normal text-ink-2">{r.medicine.strength}</span></div>
                  <div className="truncate text-sm text-ink-3">{r.medicine.genericName} · <span className="num">{r.medicine.barcode}</span></div>
                </div>
                {r.status !== 'in' ? <StockBadge status={r.status} /> : r.band && r.band !== 'ok' ? <BandPill band={r.band} days={r.nearestDays} /> : <span className="num text-sm text-ink-2">{r.onHand}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, signOut, mode } = useData();
  const [theme, setTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const initials = user.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"
        className="flex h-10 items-center gap-2 rounded-md pl-1 pr-2 hover:bg-surface-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand">{initials}</span>
        <span className="hidden text-left text-sm leading-tight md:block">
          <span className="block font-medium text-ink">{user.fullName}</span>
          <span className="block text-ink-3">{ROLE_LABEL[user.role]}</span>
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div role="menu" className="animate-rise absolute right-0 top-12 z-40 w-60 rounded-md border border-line bg-surface p-1.5 shadow-overlay">
            <div className="px-2.5 py-2 text-sm">
              <div className="font-medium text-ink">{user.email}</div>
              <div className="text-ink-3">{mode === 'demo' ? 'Demo data in this browser' : 'Connected to Supabase'}</div>
            </div>
            <div className="my-1 border-t border-line" />
            <div className="label px-2.5 pb-1 pt-2 text-[11px]">Theme</div>
            <div className="grid grid-cols-3 gap-1 px-1 pb-1">
              {([['light', <Sun size={16} />, 'Light'], ['dark', <Moon size={16} />, 'Dark'], ['system', <SunMoon size={16} />, 'Auto']] as const).map(([v, icon, l]) => (
                <button key={v} role="menuitemradio" aria-checked={theme === v} onClick={() => setTheme(v)}
                  className={cx('flex flex-col items-center gap-1 rounded-sm py-2 text-xs', theme === v ? 'bg-brand-tint text-brand' : 'text-ink-2 hover:bg-surface-2')}>
                  {icon}{l}
                </button>
              ))}
            </div>
            <div className="my-1 border-t border-line" />
            <button role="menuitem" onClick={signOut} className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell() {
  const { ds, today, mode } = useData();
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();
  useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [loc.pathname]);
  const open = useMemo(() => computeAlerts(ds, today).filter((a) => a.status === 'open').length, [ds, today]);

  return (
    <div className="min-h-screen bg-paper">
      <a href="#main" className="sr-only z-50 rounded-md bg-brand px-3 py-2 text-on-brand focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar border-r border-line bg-surface lg:block"><Sidebar /></aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-[rgba(8,20,22,.45)]" onClick={() => setDrawer(false)} />
          <aside className="animate-rise absolute inset-y-0 left-0 w-[280px] border-r border-line bg-surface shadow-overlay">
            <button onClick={() => setDrawer(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-sm p-1.5 text-ink-3 hover:bg-surface-2"><X size={18} /></button>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-line px-4 backdrop-blur md:px-6" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 92%, transparent)' }}>
          <button className="rounded-md p-2 text-ink-2 hover:bg-surface-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu size={20} /></button>
          <SearchScan />
          <div className="ml-auto flex items-center gap-1">
            {mode === 'demo' && <span className="mr-2 hidden rounded-pill bg-info-tint px-2.5 py-0.5 text-xs font-medium text-info xl:inline">Demo data</span>}
            <Link to="/alerts" className="relative rounded-md p-2.5 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={`Alerts, ${open} open`}>
              <Bell size={20} />
              {open > 0 && <span className="num absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-expired px-1 text-[10px] font-semibold text-white dark:text-paper">{open > 99 ? '99+' : open}</span>}
            </Link>
            <UserMenu />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-content px-4 py-6 md:px-6 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
