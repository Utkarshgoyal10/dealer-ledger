import { Link } from 'react-router-dom';
import { KeyRound, LogIn, Wallet } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { Balance, Card, ErrorBox, PageHeader, Spinner, Stat } from '../components/ui';
import { fmtDate, inr } from '../utils/format';
import NotificationSetup from '../components/NotificationSetup';
import InstallApp from '../components/InstallApp';

export default function Dashboard() {
  const { data: d, error } = useApi('/reports/dashboard');
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!d) return <Spinner />;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={fmtDate(new Date())} />
      <InstallApp />
      <NotificationSetup compact />

      {(d.pendingLogins > 0 || d.pendingRequests > 0 || d.pendingClosings > 0) && (
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {d.pendingLogins > 0 && (
            <Link to="/logins">
              <Card className="flex items-center gap-3 bg-indigo-50 p-3 ring-indigo-200">
                <LogIn className="h-5 w-5 text-indigo-700" />
                <span className="text-sm font-semibold text-indigo-900">{d.pendingLogins} worker login(s) waiting</span>
              </Card>
            </Link>
          )}
          {d.pendingRequests > 0 && (
            <Link to="/requests">
              <Card className="flex items-center gap-3 bg-amber-50 p-3 ring-amber-200">
                <KeyRound className="h-5 w-5 text-amber-700" />
                <span className="text-sm font-semibold text-amber-900">{d.pendingRequests} data access request(s) waiting</span>
              </Card>
            </Link>
          )}
          {d.pendingClosings > 0 && (
            <Link to="/cash">
              <Card className="flex items-center gap-3 bg-amber-50 p-3 ring-amber-200">
                <Wallet className="h-5 w-5 text-amber-700" />
                <span className="text-sm font-semibold text-amber-900">{d.pendingClosings} cash closing(s) to verify</span>
              </Card>
            </Link>
          )}
        </div>
      )}

      <h2 className="mb-2 text-sm font-bold text-slate-700">Today</h2>
      <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label="Sales" value={inr(d.today.sale)} tone="blue" />
        <Stat label="Returns" value={inr(d.today.return)} tone="amber" />
        <Stat label="Cash collected" value={inr(d.today.cash)} tone="green" />
        <Stat label="Bank collected" value={inr(d.today.bank)} tone="green" />
        <Stat label="Scheme" value={inr(d.today.scheme)} tone="violet" />
      </div>

      <h2 className="mb-2 text-sm font-bold text-slate-700">This month</h2>
      <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Net sales" value={inr(d.month.netSale)} tone="blue" sub={`Sales ${inr(d.month.sale)} − Returns ${inr(d.month.return)}`} />
        <Stat label="Collected" value={inr(d.month.collection)} tone="green" sub={`Cash ${inr(d.month.cash)} • Bank ${inr(d.month.bank)}`} />
        <Stat label="Scheme given" value={inr(d.month.scheme)} tone="violet" />
        <Stat label="Total outstanding" value={inr(d.totalOutstanding)} tone="rose" sub={`${d.customerCount} dealers`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-bold">Last 7 days</h3>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Date</th>
                <th className="px-4 py-2 text-right font-semibold">Sales</th>
                <th className="px-4 py-2 text-right font-semibold">Collected</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {d.trend.map((r) => (
                <tr key={r.date} className="border-t border-slate-50">
                  <td className="px-4 py-1.5 text-slate-600">{fmtDate(r.date)}</td>
                  <td className="px-4 py-1.5 text-right">{inr(r.sale)}</td>
                  <td className="px-4 py-1.5 text-right text-emerald-700">{inr(r.collection)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-bold">Top dealers this month</h3>
          <ul className="divide-y divide-slate-50 text-sm">
            {d.topCustomers.length === 0 && <li className="px-4 py-6 text-center text-slate-500">No sales yet</li>}
            {d.topCustomers.map((c) => (
              <li key={c._id}>
                <Link to={`/customers/${c._id}`} className="flex justify-between gap-2 px-4 py-2 hover:bg-slate-50">
                  <span className="truncate">{c.shopName}</span>
                  <span className="tabular font-semibold">{inr(c.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-bold">Highest outstanding</h3>
          <ul className="divide-y divide-slate-50 text-sm">
            {d.topDue.length === 0 && <li className="px-4 py-6 text-center text-slate-500">No dues</li>}
            {d.topDue.map((c) => (
              <li key={c._id}>
                <Link to={`/customers/${c._id}`} className="flex justify-between gap-2 px-4 py-2 hover:bg-slate-50">
                  <span className="truncate">
                    {c.shopName}
                    {c.route && <span className="text-xs text-slate-500"> • {c.route}</span>}
                  </span>
                  <Balance value={c.balance} />
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/reports?tab=outstanding" className="block border-t border-slate-100 px-4 py-2 text-center text-xs font-semibold text-indigo-700">
            Full outstanding report →
          </Link>
        </Card>
      </div>
    </div>
  );
}
