import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, ChevronRight, PenLine } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { Balance, Button, Card, Chips, Empty, ErrorBox, PageHeader, Spinner } from '../components/ui';
import { inr } from '../utils/format';
import CustomerForm from '../components/CustomerForm';
import CustomerPicker from '../components/CustomerPicker';
import RouteSelect from '../components/RouteSelect';

export default function Customers() {
  const nav = useNavigate();
  const { user } = useAuth();
  const isAdmin = user.role === 'admin'; // only admin sees balances in the list
  // Route + sort live in the page address, so Back from a dealer returns to the same route
  const [params, setParams] = useSearchParams();
  const route = params.get('route') || '';
  const sort = params.get('sort') || 'name';
  const setParam = (key, value, empty) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (!value || value === empty) n.delete(key);
        else n.set(key, value);
        return n;
      },
      { replace: true }
    );
  const setRoute = (v) => setParam('route', v, '');
  const setSort = (v) => setParam('sort', v, 'name');
  const dueOnly = params.get('due') === '1';
  const setDueOnly = (v) => setParam('due', v ? '1' : '', '');
  const [adding, setAdding] = useState(false);

  const { data, loading, error, reload } = useApi('/customers');
  const list = useMemo(() => {
    const l = (data || []).filter((c) => (!route || c.route === route) && (!dueOnly || c.confirmStatus === 'due' || c.confirmStatus === 'disputed'));
    return isAdmin && sort === 'due' ? [...l].sort((a, b) => b.balance - a.balance) : l;
  }, [data, route, sort, isAdmin, dueOnly]);
  const dueCount = (data || []).filter((c) => (!route || c.route === route) && (c.confirmStatus === 'due' || c.confirmStatus === 'disputed')).length;
  const totalDue = list.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);

  return (
    <div>
      <PageHeader
        title="Dealers"
        subtitle={
          data
            ? `${list.length} dealer${list.length === 1 ? '' : 's'}${route ? ` on ${route}` : ''}${isAdmin ? ` • ${inr(totalDue)} outstanding` : ''}`
            : undefined
        }
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add dealer
          </Button>
        }
      />

      {/* Type a name → suggestions → tap to open that dealer */}
      <div className="mb-2">
        <CustomerPicker value="" onChange={(id) => id && nav(`/customers/${id}`)} placeholder="Search dealer…" />
      </div>

      <div className="mb-4 mt-1">
        <RouteSelect value={route} onChange={setRoute} allowAll allowAdd={false} scroll />
      </div>

      {isAdmin && (
        <div className="mb-3">
          <Chips
            size="sm"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'name', label: 'Sort: A–Z' },
              { value: 'due', label: 'Sort: highest outstanding' },
            ]}
          />
        </div>
      )}

      {(dueCount > 0 || dueOnly) && (
        <button
          type="button"
          onClick={() => setDueOnly(!dueOnly)}
          className={`mb-3 flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-bold ring-1 ${
            dueOnly ? 'bg-amber-500 text-white ring-amber-500' : 'bg-amber-50 text-amber-900 ring-amber-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <PenLine className="h-4 w-4" />
            {dueOnly ? `Showing ${dueCount} dealer${dueCount === 1 ? '' : 's'} to confirm` : `${dueCount} dealer${dueCount === 1 ? '' : 's'} still to confirm this month`}
          </span>
          <span className="text-xs font-semibold underline">{dueOnly ? 'Show all' : 'Show'}</span>
        </button>
      )}

      <ErrorBox>{error}</ErrorBox>
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : list.length === 0 ? (
          <Empty>{route ? `No dealers on ${route}.` : 'No dealers yet. Tap "Add dealer".'}</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((c) => (
              <li key={c._id}>
                <Link to={`/customers/${c._id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.shopName}</div>
                    <div className="truncate text-xs text-slate-500">
                      {c.route || 'No route'}
                      {isAdmin && c.hideBalance && <span className="ml-1.5 text-amber-700">• balance hidden from salesmen</span>}
                    </div>
                    {c.confirmStatus === 'due' && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                        <PenLine className="h-3 w-3" /> Confirm balance this month
                      </div>
                    )}
                    {c.confirmStatus === 'disputed' && (
                      <div className="mt-0.5 text-[11px] font-bold text-rose-700">⚠ Dealer disputed balance — check</div>
                    )}
                  </div>
                  {isAdmin && <Balance value={c.balance} className="text-sm" />}
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CustomerForm open={adding} onClose={() => setAdding(false)} onSaved={reload} />
    </div>
  );
}
