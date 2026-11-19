import { Router } from 'express';
import { z } from 'zod';
import { Confirmation } from '../models/Confirmation.js';
import { Customer } from '../models/Customer.js';
import { adminOnly } from '../middleware/auth.js';
import { badRequest, forbidden, notFound } from '../utils/http.js';
import { audit } from '../services/audit.js';
import { buildLedger, computeBalances, round2 } from '../services/ledger.js';
import { workerWindowStart } from '../services/access.js';
import { istDayStart, istDateKey, parseDateKey } from '../utils/dates.js';
import { notifyAdmins } from '../services/push.js';
import { confirmStatusMap, monthKey } from '../services/confirmStatus.js';
import { getLock } from '../services/confirmLock.js';

const router = Router();
const isAdmin = (req) => req.user.role === 'admin';
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/**
 * Statement shown to the dealer: from the day of the last signed confirmation
 * (or the 1st of this month), up to now. A salesman never sees further back than
 * his normal 30-day window. Hidden-balance dealers can't be confirmed by salesmen.
 */
async function statementFor(req, customerId) {
  const customer = await Customer.findOne({ _id: customerId, deleted: false }).lean();
  if (!customer) throw notFound('Dealer not found');
  if (!isAdmin(req) && customer.hideBalance) throw forbidden("This dealer's balance is handled by admin");

  const last = await Confirmation.findOne({ customer: customer._id, status: 'confirmed', rejectedAt: null }).sort({ createdAt: -1 }).lean();
  let from = last ? istDayStart(last.createdAt) : parseDateKey(istDateKey().slice(0, 8) + '01');
  if (!isAdmin(req)) {
    const win = workerWindowStart();
    if (from < win) from = win;
  }
  const ledger = await buildLedger(customer._id, { from });
  const totals = { sale: 0, return: 0, payment: 0, scheme: 0 };
  for (const r of ledger.rows) totals[r.type] = round2(totals[r.type] + r.amount);
  return {
    customer: { _id: customer._id, shopName: customer.shopName, route: customer.route },
    periodFrom: from,
    openingBalance: ledger.broughtForward,
    closingBalance: ledger.currentBalance,
    totals,
    entries: ledger.rows.map((r) => ({ date: r.date, type: r.type, paymentMode: r.paymentMode || null, amount: r.amount, balance: r.balance })),
    lastConfirmation: last ? { _id: last._id, createdAt: last.createdAt, closingBalance: last.closingBalance } : null,
  };
}

// Statement preview for the signing screen
router.get('/statement/:customerId', async (req, res) => {
  res.json(await statementFor(req, req.params.customerId));
});

const createSchema = z
  .object({
    customer: z.string().min(1),
    status: z.enum(['confirmed', 'disputed']),
    signature: z.string().max(180000, 'Signature is too large').optional(),
    signerName: z.string().trim().max(80).optional().default(''),
    note: z.string().trim().max(500).optional().default(''),
    expectedBalance: z.coerce.number(), // balance the dealer saw on screen
  })
  .refine((d) => d.status !== 'confirmed' || /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(d.signature || ''), {
    message: 'Dealer signature is required',
  })
  .refine((d) => d.status !== 'disputed' || d.note.length >= 3, { message: 'Write what is wrong' });

