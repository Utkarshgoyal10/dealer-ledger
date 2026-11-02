import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ChevronRight } from 'lucide-react';
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
  const [route, setRoute] = useState('');
  const [sort, setSort] = useState('name');
  const [adding, setAdding] = useState(false);

  const { data, loading, error, reload } = useApi('/customers');
  const list = useMemo(() => {
    const l = (data || []).filter((c) => !route || c.route === route);
    return isAdmin && sort === 'due' ? [...l].sort((a, b) => b.balance - a.balance) : l;
  }, [data, route, sort, isAdmin]);
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
                    <div className="truncate text-xs text-slate-500">{c.route || 'No route'}</div>
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
