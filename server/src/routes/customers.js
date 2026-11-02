import { Router } from 'express';
import { z } from 'zod';
import { Customer } from '../models/Customer.js';
import { Route, routeKey } from '../models/Route.js';
import { adminOnly } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/http.js';
import { audit } from '../services/audit.js';
import { computeBalance, computeBalances, buildLedger } from '../services/ledger.js';
import { getWorkerAccess, isTxnVisibleToWorker } from '../services/access.js';
import { parseDateKey, istDayEnd } from '../utils/dates.js';

const router = Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- routes (areas) ----------
router.get('/routes', async (req, res) => {
  const routes = await Route.find().sort({ name: 1 }).lean();
  res.json(routes.map((r) => r.name));
});

// Anyone logged in can add a new route to the list
router.post('/routes', async (req, res) => {
  const { name } = z.object({ name: z.string().trim().min(2, 'Route name is too short').max(60) }).parse(req.body);
  const clean = name.replace(/\s+/g, ' ');
  const existing = await Route.findOne({ key: routeKey(clean) });
  if (existing) return res.json({ name: existing.name, existed: true });
  const route = await Route.create({ name: clean, key: routeKey(clean), createdBy: req.user._id });
  await audit(req, { action: 'create', entity: 'Route', entityId: route._id, summary: `Added route ${route.name}` });
  res.status(201).json({ name: route.name });
});

async function resolveRoute(name) {
  if (!name) return '';
  const r = await Route.findOne({ key: routeKey(name) });
  if (!r) throw badRequest('Choose a route from the list (or add it first)');
  return r.name;
}

// ---------- customers ----------
router.get('/', async (req, res) => {
  const filter = { deleted: false };
  if (req.query.route) filter.route = req.query.route;
  if (req.query.q) filter.shopName = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
  const customers = await Customer.find(filter).sort({ shopName: 1 }).lean();
  // Workers see a dealer's balance only after opening that dealer, not in the list
  if (req.user.role !== 'admin') return res.json(customers.map(({ openingBalance, ...c }) => c));
  const balances = await computeBalances(customers);
  res.json(customers.map((c) => ({ ...c, balance: balances.get(String(c._id)) })));
});

router.get('/:id', async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, deleted: false }).lean();
  if (!customer) throw notFound('Dealer not found');
  res.json({ ...customer, balance: await computeBalance(customer) });
});

router.get('/:id/ledger', async (req, res) => {
  const from = req.query.from ? parseDateKey(req.query.from) : undefined;
  const to = req.query.to ? istDayEnd(parseDateKey(req.query.to)) : undefined;

  let isVisible;
  let access;
  if (req.user.role === 'worker') {
    access = await getWorkerAccess(req.user._id);
    isVisible = (t) => isTxnVisibleToWorker(access, t);
  }

  const ledger = await buildLedger(req.params.id, { from, to, isVisible });
  if (!ledger || ledger.customer.deleted) throw notFound('Dealer not found');

  if (access) {
    ledger.visibility = {
      windowStart: access.windowStart,
      grants: access.grants
        .filter((g) => String(g.customer) === String(req.params.id))
        .map((g) => ({ fromDate: g.fromDate, toDate: g.toDate, accessExpiresAt: g.accessExpiresAt })),
    };
  }
  res.json(ledger);
});

const customerSchema = z.object({
  shopName: z.string().trim().min(1, 'Shop name is required'),
  route: z.string().trim().optional().default(''),
  openingBalance: z.coerce.number().optional().default(0),
});

// Workers and admin can add customers
router.post('/', async (req, res) => {
  const data = customerSchema.parse(req.body);
  data.route = await resolveRoute(data.route);
  const dup = await Customer.findOne({ deleted: false, route: data.route, shopName: new RegExp(`^${escapeRegex(data.shopName)}$`, 'i') });
  if (dup) throw badRequest(`"${dup.shopName}" already exists on this route`);
  const customer = await Customer.create({ ...data, createdBy: req.user._id });
  await audit(req, { action: 'create', entity: 'Customer', entityId: customer._id, summary: `Added dealer ${customer.shopName}`, after: customer });
  res.status(201).json(customer);
});

// Only admin can edit or delete
router.patch('/:id', adminOnly, async (req, res) => {
  const data = customerSchema.partial().parse(req.body);
  const customer = await Customer.findOne({ _id: req.params.id, deleted: false });
  if (!customer) throw notFound('Dealer not found');
  if ('route' in data) data.route = await resolveRoute(data.route);
  const before = customer.toObject();
  Object.assign(customer, data);
  await customer.save();
  await audit(req, { action: 'update', entity: 'Customer', entityId: customer._id, summary: `Updated dealer ${customer.shopName}`, before, after: customer });
  res.json(customer);
});

router.delete('/:id', adminOnly, async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, deleted: false });
  if (!customer) throw notFound('Dealer not found');
  customer.deleted = true;
  customer.deletedAt = new Date();
  customer.deletedBy = req.user._id;
  await customer.save();
  await audit(req, { action: 'delete', entity: 'Customer', entityId: customer._id, summary: `Deleted dealer ${customer.shopName}` });
  res.json({ ok: true });
});

export default router;