router.post('/', async (req, res) => {
  const data = createSchema.parse(req.body);
  // Rebuild the statement on the server — never trust numbers from the phone
  const st = await statementFor(req, data.customer);
  if (Math.abs(st.closingBalance - data.expectedBalance) >= 0.01) {
    throw badRequest('The balance changed while signing (a new entry was added). Please reopen and check again.');
  }
  const doc = await Confirmation.create({
    customer: st.customer._id,
    createdBy: req.user._id,
    status: data.status,
    periodFrom: st.periodFrom,
    openingBalance: st.openingBalance,
    closingBalance: st.closingBalance,
    totals: st.totals,
    entries: st.entries,
    signature: data.status === 'confirmed' ? data.signature : undefined,
    signerName: data.signerName,
    note: data.status === 'disputed' ? data.note : '',
  });
  const summary =
    data.status === 'confirmed'
      ? `${st.customer.shopName} confirmed balance ${inr(st.closingBalance)}`
      : `${st.customer.shopName} disputed balance ${inr(st.closingBalance)}: ${data.note}`;
  await audit(req, { action: 'create', entity: 'Confirmation', entityId: doc._id, summary });
  if (data.status === 'disputed') {
    notifyAdmins({
      title: 'Dealer disputed balance',
      body: `${st.customer.shopName} (${inr(st.closingBalance)}) — ${data.note} • by ${req.user.name}`,
      url: '/confirmations?tab=disputed',
      tag: `confirm-${doc._id}`,
    }).catch(() => {});
  }
  res.status(201).json({ _id: doc._id, status: doc.status, closingBalance: doc.closingBalance, createdAt: doc.createdAt });
});

// List (no signature image — keeps it light). Admin: all; salesman: the ones he took.
router.get('/', async (req, res) => {
  const filter = {};
  if (!isAdmin(req)) filter.createdBy = req.user._id;
  if (req.query.customer) filter.customer = req.query.customer;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.open === 'true') Object.assign(filter, { status: 'disputed', resolvedAt: null });
  if (req.query.toApprove === 'true') Object.assign(filter, { status: 'confirmed', approvedAt: null, rejectedAt: null });
  const items = await Confirmation.find(filter, { signature: 0, entries: 0 })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 100, 300))
    .populate('customer', 'shopName route')
    .populate('createdBy', 'name')
    .lean();
  res.json(items);
});

// Admin overview: every dealer with their latest confirmation
router.get('/overview', adminOnly, async (req, res) => {
  const customers = await Customer.find({ deleted: false }).sort({ shopName: 1 }).lean();
  const latest = await Confirmation.aggregate([
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$customer', doc: { $first: '$$ROOT' }, lastConfirmed: { $max: { $cond: [{ $and: [{ $eq: ['$status', 'confirmed'] }, { $eq: [{ $ifNull: ['$rejectedAt', null] }, null] }] }, '$createdAt', null] } } } },
  ]);
  const byId = new Map(latest.map((l) => [String(l._id), l]));
  const balances = await computeBalances(customers);
  const cst = await confirmStatusMap(customers, balances);
  res.json(
    customers.map((c) => {
      const l = byId.get(String(c._id));
      return {
        monthStatus: cst.get(String(c._id)),
        _id: c._id,
        shopName: c.shopName,
        route: c.route,
        hideBalance: !!c.hideBalance,
        balance: balances.get(String(c._id)),
        lastConfirmedAt: l?.lastConfirmed || null,
        latest: l
          ? { _id: l.doc._id, status: l.doc.status, createdAt: l.doc.createdAt, closingBalance: l.doc.closingBalance, resolvedAt: l.doc.resolvedAt || null, approvedAt: l.doc.approvedAt || null, rejectedAt: l.doc.rejectedAt || null }
          : null,
      };
    })
  );
});

// This month's status for one dealer (dealer page banner)
router.get('/status/:customerId', async (req, res) => {
  const c = await Customer.findOne({ _id: req.params.customerId, deleted: false }).lean();
  if (!c) throw notFound('Dealer not found');
  const balances = await computeBalances([c]);
  const st = (await confirmStatusMap([c], balances, { forWorker: !isAdmin(req) })).get(String(c._id));
  const last = await Confirmation.findOne({ customer: c._id }, { signature: 0, entries: 0 }).sort({ createdAt: -1 }).populate('createdBy', 'name').lean();
  const lock = await getLock(c._id);
  res.json({ lockedAt: lock?.at || null, monthStatus: st, month: monthKey(), skipped: (c.confirmSkips || []).includes(monthKey()), last: last && (isAdmin(req) || !c.hideBalance) ? last : null });
});

