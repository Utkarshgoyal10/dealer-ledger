import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { LoginRequest } from '../models/LoginRequest.js';
import { adminOnly } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/http.js';
import { audit } from '../services/audit.js';

const router = Router();
router.use(adminOnly);

const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .regex(/^[a-z0-9._-]+$/, 'Username can only have letters, numbers, dot, dash and underscore');
const password = z.string().min(6, 'Password must be at least 6 characters');

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  const users = await User.find(filter).sort({ role: 1, name: 1 });
  res.json(users.map((u) => u.toSafeJSON()));
});

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  username,
  password,
  role: z.enum(['admin', 'worker']).default('worker'),
});

router.post('/', async (req, res) => {
  const data = createSchema.parse(req.body);
  if (await User.exists({ username: data.username })) throw badRequest('This username is already taken');
  const user = await User.create({ ...data, passwordHash: await bcrypt.hash(data.password, 10) });
  await audit(req, { action: 'create', entity: 'User', entityId: user._id, summary: `Created ${user.role} ${user.username}`, after: user.toSafeJSON() });
  res.status(201).json(user.toSafeJSON());
});

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  active: z.boolean().optional(),
});

router.patch('/:id', async (req, res) => {
  const data = updateSchema.parse(req.body);
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('User not found');
  if (String(user._id) === String(req.user._id) && data.active === false) throw badRequest('You cannot deactivate yourself');
  const before = user.toSafeJSON();
  Object.assign(user, data);
  if (data.active === false) {
    user.tokenVersion += 1; // kick out immediately
    await LoginRequest.updateMany({ worker: user._id, status: { $in: ['pending', 'approved'] } }, { status: 'revoked' });
  }
  await user.save();
  await audit(req, {
    action: data.active === false ? 'deactivate' : data.active === true ? 'activate' : 'update',
    entity: 'User',
    entityId: user._id,
    summary: `Updated ${user.username}`,
    before,
    after: user.toSafeJSON(),
  });
  res.json(user.toSafeJSON());
});

router.post('/:id/reset-password', async (req, res) => {
  const data = z.object({ password }).parse(req.body);
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('User not found');
  user.passwordHash = await bcrypt.hash(data.password, 10);
  user.tokenVersion += 1;
  await user.save();
  await audit(req, { action: 'reset-password', entity: 'User', entityId: user._id, summary: `Reset password for ${user.username}` });
  res.json({ ok: true });
});

export default router;
