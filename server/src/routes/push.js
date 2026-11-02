import { Router } from 'express';
import { z } from 'zod';
import { adminOnly } from '../middleware/auth.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { initPush, notifyAdmins } from '../services/push.js';

// Admin turns notifications on/off for each of their devices
const router = Router();
router.use(adminOnly);

router.get('/public-key', async (req, res) => {
  const { publicKey } = await initPush();
  res.json({ publicKey });
});

router.get('/status', async (req, res) => {
  const endpoint = String(req.query.endpoint || '');
  const subscribed = endpoint ? !!(await PushSubscription.exists({ endpoint, user: req.user._id })) : false;
  const devices = await PushSubscription.countDocuments({ user: req.user._id });
  res.json({ subscribed, devices });
});

const subSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }),
});

router.post('/subscribe', async (req, res) => {
  const { subscription } = subSchema.parse(req.body);
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    { user: req.user._id, endpoint: subscription.endpoint, keys: subscription.keys, userAgent: String(req.headers['user-agent'] || '').slice(0, 200) },
    { upsert: true, new: true }
  );
  res.status(201).json({ ok: true });
});

router.post('/unsubscribe', async (req, res) => {
  const { endpoint } = z.object({ endpoint: z.string() }).parse(req.body);
  await PushSubscription.deleteOne({ endpoint, user: req.user._id });
  res.json({ ok: true });
});

router.post('/test', async (req, res) => {
  const sent = await notifyAdmins({ title: 'Dealer Ledger', body: 'Notifications are working ✅', url: '/logins', tag: 'test' });
  res.json({ sent });
});

export default router;
