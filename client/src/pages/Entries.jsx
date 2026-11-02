import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { api, errMsg } from '../api';
import { Button, Card, Chips, Empty, ErrorBox, Field, Input, PageHeader, Pager, Spinner, Stat } from '../components/ui';
import TxnForm from '../components/TxnForm';
import TxnList from '../components/TxnList';
import CustomerPicker from '../components/CustomerPicker';
import { canEditTxn, daysAgoKey, inr, todayKey } from '../utils/format';

export default function Entries() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [filters, setFilters] = useState({ from: daysAgoKey(29), to: todayKey(), type: '', paymentMode: '', worker: '', customer: '', mine: '' });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ open: false });

  const params = Object.fromEntries(Object.entries({ ...filters, page }).filter(([, v]) => v !== ''));
  const { data, loading, error, reload } = useApi('/transactions', params);
  const workers = useApi(isAdmin ? '/users' : null, { role: 'worker' });

  const set = (k) => (e) => {
    setPage(1);
    const v = e?.target ? e.target.value : e;
    // Payment mode only makes sense for payments
    setFilters((f) => ({ ...f, [k]: v, ...(k === 'type' && v !== 'payment' ? { paymentMode: '' } : {}) }));
  };

  const tt = data?.totals;

  return (
    <div>
      <PageHeader
        title="Entries"
        subtitle={isAdmin ? 'All sales, returns, payments and schemes' : 'Entries for your dealers (last 30 days + approved ranges)'}
        actions={
          <Button onClick={() => setForm({ open: true })}>
            <Plus className="h-4 w-4" /> New entry
          </Button>
        }
      />

      <Card className="mb-3 space-y-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="From">
            <Input type="date" value={filters.from} onChange={set('from')} />
          </Field>
          <Field label="To">
            <Input type="date" value={filters.to} onChange={set('to')} />
          </Field>
        </div>
        <Field as="div" label="Type">
          <Chips
            value={filters.type}
            onChange={set('type')}
            scroll
            options={[
              { value: '', label: 'All' },
              { value: 'sale', label: 'Sale' },
              { value: 'return', label: 'Sale return' },
              { value: 'payment', label: 'Payment' },
              { value: 'scheme', label: 'Scheme' },
            ]}
          />
        </Field>
        {filters.type === 'payment' && (
          <Field as="div" label="Payment mode">
            <Chips
              value={filters.paymentMode}
              onChange={set('paymentMode')}
              options={[
                { value: '', label: 'Cash + Bank' },
                { value: 'cash', label: 'Cash' },
                { value: 'bank', label: 'Bank' },
              ]}
            />
          </Field>
        )}
        {isAdmin ? (
          <Field as="div" label="Salesman">
            <Chips
              value={filters.worker}
              onChange={set('worker')}
              scroll
              options={[{ value: '', label: 'All salesmen' }, ...(workers.data || []).map((w) => ({ value: w._id, label: w.name }))]}
            />
          </Field>
        ) : (
          <Field as="div" label="Entered by">
            <Chips
              value={filters.mine}
              onChange={set('mine')}
              options={[
                { value: '', label: 'Anyone' },
                { value: 'true', label: 'Only me' },
              ]}
            />
          </Field>
        )}
        <Field as="div" label="Dealer">
          <CustomerPicker value={filters.customer} onChange={set('customer')} placeholder="All dealers — type to search" />
        </Field>
      </Card>

      {tt && (
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Sales" value={inr(tt.sale)} tone="blue" />
          <Stat label="Returns" value={inr(tt.return)} tone="amber" />
          <Stat label="Payments" value={inr(tt.payment)} tone="green" />
          <Stat label="Scheme" value={inr(tt.scheme)} tone="violet" />
        </div>
      )}

      <ErrorBox>{error}</ErrorBox>
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : data?.items.length ? (
          <TxnList
            items={data.items}
            canEdit={(t) => canEditTxn(user, t)}
            onSelect={(t) => setForm({ open: true, txn: t })}
          />
        ) : (
          <Empty>No entries match these filters</Empty>
        )}
      </Card>
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}

      <TxnForm open={form.open} txn={form.txn} onClose={() => setForm({ open: false })} onSaved={reload} />
    </div>
  );
}
