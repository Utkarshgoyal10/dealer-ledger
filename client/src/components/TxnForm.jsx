import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { api, errMsg } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Button, ErrorBox, Field, Input, Modal, Segmented, Textarea } from './ui';
import CustomerPicker from './CustomerPicker';
import { istKey, todayKey, daysAgoKey, TYPE_META } from '../utils/format';

const TYPES = ['sale', 'return', 'payment', 'scheme'].map((v) => ({ value: v, label: TYPE_META[v].label }));

function initial(txn, customerId, type) {
  if (!txn) {
    return { type: type || 'sale', customer: customerId || '', amount: '', date: todayKey(), paymentMode: 'cash', note: '' };
  }
  return {
    type: txn.type,
    customer: txn.customer?._id || txn.customer,
    amount: String(txn.amount),
    date: istKey(txn.date),
    paymentMode: txn.paymentMode || 'cash',
    note: txn.note || '',
  };
}

/**
 * Add or edit a sale / return / payment / scheme entry.
 * Workers: today or yesterday only (server enforces it too).
 */
export default function TxnForm({ open, onClose, onSaved, txn, customerId, defaultType }) {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [f, setF] = useState(() => initial(txn, customerId, defaultType));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setF(initial(txn, customerId, defaultType));
      setError('');
    }
  }, [open, txn, customerId, defaultType]);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.customer) return setError('Select a dealer');
    if (!(Number(f.amount) > 0)) return setError('Enter an amount');

    const body = { type: f.type, customer: f.customer, amount: Number(f.amount), note: f.note, date: f.date };
    if (f.type === 'payment') body.paymentMode = f.paymentMode;
    setSaving(true);
    try {
      let res;
      if (txn) res = await api.patch(`/transactions/${txn._id}`, body);
      else res = await api.post('/transactions', body);
      toast.success(txn ? 'Entry updated' : `${TYPE_META[f.type].label} saved`);
      if (res.data?.closingReopened) {
        toast("Today's cash closing was already verified, so it has been re-opened. Go to the Today tab and submit cash again.", {
          icon: '⚠️',
          duration: 8000,
        });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this entry? It will be kept in the audit log.')) return;
    setSaving(true);
    try {
      await api.delete(`/transactions/${txn._id}`);
      toast.success('Entry deleted');
      onSaved?.();
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
      title={txn ? 'Edit entry' : 'New entry'}
      footer={
        <>
          {txn && (
            <Button type="button" variant="ghost" className="mr-auto text-rose-600" onClick={remove} disabled={saving}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="txn-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="txn-form" onSubmit={submit} className="space-y-4">
        <Segmented value={f.type} onChange={(v) => set('type', v)} options={TYPES} />

        <Field as="div" label="Dealer">
          <CustomerPicker value={f.customer} onChange={(v) => set('customer', v)} disabled={!!customerId && !txn} required />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)">
            <Input type="number" inputMode="decimal" min="0" step="0.01" value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0" autoFocus={!txn} required />
          </Field>
          <Field as="div" label="Date">
            {isAdmin ? (
              <Input type="date" value={f.date} max={todayKey()} onChange={(e) => set('date', e.target.value)} required />
            ) : (
              <Segmented
                value={f.date}
                onChange={(v) => set('date', v)}
                options={[
                  { value: todayKey(), label: 'Today' },
                  { value: daysAgoKey(1), label: 'Yesterday' },
                ]}
              />
            )}
          </Field>
        </div>

        {f.type === 'payment' && (
          <Field as="div" label="Payment received in">
            <Segmented
              value={f.paymentMode}
              onChange={(v) => set('paymentMode', v)}
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'bank', label: 'Bank' },
              ]}
            />
          </Field>
        )}

        <Field label="Note (optional)">
          <Textarea value={f.note} onChange={(e) => set('note', e.target.value)} placeholder={f.type === 'return' ? 'Reason for return' : f.type === 'scheme' ? 'Scheme name / details' : ''} />
        </Field>

        <ErrorBox>{error}</ErrorBox>
      </form>
    </Modal>
  );
}
