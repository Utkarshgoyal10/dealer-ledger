import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { StockCheck } from '../models/StockCheck.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { User } from '../models/User.js';
import { Transaction } from '../models/Transaction.js';
import { adminOnly } from '../middleware/auth.js';
import { badRequest, forbidden, notFound } from '../utils/http.js';
import { audit } from '../services/audit.js';
import { computeBalance, computeBalances, round2 } from '../services/ledger.js';

const router = Router();
const isAdmin = (req) => req.user.role === 'admin';
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/** Payments received from each dealer after its check was saved: Map(id -> amount) */
async function paidSince(checks) {
  if (!checks.length) return new Map();
  const or = checks.map((k) => ({ customer: new mongoose.Types.ObjectId(String(k.customer)), createdAt: { $gt: k.createdAt } }));
  const rows = await Transaction.aggregate([
    { $match: { deleted: false, type: 'payment', $or: or } },
    { $group: { _id: '$customer', amount: { $sum: '$amount' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), round2(r.amount)]));
}

/** Still short = gap at the check − payments received since (never below 0) */
const summarize = (k, paid = 0) =>
  k && {
    _id: k._id,
    createdAt: k.createdAt,
    stockValue: k.stockValue,
    totalQty: k.totalQty,
    outstanding: k.outstanding,
    gap: k.gap,
    paidSince: paid,
    stillShort: round2(Math.max(0, k.gap - paid)),
    by: k.createdBy?.name,
  };

// Last check for one dealer (dealer page + warning in the sale form)
router.get('/status/:customerId', async (req, res) => {
  const c = await Customer.findOne({ _id: req.params.customerId, deleted: false }).lean();
  if (!c) throw notFound('Dealer not found');
  if (!isAdmin(req) && c.hideBalance) return res.json({ handledByAdmin: true, last: null });
  const last = await StockCheck.findOne({ customer: c._id }, { items: 0 }).sort({ createdAt: -1 }).populate('createdBy', 'name').lean();
  const paid = last ? (await paidSince([last])).get(String(c._id)) || 0 : 0;
  res.json({ handledByAdmin: false, last: summarize(last, paid) });
});

const createSchema = z.object({
  customer: z.string().min(1),
  items: z.array(z.object({ product: z.string().min(1), qty: z.coerce.number().int().min(0).max(10000) })).max(500),
  note: z.string().trim().max(300).optional().default(''),
});

router.post('/', async (req, res) => {
  const data = createSchema.parse(req.body);
  const c = await Customer.findOne({ _id: data.customer, deleted: false }).lean();
  if (!c) throw notFound('Dealer not found');
  if (!isAdmin(req) && c.hideBalance) throw forbidden("This dealer's stock check is handled by admin");

  // Prices come from the server's list, never from the phone
  const wanted = data.items.filter((i) => i.qty > 0);
  const products = await Product.find({ _id: { $in: wanted.map((i) => i.product) }, active: true }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const items = wanted.map((i) => {
    const p = byId.get(i.product);
    if (!p) throw badRequest('A model in the list was changed or removed. Please reopen the stock check.');
    return { product: p._id, name: p.name, price: p.price, qty: i.qty, value: round2(p.price * i.qty) };
  });
  const stockValue = round2(items.reduce((s, i) => s + i.value, 0));
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const outstanding = await computeBalance(c);
  const gap = round2(outstanding - stockValue);

  const k = await StockCheck.create({ customer: c._id, createdBy: req.user._id, items, totalQty, stockValue, outstanding, gap, note: data.note });
  await audit(req, {
    action: 'create',
    entity: 'StockCheck',
    entityId: k._id,
    summary: `Stock check ${c.shopName}: ${totalQty} phones ${inr(stockValue)} vs outstanding ${inr(outstanding)} → ${gap > 0 ? `short ${inr(gap)}` : 'covered'}`,
  });
  res.status(201).json(summarize({ ...k.toObject(), createdBy: { name: req.user.name } }, 0));
});

// History. Admin: all / one dealer. Salesman: only the checks he did (not hidden dealers).
router.get('/', async (req, res) => {
  const filter = {};
  if (!isAdmin(req)) filter.createdBy = req.user._id;
  if (req.query.customer) filter.customer = req.query.customer;
  const list = await StockCheck.find(filter, { items: 0 })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 50, 200))
    .populate('customer', 'shopName route hideBalance')
    .populate('createdBy', 'name')
    .lean();
  res.json(isAdmin(req) ? list : list.filter((k) => !k.customer?.hideBalance));
});

// Admin overview: every dealer with its latest check and what is still short now
router.get('/overview', adminOnly, async (req, res) => {
  const customers = await Customer.find({ deleted: false }).sort({ shopName: 1 }).lean();
  const latest = await StockCheck.aggregate([{ $sort: { createdAt: -1 } }, { $group: { _id: '$customer', doc: { $first: '$$ROOT' } } }]);
  // aggregate returns plain ids: attach the salesman's name
  const users = new Map((await User.find({ _id: { $in: latest.map((l) => l.doc.createdBy) } }, { name: 1 }).lean()).map((u) => [String(u._id), u]));
  for (const l of latest) l.doc.createdBy = users.get(String(l.doc.createdBy)) || { name: '?' };
  const byId = new Map(latest.map((l) => [String(l._id), l.doc]));
  const paid = await paidSince(latest.map((l) => l.doc));
  const balances = await computeBalances(customers);
  res.json(
    customers.map((c) => {
      const k = byId.get(String(c._id));
      return { _id: c._id, shopName: c.shopName, route: c.route, balance: balances.get(String(c._id)), last: k ? summarize(k, paid.get(String(c._id)) || 0) : null };
    })
  );
});

// One check with every model counted
router.get('/:id', async (req, res) => {
  const k = await StockCheck.findById(req.params.id).populate('customer', 'shopName route hideBalance').populate('createdBy', 'name').lean();
  if (!k) throw notFound('Stock check not found');
  if (!isAdmin(req) && (String(k.createdBy?._id) !== String(req.user._id) || k.customer?.hideBalance)) throw forbidden();
  res.json(k);
});

export default router;
