import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Home, Users, ReceiptText, KeyRound, Wallet, BarChart3, UserCog, History, MoreHorizontal, LogOut, UserCircle, LogIn, CalendarCheck,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api';
import { cx } from './ui';

const WORKER_NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/cash', label: 'Today', icon: CalendarCheck },
  { to: '/customers', label: 'Dealers', icon: Users },
  { to: '/requests', label: 'Requests', icon: KeyRound },
];

const ADMIN_NAV = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/logins', label: 'Logins', icon: LogIn, badge: 'logins' },
  { to: '/customers', label: 'Dealers', icon: Users },
  { to: '/entries', label: 'Entries', icon: ReceiptText },
  { to: '/requests', label: 'Data requests', icon: KeyRound, badge: 'requests' },
  { to: '/cash', label: 'Cash closing', icon: Wallet, badge: 'closings' },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/workers', label: 'Users', icon: UserCog },
  { to: '/audit', label: 'Audit log', icon: History },
];

function useBadges(isAdmin) {
  const loc = useLocation();
  const [badges, setBadges] = useState({});
  useEffect(() => {
    if (!isAdmin) return;
    const load = () =>
      Promise.all([
        api.get('/login-requests/pending-count'),
        api.get('/access-requests/pending-count'),
        api.get('/cash-closings', { params: { status: 'submitted' } }),
      ])
        .then(([l, r, c]) => setBadges({ logins: l.data.count, requests: r.data.count, closings: c.data.length }))
        .catch(() => {});
    load();
    // Worker logins need quick approval, so keep checking
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [isAdmin, loc.pathname]);
  return badges;
}

function Badge({ n }) {
  if (!n) return null;
  return <span className="ml-auto min-w-5 rounded-full bg-rose-600 px-1.5 text-center text-[10px] font-bold leading-5 text-white">{n}</span>;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const isAdmin = user.role === 'admin';
  const nav = isAdmin ? ADMIN_NAV : WORKER_NAV;
  const badges = useBadges(isAdmin);
  const [moreOpen, setMoreOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setMoreOpen(false), [loc.pathname]);

  // Mobile bottom bar: 4 items + "More" for admin, all 5 for worker
  // Phone bottom bar: admin = 4 tabs + More; salesman = Home + More (Today, Dealers, Requests)
  const bottom = isAdmin ? nav.slice(0, 4) : nav.slice(0, 1);
  const more = isAdmin ? nav.slice(4) : nav.slice(1);
  const moreActive = more.find((n) => loc.pathname === n.to || loc.pathname.startsWith(`${n.to}/`));

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <img src="/logo.png" alt="itel" className="h-9 w-auto object-contain" />
          <div>
            <div className="text-sm font-bold">Dealer Ledger</div>
            <div className="text-xs text-slate-500">{isAdmin ? 'Admin' : 'Field team'}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm', isActive ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-slate-600 hover:bg-slate-50')
              }
            >
              <n.icon className="h-4 w-4" />
              {n.label}
              <Badge n={badges[n.badge]} />
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <NavLink to="/profile" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            <UserCircle className="h-4 w-4" />
            <span className="truncate">{user.name}</span>
          </NavLink>
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header className="pt-safe sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="itel" className="h-7 w-auto object-contain" />
              <span className="text-sm font-bold">Dealer Ledger</span>
            </div>
            <NavLink to="/profile" className="flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pr-3 pl-1 text-xs text-slate-700">
              <UserCircle className="h-5 w-5" />
              {user.name.split(' ')[0]}
            </NavLink>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${bottom.length + 1}, minmax(0, 1fr))` }}>
          {bottom.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => cx('relative flex flex-col items-center gap-0.5 py-2 text-[11px]', isActive ? 'text-indigo-700' : 'text-slate-500')}
            >
              <n.icon className="h-5 w-5" />
              {n.label}
              {badges[n.badge] ? <span className="absolute top-1 right-[calc(50%-18px)] h-2 w-2 rounded-full bg-rose-600" /> : null}
            </NavLink>
          ))}
          {more.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              // highlighted (and shows the page name) when the open page is in the More list
              className={cx('relative flex flex-col items-center gap-0.5 py-2 text-[11px]', moreActive ? 'text-indigo-700' : 'text-slate-500')}
            >
              <MoreHorizontal className="h-5 w-5" />
              {moreActive?.label || 'More'}
              {badges.closings || badges.requests ? <span className="absolute top-1 right-[calc(50%-18px)] h-2 w-2 rounded-full bg-rose-600" /> : null}
            </button>
          )}
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/40 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="w-full rounded-t-2xl bg-white px-3 pt-3 pb-safe [--pb:0.75rem]" onClick={(e) => e.stopPropagation()}>
            {more.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cx('flex items-center gap-3 rounded-lg px-3 py-3 text-sm', isActive ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-slate-700 hover:bg-slate-50')
                }
              >
                <n.icon className="h-5 w-5" /> {n.label}
                <Badge n={badges[n.badge]} />
              </NavLink>
            ))}
            <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-rose-700 hover:bg-rose-50">
              <LogOut className="h-5 w-5" /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
