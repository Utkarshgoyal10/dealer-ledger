// Free Web Push notifications (VAPID). Works with Chrome/Edge/Firefox on Android & desktop,
// and Safari on iPhone when the app is added to the home screen (iOS 16.4+).
import webpush from 'web-push';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { PushSubscription, Setting } from '../models/PushSubscription.js';

let ready = null;

/** Loads VAPID keys from .env, or creates them once and stores them in the database */
export function initPush() {
  if (ready) return ready;
  ready = (async () => {
    let publicKey = process.env.VAPID_PUBLIC_KEY;
    let privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
      let s = await Setting.findOne({ key: 'vapid' }).lean();
      if (!s) {
        try {
          s = await Setting.create({ key: 'vapid', value: webpush.generateVAPIDKeys() });
        } catch (e) {
          if (e.code !== 11000) throw e;
          s = await Setting.findOne({ key: 'vapid' }).lean(); // created at the same time elsewhere
        }
      }
      ({ publicKey, privateKey } = s.value);
    }
    const subject = process.env.VAPID_SUBJECT || env.RP_ORIGIN.find((o) => o.startsWith('https://')) || 'mailto:noreply@shopledger.app';
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return { publicKey };
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

/**
 * Sends a notification to every device of every active admin.
 * Never throws — a notification failure must not break the real action.
 */
export async function notifyAdmins({ title, body, url = '/', tag }) {
  try {
    await initPush();
    const admins = await User.find({ role: 'admin', active: true }).select('_id').lean();
    const subs = await PushSubscription.find({ user: { $in: admins.map((a) => a._id) } });
    const payload = JSON.stringify({ title, body, url, tag });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 60 * 60, urgency: 'high' });
          s.lastSentAt = new Date();
          await s.save();
        } catch (err) {
          // 404/410 = the browser unsubscribed or the app was removed: forget this device
          if (err.statusCode === 404 || err.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id });
          else console.error('Push failed:', err.statusCode || '', err.body || err.message);
        }
      })
    );
    return subs.length;
  } catch (err) {
    console.error('Push error:', err.message);
    return 0;
  }
}
