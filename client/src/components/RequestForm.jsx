import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, errMsg } from '../api';
import { Button, ErrorBox, Field, Input, Modal, Textarea } from './ui';
import CustomerPicker from './CustomerPicker';
import { daysAgoKey, fmtDate } from '../utils/format';

/** Worker asks admin to unlock older data for ONE customer and a date range */
export default function RequestForm({ open, onClose, onSaved, customerId }) {
  const lastHidden = daysAgoKey(30); // the day before the visible window starts
  const [f, setF] = useState({ customer: '', fromDate: '', toDate: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setF({ customer: customerId || '', fromDate: '', toDate: lastHidden, reason: '' });
      setError('');
    }
  }, [open, customerId, lastHidden]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.customer) return setError('Select a dealer');
    setSaving(true);
    try {
      await api.post('/access-requests', f);
      toast.success('Request sent to admin');
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
      title="Request older data"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="request-form" loading={saving}>
            Send request
          </Button>
        </>
      }
    >
      <form id="request-form" onSubmit={submit} className="space-y-3">
        <p className="text-xs text-slate-500">You can already see entries from {fmtDate(daysAgoKey(29))}. Choose an older range for one dealer.</p>
        <Field as="div" label="Dealer">
          <CustomerPicker value={f.customer} onChange={(v) => setF({ ...f, customer: v })} disabled={!!customerId} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From date">
            <Input type="date" value={f.fromDate} max={lastHidden} onChange={(e) => setF({ ...f, fromDate: e.target.value })} required />
          </Field>
          <Field label="To date">
            <Input type="date" value={f.toDate} min={f.fromDate || undefined} onChange={(e) => setF({ ...f, toDate: e.target.value })} required />
          </Field>
        </div>
        <Field label="Reason">
          <Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Dealer disputes August payments" required minLength={3} />
        </Field>
        <ErrorBox>{error}</ErrorBox>
      </form>
    </Modal>
  );
}
