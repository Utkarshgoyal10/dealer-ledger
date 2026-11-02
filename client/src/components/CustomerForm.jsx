import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, errMsg } from '../api';
import { Button, ErrorBox, Field, Input, Modal } from './ui';
import RouteSelect from './RouteSelect';

const empty = { shopName: '', route: '', openingBalance: '' };

/** Add (worker or admin) or edit (admin only) a customer */
export default function CustomerForm({ open, onClose, onSaved, customer }) {
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setF(customer ? { shopName: customer.shopName, route: customer.route || '', openingBalance: String(customer.openingBalance ?? 0) } : empty);
  }, [open, customer]);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.route) return setError('Select a route');
    setSaving(true);
    setError('');
    try {
      const body = { ...f, openingBalance: Number(f.openingBalance || 0) };
      const { data } = customer ? await api.patch(`/customers/${customer._id}`, body) : await api.post('/customers', body);
      toast.success(customer ? 'Dealer updated' : 'Dealer added');
      onSaved?.(data);
      onClose();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? 'Edit dealer' : 'Add dealer'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={submit} className="space-y-3">
        <Field label="Shop name">
          <Input value={f.shopName} onChange={(e) => setF({ ...f, shopName: e.target.value })} required autoFocus />
        </Field>
        <Field as="div" label="Route">
          <RouteSelect value={f.route} onChange={(route) => setF((s) => ({ ...s, route }))} required />
        </Field>
        <Field label="Opening balance (₹)" hint="Amount the dealer already owes. Use minus (−) for an advance.">
          <Input type="number" inputMode="decimal" step="0.01" value={f.openingBalance} onChange={(e) => setF({ ...f, openingBalance: e.target.value })} placeholder="0" />
        </Field>
        {!customer && <p className="text-xs text-slate-500">Only admin can edit or delete a dealer after it is added.</p>}
        <ErrorBox>{error}</ErrorBox>
      </form>
    </Modal>
  );
}
