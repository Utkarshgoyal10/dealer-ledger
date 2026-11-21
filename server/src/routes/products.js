import { Router } from 'express';
import { z } from 'zod';
import { Product } from '../models/Product.js';
import { adminOnly } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/http.js';
import { audit } from '../services/audit.js';

const router = Router();
const clean = (s) => s.trim().replace(/\s+/g, ' ');
const keyOf = (s) => clean(s).toLowerCase();

// Salesman: active models only; admin can ask for all (incl. removed)
router.get('/', async (req, res) => {
  const filter = req.user.role === 'admin' && req.query.all === 'true' ? {} : { active: true };
  res.json(await Product.find(filter).sort({ name: 1 }).lean());
});

const schema = z.object({
  name: z.string().trim().min(1, 'Model name is required').max(60),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
  active: z.boolean().optional(),
});

router.post('/', adminOnly, async (req, res) => {
  const data = schema.parse(req.body);
  const name = clean(data.name);
  if (await Product.exists({ key: keyOf(name) })) throw badRequest(`"${name}" is already in the list`);
  const p = await Product.create({ name, key: keyOf(name), price: data.price });
  await audit(req, { action: 'create', entity: 'Product', entityId: p._id, summary: `Added model ${p.name} at ₹${p.price}`, after: p });
  res.status(201).json(p);
});

router.patch('/:id', adminOnly, async (req, res) => {
  const data = schema.partial().parse(req.body);
  const p = await Product.findById(req.params.id);
  if (!p) throw notFound('Model not found');
  const before = p.toObject();
  if (data.name) {
    const name = clean(data.name);
    if (await Product.exists({ key: keyOf(name), _id: { $ne: p._id } })) throw badRequest(`"${name}" is already in the list`);
    p.name = name;
    p.key = keyOf(name);
  }
  if (data.price !== undefined) p.price = data.price;
  if (data.active !== undefined) p.active = data.active;
  await p.save();
  const summary =
    data.price !== undefined && data.price !== before.price
      ? `Price of ${p.name}: ₹${before.price} → ₹${p.price}`
      : `Updated model ${p.name}${data.active === false ? ' (removed from list)' : data.active === true ? ' (added back)' : ''}`;
  await audit(req, { action: 'update', entity: 'Product', entityId: p._id, summary, before, after: p });
  res.json(p);
});

export default router;
