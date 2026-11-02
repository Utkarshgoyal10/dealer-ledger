import { CashClosing } from '../models/CashClosing.js';
import { istDateKey } from '../utils/dates.js';
import { audit } from './audit.js';
import { notifyAdmins } from './push.js';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** Puts a verified closing back to "To verify", asks the worker to submit again and notifies admin */
async function reopen(req, closing, { summary, push }) {
  const before = closing.toObject();
  closing.status = 'submitted';
  closing.needsResubmit = true;
  closing.reopenedAt = new Date();
  closing.reopenCount += 1;
  closing.adminNote = '';
  await closing.save();
  await audit(req, { action: 'reopen', entity: 'CashClosing', entityId: closing._id, summary, before, after: closing });
  notifyAdmins({ title: 'Closing re-opened', body: push, url: '/cash', tag: `closing-${closing._id}` });
  return closing;
}

/**
 * A worker added a payment AFTER the admin verified today's cash closing.
 * The closing goes back to "submitted" (To verify), the worker must submit cash again,
 * and the admin gets a phone notification — so no collected money is missed.
 */
export async function reopenClosingIfVerified(req, txn) {
  if (req.user.role !== 'worker' || txn.type !== 'payment') return null;
  const closing = await CashClosing.findOne({ worker: req.user._id, dateKey: istDateKey(txn.createdAt), status: 'verified' });
  if (!closing) return null;
  const what = `${inr(txn.amount)} ${txn.paymentMode === 'cash' ? 'cash' : 'bank'} payment`;
  return reopen(req, closing, {
    summary: `Closing ${closing.dateKey} re-opened: ${req.user.name} added ${what} after verification`,
    push: `${req.user.name} added ${what} after you verified today's cash. Re-check needed.`,
  });
}

/**
 * Safety net: if a verified closing no longer matches what is in the app (cash or bank total
 * changed for any reason), re-open it. `live` = current totals from the app for that day.
 */
export async function reopenIfMismatch(req, closing, live, workerName = 'Salesman') {
  if (!closing || closing.status !== 'verified') return false;
  if (live.systemCash === closing.systemCash && live.bankTotal === closing.bankTotal) return false;
  const doc = typeof closing.save === 'function' ? closing : await CashClosing.findById(closing._id);
  await reopen(req, doc, {
    summary: `Closing ${doc.dateKey} re-opened: app now shows cash ${inr(live.systemCash)} / bank ${inr(live.bankTotal)}, verified was cash ${inr(doc.systemCash)} / bank ${inr(doc.bankTotal)}`,
    push: `${workerName}'s ${doc.dateKey} closing changed after you verified it (cash now ${inr(live.systemCash)}). Re-check needed.`,
  });
  return true;
}
