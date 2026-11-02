import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Transaction, TXN_TYPES, PAYMENT_MODES } from '../models/Transaction.js';
import { Customer } from '../models/Customer.js';
import { CashClosing } from '../models/CashClosing.js';
import { badRequest, forbidden, notFound } from '../utils/http.js';
import { audit } from '../services/audit.js';
import { getWorkerAccess, isTxnVisibleToWorker, workerTxnFilter } from '../services/access.js';
import { reopenClosingIfVerified } from '../services/cashClosing.js';
import { addDays, istDayStart, istDayEnd, istDateKey, isSameIstDay, parseDateKey } from '../utils/dates.js';

const router = Router();
const oid = (id) => new mongoose.Types.ObjectId(String(id));

/** Workers may only use today's or yesterday's date */
function workerDate(dateKey) {
  const today = istDayStart();
  if (!dateKey) return today;
  const d = parseDateKey(dateKey);
  const yesterday = addDays(today, -1);
  if (d.getTime() !== today.getTime() && d.getTime() !== yesterday.getTime()) {
    throw forbidden('You can only enter today\'s or yesterday\'s date');
  }
  return d;
}

const LABEL = { sale: 'Sale', return: 'Sale return', payment: 'Payment', scheme: 'Scheme' };

// ---------- list ----------
router.get('/', async (req, res) => {
  const q = req.query;
  const and = [{ deleted: false }];

  if (req.user.role === 'worker') {
    const access = await getWorkerAccess(req.user._id);
    and.push(workerTxnFilter(access, q.customer));
    if (q.mine === 'true') and.push({ createdBy: req.user._id });
  } else {
    if (q.customer) and.push({ customer: oid(q.customer) });
    if (q.worker) and.push({ worker: oid(q.worker) });
  }

  if (q.type && TXN_TYPES.includes(q.type)) and.push({ type: q.type });
  if (q.paymentMode && PAYMENT_MODES.includes(q.paymentMode)) and.push({ paymentMode: q.paymentMode });
  if (q.from) and.push({ date: { $gte: parseDateKey(q.from) } });
  if (q.to) and.push({ date: { $lte: istDayEnd(parseDateKey(q.to)) } });

  const limit = Math.min(Number(q.limit) || 50, 200);
  const page = Math.max(Number(q.page) || 1, 1);
  const filter = { $and: and };

  const [items, total, sums] = await Promise.all([
    Transaction.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('customer', 'shopName route')
      .populate('createdBy', 'name role')
      .populate('worker', 'name')
      .lean(),
    Transaction.countDocuments(filter),
    Transaction.aggregate([{ $match: filter }, { $group: { _id: '$type', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
  ]);

  const totals = Object.fromEntries(TXN_TYPES.map((t) => [t, 0]));
  for (const s of sums) totals[s._id] = s.amount;

  res.json({
    items: items.map((t) => ({ ...t, canEdit: canEdit(req.user, t) })),
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    totals,
  });
});

// ---------- my summary: what I entered today (any business date) ----------
router.get('/today-summary', async (req, res) => {
  const start = istDayStart();
  const match = { deleted: false, createdAt: { $gte: start, $lte: istDayEnd(start) }, createdBy: req.user._id };
  const sums = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: { type: '$type', mode: '$paymentMode' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const out = { sale: 0, return: 0, scheme: 0, cash: 0, bank: 0, entries: 0 };
  for (const s of sums) {
    out.entries += s.count;
    if (s._id.type === 'payment') out[s._id.mode] += s.amount;
    else out[s._id.type] += s.amount;
  }
  res.json({ date: istDateKey(start), ...out });
});

// ---------- create ----------
const baseSchema = z.object({
  type: z.enum(TXN_TYPES),
  customer: z.string().min(1, 'Dealer is required'),
  amount: z.coerce.number().positive('Amount must be more than 0'),
  date: z.string().optional(), // YYYY-MM-DD (worker: today or yesterday only)
  worker: z.string().nullable().optional(), // admin only
  paymentMode: z.enum(PAYMENT_MODES).nullable().optional(),
  note: z.string().trim().max(500).optional().default(''),
});

function normalisePayment(data, existing) {
  const type = data.type ?? existing?.type;
  if (type !== 'payment') return { paymentMode: null };
  const mode = data.paymentMode ?? existing?.paymentMode;
  if (!PAYMENT_MODES.includes(mode)) throw badRequest('Choose payment mode: Cash or Bank');
  return { paymentMode: mode };
}

router.post('/', async (req, res) => {
  const data = baseSchema.parse(req.body);
  const customer = await Customer.findOne({ _id: data.customer, deleted: false });
  if (!customer) throw badRequest('Dealer not found');

  let date, worker;
  if (req.user.role === 'worker') {
    date = workerDate(data.date);
    worker = req.user._id;
  } else {
    date = data.date ? parseDateKey(data.date) : istDayStart();
    worker = data.worker || null;
  }

  const txn = await Transaction.create({
    type: data.type,
    customer: customer._id,
    amount: data.amount,
    note: data.note,
    date,
    worker,
    createdBy: req.user._id,
    ...normalisePayment(data),
  });
  await audit(req, {
    action: 'create',
    entity: 'Transaction',
    entityId: txn._id,
    summary: `${LABEL[txn.type]} ₹${txn.amount} for ${customer.shopName}`,
    after: txn,
  });
  // Payment added after today's closing was verified -> closing goes back for re-check
  const reopened = await reopenClosingIfVerified(req, txn);
  res.status(201).json({ ...txn.toObject(), closingReopened: !!reopened });
});

// ---------- edit rules ----------
function canEdit(user, t) {
  if (user.role === 'admin') return true;
  // Worker: only their own entry, only on the same day it was entered
  return String(t.createdBy?._id ?? t.createdBy) === String(user._id) && isSameIstDay(t.createdAt, new Date());
}

async function loadForChange(req) {
  const txn = await Transaction.findOne({ _id: req.params.id, deleted: false });
  if (!txn) throw notFound('Entry not found');
  if (req.user.role === 'worker') {
    const access = await getWorkerAccess(req.user._id);
    if (!isTxnVisibleToWorker(access, txn)) throw notFound('Entry not found');
    if (!canEdit(req.user, txn)) throw forbidden('Entries can only be changed on the same day. Ask admin for corrections.');
    // Cash closing covers everything the worker entered that day
    const closing = await CashClosing.findOne({ worker: req.user._id, dateKey: istDateKey(txn.createdAt), status: 'verified' });
    if (closing) throw forbidden('Cash closing for this day is already verified. Ask admin for corrections.');
  }
  return txn;
}

// ---------- update ----------
router.patch('/:id', async (req, res) => {
  const data = baseSchema.partial().parse(req.body);
  const txn = await loadForChange(req);
  const before = txn.toObject();

  if (data.customer && String(data.customer) !== String(txn.customer)) {
    const c = await Customer.findOne({ _id: data.customer, deleted: false });
    if (!c) throw badRequest('Dealer not found');
    txn.customer = c._id;
  }
  if (data.type) txn.type = data.type;
  if (data.amount !== undefined) txn.amount = data.amount;
  if (data.note !== undefined) txn.note = data.note;
  if (req.user.role === 'admin') {
    if (data.date) txn.date = parseDateKey(data.date);
    if (data.worker !== undefined) txn.worker = data.worker;
  } else {
    if (data.date) txn.date = workerDate(data.date);
  }
  Object.assign(txn, normalisePayment(data, before));

  await txn.save();
  await audit(req, { action: 'update', entity: 'Transaction', entityId: txn._id, summary: `Edited ${LABEL[txn.type]} ₹${txn.amount}`, before, after: txn });
  res.json(txn);
});

// ---------- soft delete ----------
router.delete('/:id', async (req, res) => {
  const txn = await loadForChange(req);
  txn.deleted = true;
  txn.deletedAt = new Date();
  txn.deletedBy = req.user._id;
  await txn.save();
  await audit(req, { action: 'delete', entity: 'Transaction', entityId: txn._id, summary: `Deleted ${LABEL[txn.type]} ₹${txn.amount}`, before: txn });
  res.json({ ok: true });
});

export default router;
