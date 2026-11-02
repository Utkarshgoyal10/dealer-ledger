import { Router } from 'express';
import { adminOnly } from '../middleware/auth.js';
import { AuditLog } from '../models/AuditLog.js';

const router = Router();
router.use(adminOnly);

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.entity) filter.entity = req.query.entity;
  if (req.query.user) filter.user = req.query.user;
  if (req.query.entityId) filter.entityId = req.query.entityId;
  if (req.query.action) filter.action = req.query.action;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name role')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
});

export default router;
