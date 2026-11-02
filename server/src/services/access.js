// Data-visibility rules for workers. Enforced on the server for every query,
// so hiding things in the UI is never the only protection.
// All workers share all customers; the limit is on HOW FAR BACK they can see.
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { AccessRequest } from '../models/AccessRequest.js';
import { addDays, istDayStart } from '../utils/dates.js';

/** First day a worker can see by default (rolling window including today) */
export function workerWindowStart(now = new Date()) {
  return addDays(istDayStart(now), -(env.WORKER_VISIBLE_DAYS - 1));
}

/** Window start + approved, unexpired grants (each for one customer and one date range) */
export async function getWorkerAccess(workerId) {
  const grants = await AccessRequest.find({
    worker: workerId,
    status: 'approved',
    accessExpiresAt: { $gt: new Date() },
  }).lean();
  return { windowStart: workerWindowStart(), grants };
}

/** MongoDB filter for transactions a worker may see (optionally for one customer) */
export function workerTxnFilter(access, customerId) {
  const base = customerId ? { customer: new mongoose.Types.ObjectId(String(customerId)) } : {};
  const or = [{ ...base, date: { $gte: access.windowStart } }];
  for (const g of access.grants) {
    if (customerId && String(g.customer) !== String(customerId)) continue;
    or.push({ customer: g.customer, date: { $gte: g.fromDate, $lte: g.toDate } });
  }
  return { deleted: false, $or: or };
}

/** Same rule as workerTxnFilter, for a single transaction already loaded */
export function isTxnVisibleToWorker(access, t) {
  const cid = String(t.customer?._id ?? t.customer);
  const date = new Date(t.date);
  if (date >= access.windowStart) return true;
  return access.grants.some((g) => String(g.customer) === cid && date >= g.fromDate && date <= g.toDate);
}
