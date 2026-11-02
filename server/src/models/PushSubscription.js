import mongoose from 'mongoose';

/** One browser/phone that agreed to receive notifications for an admin */
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: '' },
    lastSentAt: Date,
  },
  { timestamps: true }
);

export const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

/** Small key/value store for app settings (e.g. auto-generated push keys) */
const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed,
});

export const Setting = mongoose.model('Setting', settingSchema);
