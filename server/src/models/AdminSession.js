import mongoose from 'mongoose';

/** One admin login on one device. Lets the admin see where they are logged in and log out any device. */
const adminSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    method: { type: String, enum: ['password', 'fingerprint'], default: 'password' },
    userAgent: { type: String, default: '' },
    device: { type: String, default: 'Unknown device' }, // e.g. "Chrome on Android"
    ip: { type: String, default: '' },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
  },
  { timestamps: true }
);

adminSessionSchema.index({ user: 1, revokedAt: 1, expiresAt: 1 });
// Old expired/ended sessions are cleaned up automatically 30 days after they expire
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const AdminSession = mongoose.model('AdminSession', adminSessionSchema);

/** "Chrome on Android", "Safari on iPhone", "Edge on Windows"… */
export function describeDevice(ua = '') {
  const os = /android/i.test(ua)
    ? 'Android'
    : /iphone/i.test(ua)
      ? 'iPhone'
      : /ipad/i.test(ua)
        ? 'iPad'
        : /windows/i.test(ua)
          ? 'Windows PC'
          : /mac os x|macintosh/i.test(ua)
            ? 'Mac'
            : /linux/i.test(ua)
              ? 'Linux'
              : 'Unknown device';
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /opr\/|opera/i.test(ua)
      ? 'Opera'
      : /samsungbrowser/i.test(ua)
        ? 'Samsung Internet'
        : /firefox|fxios/i.test(ua)
          ? 'Firefox'
          : /chrome|crios/i.test(ua)
            ? 'Chrome'
            : /safari/i.test(ua)
              ? 'Safari'
              : 'Browser';
  return `${browser} on ${os}`;
}
