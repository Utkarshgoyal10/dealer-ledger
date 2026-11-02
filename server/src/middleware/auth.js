import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { LoginRequest } from '../models/LoginRequest.js';
import { AdminSession, describeDevice } from '../models/AdminSession.js';
import { istDateKey, istDayEnd, parseDateKey } from '../utils/dates.js';

const ADMIN_SESSION_DAYS = 7;

/** Worker token: valid only until midnight (IST) of the approved day. */
export function signToken(user, loginRequest) {
  const payload = { sub: String(user._id), role: user.role, tv: user.tokenVersion };
  const exp = Math.floor(istDayEnd(parseDateKey(loginRequest.dateKey)).getTime() / 1000);
  return jwt.sign({ ...payload, ls: String(loginRequest._id), exp }, env.JWT_SECRET);
}

/** Admin token: 7 days, tied to a device record so the admin can see and log out each device. */
export async function issueAdminToken(req, user, method = 'password') {
  const ua = String(req.headers['user-agent'] || '').slice(0, 300);
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_DAYS * 24 * 60 * 60 * 1000);
  const session = await AdminSession.create({ user: user._id, method, userAgent: ua, device: describeDevice(ua), ip: req.ip, expiresAt });
  const payload = { sub: String(user._id), role: user.role, tv: user.tokenVersion, sid: String(session._id) };
  return jwt.sign({ ...payload, exp: Math.floor(expiresAt.getTime() / 1000) }, env.JWT_SECRET);
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please log in' });

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Session expired, please log in again' });
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.active || user.tokenVersion !== payload.tv) {
    return res.status(401).json({ message: 'Session is no longer valid, please log in again' });
  }

  if (user.role === 'worker') {
    // Worker session must be today's approved login, and not revoked by admin
    const ls = payload.ls && (await LoginRequest.findById(payload.ls).lean());
    if (!ls || ls.status !== 'approved' || String(ls.worker) !== String(user._id) || ls.dateKey !== istDateKey()) {
      return res.status(401).json({ message: 'Login approval has ended. Please log in again.' });
    }
    req.loginRequest = ls;
  } else {
    // Admin: this device's login must still be active (not logged out from another device)
    const session = payload.sid && (await AdminSession.findById(payload.sid));
    if (!session || session.revokedAt || String(session.user) !== String(user._id) || session.expiresAt < new Date()) {
      return res.status(401).json({ message: 'This device was logged out. Please log in again.' });
    }
    // Remember when this device was last used (at most once a minute)
    if (Date.now() - session.lastSeenAt.getTime() > 60 * 1000) {
      session.lastSeenAt = new Date();
      session.save().catch(() => {});
    }
    req.adminSession = session;
  }
  req.user = user;
  next();
}

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ message: 'You are not allowed to do this' });
    next();
  };

export const adminOnly = requireRole('admin');
