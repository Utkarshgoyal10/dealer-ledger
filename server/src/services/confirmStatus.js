import { Confirmation } from '../models/Confirmation.js';
import { istDateKey, parseDateKey } from '../utils/dates.js';

export const monthKey = (d = new Date()) => istDateKey(d).slice(0, 7);

/**
 * This month's confirmation status per dealer: Map(id -> status)
 *  done      – signed this month
 *  disputed  – latest this month is disputed and not resolved (needs a fresh signature)
 *  skipped   – admin skipped this month
 *  zero      – balance is ₹0, nothing to confirm
 *  admin     – balance hidden from salesmen (admin handles it) — only for salesman view
 *  due       – still to do
 */
export async function confirmStatusMap(customers, balances, { forWorker = false } = {}) {
  const mk = monthKey();
  const from = parseDateKey(`${mk}-01`);
  const rows = await Confirmation.aggregate([
    { $match: { customer: { $in: customers.map((c) => c._id) }, createdAt: { $gte: from } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$customer', confirmed: { $max: { $cond: [{ $and: [{ $eq: ['$status', 'confirmed'] }, { $eq: [{ $ifNull: ['$rejectedAt', null] }, null] }] }, 1, 0] } }, latest: { $first: '$$ROOT' } } },
  ]);
  const byId = new Map(rows.map((r) => [String(r._id), r]));
  const out = new Map();
  for (const c of customers) {
    const id = String(c._id);
    const r = byId.get(id);
    let st;
    if (r?.confirmed) st = 'done';
    else if (r && r.latest.status === 'disputed' && !r.latest.resolvedAt) st = 'disputed';
    else if ((c.confirmSkips || []).includes(mk)) st = 'skipped';
    else if (Math.abs(balances.get(id) || 0) < 0.01) st = 'zero';
    else if (forWorker && c.hideBalance) st = 'admin';
    else st = 'due';
    out.set(id, st);
  }
  return out;
}
