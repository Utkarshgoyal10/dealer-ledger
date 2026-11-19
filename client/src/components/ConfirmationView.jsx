import { useState } from 'react';
import toast from 'react-hot-toast';
import { useApi } from '../hooks/useApi';
import { api, errMsg } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Balance, Button, Chip, Field, Modal, Spinner, Textarea } from './ui';
import { fmtDate, fmtDateTime, inr } from '../utils/format';

export const CONFIRM_STATUS = {
  done: { label: 'Confirmed this month', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  due: { label: 'Confirmation due', chip: 'bg-amber-50 text-amber-800 ring-amber-200' },
  disputed: { label: 'Disputed', chip: 'bg-rose-50 text-rose-700 ring-rose-200' },
  skipped: { label: 'Skipped this month', chip: 'bg-slate-100 text-slate-600 ring-slate-200' },
  zero: { label: '₹0 — not needed', chip: 'bg-slate-100 text-slate-600 ring-slate-200' },
  admin: { label: 'Handled by admin', chip: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

const TYPE = { sale: 'Sale', return: 'Sale return', payment: 'Payment', scheme: 'Scheme' };

/** Read-only view of one saved confirmation (signature + statement snapshot) */
export default function ConfirmationView({ id, onClose, onChanged }) {
  const { user } = useAuth();
  const { data: c, error, reload } = useApi(id ? `/confirmations/${id}` : null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    setBusy(true);
    try {
      await api.post(`/confirmations/${id}/approve`);
      toast.success('Approved ✓');
      reload();
      onChanged?.();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const [rejecting, setRejecting] = useState(false);
  const reject = async () => {
    setBusy(true);
    try {
      await api.post(`/confirmations/${id}/reject`, { reason: note });
      toast.success('Rejected — entries unlocked, take a fresh signature');
      setRejecting(false);
      setNote('');
      reload();
      onChanged?.();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const resolve = async () => {
    setBusy(true);
    try {
      await api.post(`/confirmations/${id}/resolve`, { adminNote: note });
      toast.success('Marked as resolved');
      reload();
      onChanged?.();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!id} onClose={onClose} title="Balance confirmation" wide>
      {error ? (
        <div className="text-sm text-rose-700">{error}</div>
      ) : !c ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-bold">{c.customer?.shopName}</div>
              <div className="text-xs text-slate-500">
                {fmtDateTime(c.createdAt)} • by {c.createdBy?.name}
              </div>
            </div>
            <Chip className={c.status === 'confirmed' && !c.rejectedAt ? CONFIRM_STATUS.done.chip : CONFIRM_STATUS.disputed.chip}>
              {c.status === 'confirmed' ? (c.rejectedAt ? 'Rejected by admin' : c.approvedAt ? 'Signed • approved ✓' : 'Signed • waiting for admin') : c.resolvedAt ? 'Disputed • resolved' : 'Disputed'}
            </Chip>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span>Balance {c.status === 'confirmed' ? 'agreed' : 'shown'}</span>
            <Balance value={c.closingBalance} className="text-lg" />
          </div>

          {c.status === 'confirmed' ? (
            <div>
              <div className="mb-1 text-xs text-slate-500">Dealer signature{c.signerName ? ` — ${c.signerName}` : ''}</div>
              <img src={c.signature} alt="Dealer signature" className="h-36 w-full rounded-lg bg-white object-contain ring-1 ring-slate-200" />
            </div>
          ) : (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-200">
              <div className="text-xs font-bold">Dealer says{c.signerName ? ` (${c.signerName})` : ''}:</div>
              {c.note}
            </div>
          )}

          <details className="rounded-lg ring-1 ring-slate-200">
            <summary className="cursor-pointer px-3 py-2 text-sm font-bold">
              Statement shown ({c.entries.length} entr{c.entries.length === 1 ? 'y' : 'ies'} since {fmtDate(c.periodFrom)})
            </summary>
            <div className="border-t border-slate-100 text-sm">
              <div className="flex justify-between px-3 py-1.5 text-slate-500">
                <span>Balance on {fmtDate(c.periodFrom)}</span>
                <span className="tabular">{inr(c.openingBalance)}</span>
              </div>
              {c.entries.map((t, i) => (
                <div key={i} className="flex justify-between border-t border-slate-50 px-3 py-1.5">
                  <span>
                    {fmtDate(t.date)} · {TYPE[t.type]}
                    {t.paymentMode ? ` · ${t.paymentMode === 'cash' ? 'Cash' : 'Bank'}` : ''}
                  </span>
                  <span className="tabular font-semibold">
                    {t.type === 'sale' ? '+' : '−'}
                    {inr(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </details>

          {c.status === 'confirmed' && c.rejectedAt && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-200">
              <div className="text-xs font-bold">
                Rejected by {c.rejectedBy?.name} on {fmtDateTime(c.rejectedAt)}
              </div>
              {c.rejectReason}
            </div>
          )}
          {c.status === 'confirmed' && !c.rejectedAt && c.approvedAt && (
            <div className="space-y-1">
              <div className="text-xs text-emerald-700">
                Approved by {c.approvedBy?.name} on {fmtDateTime(c.approvedAt)}
              </div>
              {user.role === 'admin' && !rejecting && (
                <button type="button" onClick={() => setRejecting(true)} className="text-xs font-bold text-rose-700 underline">
                  Found a mistake later? Reject this confirmation
                </button>
              )}
            </div>
          )}
          {c.status === 'confirmed' && !c.rejectedAt && user.role === 'admin' && rejecting && (
            <div className="space-y-2 rounded-lg bg-rose-50 p-3 ring-1 ring-rose-200">
              <Field label="Why are you rejecting? (required)">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. ₹2,000 sale on 15 Nov missing in app" autoFocus />
              </Field>
              <div className="flex gap-2">
                <Button variant="danger" loading={busy} disabled={note.trim().length < 3} onClick={reject}>
                  Reject confirmation
                </Button>
                <Button variant="ghost" onClick={() => setRejecting(false)}>
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-slate-600">This unlocks the signed entries so they can be corrected. Then take a fresh signature from the dealer.</p>
            </div>
          )}
          {c.status === 'confirmed' &&
            !c.rejectedAt &&
            !rejecting &&
            (c.approvedAt ? null : (
              user.role === 'admin' && (
                <div className="space-y-2 rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-200">
                  <p className="text-sm text-emerald-900">
                    Check <b>{inr(c.closingBalance)}</b> against your books, then approve.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="success" loading={busy} onClick={approve}>
                      Approve — correct
                    </Button>
                    <Button variant="secondary" className="text-rose-700" onClick={() => setRejecting(true)}>
                      Reject — not matching
                    </Button>
                  </div>
                </div>
              )
            ))}

          {c.status === 'disputed' &&
            (c.resolvedAt ? (
              <div className="text-xs text-slate-600">
                Resolved {fmtDateTime(c.resolvedAt)} by {c.resolvedBy?.name}
                {c.adminNote ? ` — ${c.adminNote}` : ''}
              </div>
            ) : (
              user.role === 'admin' && (
                <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                  <Field label="How was it sorted out? (optional)">
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Missing payment added on 10 Nov" />
                  </Field>
                  <Button variant="success" loading={busy} onClick={resolve}>
                    Mark resolved
                  </Button>
                  <p className="text-xs text-slate-500">After fixing the entries, ask the salesman to take a fresh signature.</p>
                </div>
              )
            ))}
        </div>
      )}
    </Modal>
  );
}
