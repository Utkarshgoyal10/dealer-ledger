import { Router } from 'express';
import { z } from 'zod';
import { CashClosing } from '../models/CashClosing.js';
import { Transaction } from '../models/Transaction.js';
import { adminOnly, requireRole } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/http.js';
import { audit } from '../services/audit.js';
import { workerWindowStart } from '../services/access.js';
import { addDays, istDayStart, istDateKey, parseDateKey, istDayEnd } from '../utils/dates.js';
import { round2 } from '../services/ledger.js';
import { notifyAdmins } from '../services/push.js';
import { reopenIfMismatch } from '../services/cashClosing.js';

const router = Router();

/** Payments this worker entered in the app on this day (including ones dated yesterday) */
async function systemTotals(workerId, date) {
  const rows = await Transaction.aggregate([
    { $match: { deleted: false, createdBy: workerId, type: 'payment', createdAt: { $gte: date, $lte: istDayEnd(date) } } },
    { $group: { _id: '$paymentMode', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const cash = rows.find((r) => r._id === 'cash');
  const bank = rows.find((r) => r._id === 'bank');
  return {
    systemCash: round2(cash?.amount || 0),
    cashCount: cash?.count || 0,
    bankTotal: round2(bank?.amount || 0),
    bankCount: bank?.count || 0,
  };
}

/**
 * Safety net: any verified closing (last few days) that no longer matches the app's
 * cash/bank totals is re-opened, so a payment added after verification is never missed.
 */
async function syncVerifiedClosings(req, workerId) {
  const filter = { status: 'verified', date: { $gte: addDays(istDayStart(), -7) } };
  if (workerId) filter.worker = workerId;
  const verified = await CashClosing.find(filter).populate('worker', 'name');
  for (const c of verified) {
    const live = await systemTotals(c.worker._id, c.date);
    await reopenIfMismatch(req, c, live, c.worker.name);
  }
}

router.get('/today', requireRole('worker'), async (req, res) => {
  const date = istDayStart();
  const dateKey = istDateKey(date);
  await syncVerifiedClosings(req, req.user._id);
  const [totals, closing] = await Promise.all([
    systemTotals(req.user._id, date),
    CashClosing.findOne({ worker: req.user._id, dateKey }).populate('reviewedBy', 'name').lean(),
  ]);
  res.json({ dateKey, ...totals, closing });
});

router.post('/', requireRole('worker'), async (req, res) => {
  const { declaredCash, note } = z
    .object({
      declaredCash: z.coerce.number().min(0, 'Cash cannot be negative'),
      note: z.string().trim().max(500).optional().default(''),
    })
    .parse(req.body);

  const date = istDayStart();
  const dateKey = istDateKey(date);
  const existing = await CashClosing.findOne({ worker: req.user._id, dateKey });
  if (existing?.status === 'verified') throw badRequest('Today\'s closing is already verified by admin');

  const totals = await systemTotals(req.user._id, date);
  const doc = existing || new CashClosing({ worker: req.user._id, dateKey, date });
  const before = existing?.toObject();
  Object.assign(doc, {
    systemCash: totals.systemCash,
    bankCount: totals.bankCount,
    bankTotal: totals.bankTotal,
    declaredCash,
    difference: round2(declaredCash - totals.systemCash),
    note,
    status: 'submitted',
    reviewedBy: undefined,
    reviewedAt: undefined,
    adminNote: '',
    needsResubmit: false,
  });
  await doc.save();
  await audit(req, {
    action: existing ? 'update' : 'create',
    entity: 'CashClosing',
    entityId: doc._id,
    summary: `Cash closing ${dateKey}: declared ₹${declaredCash}, system ₹${totals.systemCash}`,
    before,
    after: doc,
  });
  notifyAdmins({
    title: existing?.reopenedAt ? 'Cash closing re-submitted' : 'Cash closing submitted',
    body: `${req.user.name}: ₹${declaredCash} declared (app shows ₹${totals.systemCash})`,
    url: '/cash',
    tag: `closing-${doc._id}`,
  });
  res.status(existing ? 200 : 201).json(doc);
});

router.get('/', async (req, res) => {
  await syncVerifiedClosings(req, req.user.role === 'worker' ? req.user._id : req.query.worker);
  const filter = {};
  if (req.user.role === 'worker') {
    filter.worker = req.user._id;
    filter.date = { $gte: workerWindowStart() };
  } else {
    if (req.query.worker) filter.worker = req.query.worker;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = parseDateKey(req.query.from);
      if (req.query.to) filter.date.$lte = istDayEnd(parseDateKey(req.query.to));
    }
  }
  const items = await CashClosing.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(200)
    .populate('worker', 'name')
    .populate('reviewedBy', 'name')
    .lean();
  // Flag closings where entries were added/changed after the worker submitted
  await Promise.all(
    items
      .filter((c) => c.status === 'submitted')
      .map(async (c) => {
        const now = await systemTotals(c.worker._id, c.date);
        c.currentSystemCash = now.systemCash;
        c.changedSinceSubmit = now.systemCash !== c.systemCash || now.bankTotal !== c.bankTotal;
      })
  );
  res.json(items);
});

router.post('/:id/review', adminOnly, async (req, res) => {
  const { status, adminNote } = z
    .object({ status: z.enum(['verified', 'disputed']), adminNote: z.string().trim().max(500).optional().default('') })
    .parse(req.body);
  const doc = await CashClosing.findById(req.params.id).populate('worker', 'name');
  if (!doc) throw notFound('Cash closing not found');
  if (status === 'verified') {
    const live = await systemTotals(doc.worker._id, doc.date);
    if (live.systemCash !== doc.systemCash || live.bankTotal !== doc.bankTotal) {
      throw badRequest(
        `Can't verify yet: ${doc.worker.name} changed payments after submitting (app now shows cash ₹${live.systemCash}, submitted was ₹${doc.systemCash}). Ask them to submit cash again.`
      );
    }
  }
  const before = doc.toObject();
  doc.status = status;
  doc.adminNote = adminNote;
  doc.reviewedBy = req.user._id;
  doc.reviewedAt = new Date();
  doc.needsResubmit = false;
  await doc.save();
  await audit(req, { action: status === 'verified' ? 'verify' : 'dispute', entity: 'CashClosing', entityId: doc._id, summary: `Cash closing ${doc.dateKey} ${status}`, before, after: doc });
  res.json(await CashClosing.findById(doc._id).populate('worker', 'name').populate('reviewedBy', 'name').lean());
});

export default router;