// Admin: skip (or un-skip) this month's confirmation for a dealer
router.post('/skip', adminOnly, async (req, res) => {
  const { customer, skip } = z.object({ customer: z.string().min(1), skip: z.boolean() }).parse(req.body);
  const c = await Customer.findOne({ _id: customer, deleted: false });
  if (!c) throw notFound('Dealer not found');
  const mk = monthKey();
  const set = new Set(c.confirmSkips || []);
  if (skip) set.add(mk);
  else set.delete(mk);
  c.confirmSkips = [...set];
  await c.save();
  await audit(req, { action: 'update', entity: 'Customer', entityId: c._id, summary: `${skip ? 'Skipped' : 'Un-skipped'} ${mk} balance confirmation for ${c.shopName}` });
  res.json({ ok: true, month: mk, skipped: skip });
});

// One confirmation with signature + entries
router.get('/:id', async (req, res) => {
  const doc = await Confirmation.findById(req.params.id).populate('customer', 'shopName route').populate('createdBy', 'name').populate('resolvedBy', 'name').populate('approvedBy', 'name').populate('rejectedBy', 'name').lean();
  if (!doc) throw notFound('Confirmation not found');
  if (!isAdmin(req) && String(doc.createdBy?._id) !== String(req.user._id)) throw forbidden();
  res.json(doc);
});

// Admin cross-checks a signed confirmation against his own books
router.post('/:id/approve', adminOnly, async (req, res) => {
  const doc = await Confirmation.findById(req.params.id).populate('customer', 'shopName');
  if (!doc) throw notFound('Confirmation not found');
  if (doc.status !== 'confirmed') throw badRequest('Only a signed confirmation can be approved');
  if (doc.approvedAt) throw badRequest('Already approved');
  if (doc.rejectedAt) throw badRequest('This confirmation was rejected');
  doc.approvedAt = new Date();
  doc.approvedBy = req.user._id;
  await doc.save();
  await audit(req, { action: 'approve', entity: 'Confirmation', entityId: doc._id, summary: `Approved balance confirmation of ${doc.customer?.shopName} (${inr(doc.closingBalance)})` });
  res.json({ ok: true });
});

// Admin rejects a signed confirmation (balance in his books differs). Unlocks the period.
router.post('/:id/reject', adminOnly, async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(3, 'Write why you are rejecting').max(500) }).parse(req.body || {});
  const doc = await Confirmation.findById(req.params.id).populate('customer', 'shopName');
  if (!doc) throw notFound('Confirmation not found');
  if (doc.status !== 'confirmed') throw badRequest('Only a signed confirmation can be rejected');
  if (doc.rejectedAt) throw badRequest('Already rejected');
  doc.rejectedAt = new Date();
  doc.rejectedBy = req.user._id;
  doc.rejectReason = reason;
  await doc.save();
  await audit(req, { action: 'reject', entity: 'Confirmation', entityId: doc._id, summary: `Rejected balance confirmation of ${doc.customer?.shopName} (${inr(doc.closingBalance)}): ${reason}` });
  res.json({ ok: true });
});

// Admin closes a dispute after sorting it out
router.post('/:id/resolve', adminOnly, async (req, res) => {
  const { adminNote } = z.object({ adminNote: z.string().trim().max(500).optional().default('') }).parse(req.body || {});
  const doc = await Confirmation.findById(req.params.id).populate('customer', 'shopName');
  if (!doc) throw notFound('Confirmation not found');
  if (doc.status !== 'disputed') throw badRequest('Only a disputed confirmation can be resolved');
  if (doc.resolvedAt) throw badRequest('Already resolved');
  doc.resolvedAt = new Date();
  doc.resolvedBy = req.user._id;
  doc.adminNote = adminNote;
  await doc.save();
  await audit(req, { action: 'update', entity: 'Confirmation', entityId: doc._id, summary: `Resolved dispute of ${doc.customer?.shopName}${adminNote ? `: ${adminNote}` : ''}` });
  res.json({ ok: true });
});

export default router;
