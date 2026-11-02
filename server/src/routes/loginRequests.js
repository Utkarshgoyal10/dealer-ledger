import { Router } from 'express';
import { adminOnly } from '../middleware/auth.js';
import { LoginRequest } from '../models/LoginRequest.js';
import { badRequest, notFound } from '../utils/http.js';
import { audit } from '../services/audit.js';
import { istDateKey } from '../utils/dates.js';

// Admin approves worker logins. An approval is valid for today only.
const router = Router();
router.use(adminOnly);

const populate = (q) => q.populate('worker', 'name username').populate('reviewedBy', 'name');

router.get('/', async (req, res) => {
  const today = istDateKey();
  const filter = req.query.status === 'pending' ? { status: 'pending', dateKey: today } : { dateKey: req.query.date || today };
  const items = await populate(LoginRequest.find(filter).sort({ createdAt: -1 }).limit(200)).lean();
  res.json(items);
});

router.get('/pending-count', async (req, res) => {
  res.json({ count: await LoginRequest.countDocuments({ status: 'pending', dateKey: istDateKey() }) });
});

async function review(req, from, to) {
  const lr = await LoginRequest.findById(req.params.id).populate('worker', 'name username');
  if (!lr) throw notFound('Login request not found');
  if (lr.dateKey !== istDateKey()) throw badRequest('This request is from an earlier day');
  if (!from.includes(lr.status)) throw badRequest(`Request is already ${lr.status}`);
  lr.status = to;
  lr.reviewedBy = req.user._id;
  lr.reviewedAt = new Date();
  await lr.save();
  await audit(req, { action: to === 'approved' ? 'approve' : to === 'rejected' ? 'reject' : 'revoke', entity: 'LoginRequest', entityId: lr._id, summary: `Login of ${lr.worker?.username} ${to}` });
  return populate(LoginRequest.findById(lr._id)).lean();
}

router.post('/:id/approve', async (req, res) => res.json(await review(req, ['pending'], 'approved')));
router.post('/:id/reject', async (req, res) => res.json(await review(req, ['pending'], 'rejected')));
// Ends an approved session immediately
router.post('/:id/revoke', async (req, res) => res.json(await review(req, ['approved'], 'revoked')));

export default router;
