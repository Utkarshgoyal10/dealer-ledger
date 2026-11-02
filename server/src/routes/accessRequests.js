import { Router } from 'express';
import { z } from 'zod';
import { AccessRequest } from '../models/AccessRequest.js';
import { Customer } from '../models/Customer.js';
import { adminOnly, requireRole } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/http.js';
import { audit } from '../services/audit.js';
import { workerWindowStart } from '../services/access.js';
import { istDayEnd, istDateKey, parseDateKey } from '../utils/dates.js';
import { notifyAdmins } from '../services/push.js';

const router = Router();

const populate = (q) =>
  q.populate('worker', 'name username').populate('customer', 'shopName route').populate('reviewedBy', 'name');

router.get('/', async (req, res) => {
  const filter = {};
  if (req.user.role === 'worker') filter.worker = req.user._id;
  else if (req.query.worker) filter.worker = req.query.worker;
  if (req.query.status) filter.status = req.query.status;
  const items = await populate(AccessRequest.find(filter).sort({ createdAt: -1 }).limit(200)).lean();
  const now = new Date();
  res.json(items.map((r) => ({ ...r, isActive: r.status === 'approved' && r.accessExpiresAt > now })));
});

router.get('/pending-count', adminOnly, async (req, res) => {
  res.json({ count: await AccessRequest.countDocuments({ status: 'pending' }) });
});

const createSchema = z.object({
  customer: z.string().min(1, 'Dealer is required'),
  fromDate: z.string().min(1, 'From date is required'),
  toDate: z.string().min(1, 'To date is required'),
  reason: z.string().trim().min(3, 'Please give a reason'),
});

router.post('/', requireRole('worker'), async (req, res) => {
  const data = createSchema.parse(req.body);
  const customer = await Customer.findOne({ _id: data.customer, deleted: false });
  if (!customer) throw badRequest('Dealer not found');

  const fromDate = parseDateKey(data.fromDate);
  const toDate = istDayEnd(parseDateKey(data.toDate));
  if (fromDate > toDate) throw badRequest('From date must be before To date');
  const windowStart = workerWindowStart();
  if (fromDate >= windowStart) {
    throw badRequest(`You can already see data from ${istDateKey(windowStart)} onwards. Request only older dates.`);
  }

  const dup = await AccessRequest.findOne({ worker: req.user._id, customer: customer._id, status: 'pending', fromDate, toDate });
  if (dup) throw badRequest('You already have a pending request for this dealer and dates');

  const reqDoc = await AccessRequest.create({ worker: req.user._id, customer: customer._id, fromDate, toDate, reason: data.reason });
  await audit(req, {
    action: 'create',
    entity: 'AccessRequest',
    entityId: reqDoc._id,
    summary: `Requested ${customer.shopName} data ${data.fromDate} to ${data.toDate}`,
    after: reqDoc,
  });
  notifyAdmins({
    title: 'Old data request',
    body: `${req.user.name} wants ${customer.shopName} data (${data.fromDate} to ${data.toDate})`,
    url: '/requests',
    tag: `access-${reqDoc._id}`,
  });
  res.status(201).json(reqDoc);
});

const approveSchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(3), // how long the worker keeps access
  adminNote: z.string().trim().max(500).optional().default(''),
});

router.post('/:id/approve', adminOnly, async (req, res) => {
  const { days, adminNote } = approveSchema.parse(req.body);
  const r = await AccessRequest.findById(req.params.id);
  if (!r) throw notFound('Request not found');
  if (r.status !== 'pending') throw badRequest(`Request is already ${r.status}`);
  r.status = 'approved';
  r.reviewedBy = req.user._id;
  r.reviewedAt = new Date();
  r.adminNote = adminNote;
  r.accessExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await r.save();
  await audit(req, { action: 'approve', entity: 'AccessRequest', entityId: r._id, summary: `Approved data access for ${days} day(s)`, after: r });
  res.json(await populate(AccessRequest.findById(r._id)).lean());
});

router.post('/:id/reject', adminOnly, async (req, res) => {
  const { adminNote } = z.object({ adminNote: z.string().trim().max(500).optional().default('') }).parse(req.body);
  const r = await AccessRequest.findById(req.params.id);
  if (!r) throw notFound('Request not found');
  if (r.status !== 'pending') throw badRequest(`Request is already ${r.status}`);
  r.status = 'rejected';
  r.reviewedBy = req.user._id;
  r.reviewedAt = new Date();
  r.adminNote = adminNote;
  await r.save();
  await audit(req, { action: 'reject', entity: 'AccessRequest', entityId: r._id, summary: 'Rejected data access request', after: r });
  res.json(await populate(AccessRequest.findById(r._id)).lean());
});

router.post('/:id/revoke', adminOnly, async (req, res) => {
  const r = await AccessRequest.findById(req.params.id);
  if (!r) throw notFound('Request not found');
  if (r.status !== 'approved') throw badRequest('Only approved requests can be revoked');
  r.status = 'revoked';
  r.accessExpiresAt = new Date();
  await r.save();
  await audit(req, { action: 'revoke', entity: 'AccessRequest', entityId: r._id, summary: 'Revoked data access', after: r });
  res.json(await populate(AccessRequest.findById(r._id)).lean());
});

export default router;
