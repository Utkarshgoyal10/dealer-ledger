import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api, errMsg } from '../api';
import { Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Spinner } from '../components/ui';
import { inr } from '../utils/format';

/** Admin: itel models and dealer prices (incl. GST) used for stock checks */
export default function Products() {
  const { data, loading, error, reload } = useApi('/products', { all: 'true' });
  const [form, setForm] = useState(null); // {name, price, _id?}
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { name: form.name, price: Number(form.price) };
      if (form._id) await api.patch(`/products/${form._id}`, body);
      else await api.post('/products', body);
      toast.success(form._id ? 'Model updated' : 'Model added');
      setForm(null);
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p) => {
    try {
      await api.patch(`/products/${p._id}`, { active: !p.active });
      toast.success(p.active ? `${p.name} removed from stock checks` : `${p.name} added back`);
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const active = (data || []).filter((p) => p.active);
  const removed = (data || []).filter((p) => !p.active);

  return (
    <div>
      <PageHeader
        title="Models & prices"
        subtitle="Dealer price incl. GST — used to value stock at the shop"
        actions={
          <Button onClick={() => setForm({ name: '', price: '' })}>
            <Plus className="h-4 w-4" /> Add model
          </Button>
        }
      />
      <ErrorBox>{error}</ErrorBox>
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : active.length === 0 ? (
          <Empty>No models yet. Tap "Add model" (e.g. itel A70 — ₹6,499).</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {active.map((p) => (
              <li key={p._id} className="flex items-center gap-3 px-4 py-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setForm({ _id: p._id, name: p.name, price: String(p.price) })}>
                  <div className="truncate text-sm font-bold">{p.name}</div>
                  <div className="text-xs text-indigo-700">Tap to change price</div>
                </button>
                <div className="text-sm font-bold tabular">{inr(p.price)}</div>
                <button type="button" onClick={() => toggle(p)} className="text-xs font-bold text-slate-500 underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {removed.length > 0 && (
        <>
          <h2 className="mt-5 mb-2 text-sm font-bold text-slate-600">Removed (not shown to salesmen)</h2>
          <Card>
            <ul className="divide-y divide-slate-100">
              {removed.map((p) => (
                <li key={p._id} className="flex items-center gap-3 px-4 py-2.5 text-slate-500">
                  <div className="min-w-0 flex-1 truncate text-sm">{p.name}</div>
                  <div className="text-sm tabular">{inr(p.price)}</div>
                  <button type="button" onClick={() => toggle(p)} className="text-xs font-bold text-indigo-700 underline">
                    Add back
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?._id ? 'Edit model' : 'Add model'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button type="submit" form="product-form" loading={saving}>
              Save
            </Button>
          </>
        }
      >
        {form && (
          <form id="product-form" onSubmit={save} className="space-y-3">
            <Field label="Model name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. itel A70 3/64" autoFocus required />
            </Field>
            <Field label="Dealer price incl. GST (₹)" hint="Old stock checks keep the price used at that time.">
              <Input type="number" inputMode="decimal" min="0" step="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </Field>
          </form>
        )}
      </Modal>
    </div>
  );
}
