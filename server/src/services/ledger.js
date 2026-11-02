import mongoose from 'mongoose';
import { Customer } from '../models/Customer.js';
import { Transaction, signedAmount, signedAmountExpr } from '../models/Transaction.js';

/** Current outstanding balance for many customers at once: Map(customerId -> balance) */
export async function computeBalances(customers, { upTo } = {}) {
  const ids = customers.map((c) => new mongoose.Types.ObjectId(String(c._id)));
  const match = { customer: { $in: ids }, deleted: false };
  if (upTo) match.date = { $lte: upTo };
  const sums = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: '$customer', total: { $sum: signedAmountExpr } } },
  ]);
  const byId = new Map(sums.map((s) => [String(s._id), s.total]));
  const result = new Map();
  for (const c of customers) {
    result.set(String(c._id), round2((c.openingBalance || 0) + (byId.get(String(c._id)) || 0)));
  }
  return result;
}

export async function computeBalance(customer) {
  const map = await computeBalances([customer]);
  return map.get(String(customer._id));
}

/**
 * Full ledger with running balance.
 * `isVisible(t)` lets the caller hide rows (worker rules); the running balance still
 * includes hidden rows so every number shown is the true balance on that date.
 */
export async function buildLedger(customerId, { from, to, isVisible = () => true } = {}) {
  const customer = await Customer.findById(customerId).lean();
  if (!customer) return null;

  const txns = await Transaction.find({ customer: customerId, deleted: false })
    .sort({ date: 1, createdAt: 1 })
    .populate('createdBy', 'name role')
    .populate('worker', 'name')
    .lean();

  let balance = customer.openingBalance || 0;
  const rows = [];
  let broughtForward = null;

  for (const t of txns) {
    const before = balance;
    balance = round2(balance + signedAmount(t));
    const inRange = (!from || t.date >= from) && (!to || t.date <= to);
    if (!inRange || !isVisible(t)) continue;
    if (broughtForward === null) broughtForward = before;
    const effect = signedAmount(t);
    rows.push({
      ...t,
      debit: effect > 0 ? effect : 0,
      credit: effect < 0 ? -effect : 0,
      balance,
    });
  }

  // Balance at the start of the requested range when nothing in it is visible
  if (broughtForward === null) {
    broughtForward = from
      ? round2(
          (customer.openingBalance || 0) +
            txns.filter((t) => t.date < from).reduce((s, t) => s + signedAmount(t), 0)
        )
      : customer.openingBalance || 0;
  }

  return {
    customer,
    openingBalance: customer.openingBalance || 0,
    broughtForward: round2(broughtForward),
    rows,
    currentBalance: balance,
  };
}

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
