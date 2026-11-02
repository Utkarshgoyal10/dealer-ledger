import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { LoginRequest } from '../models/LoginRequest.js';
import { istDateKey, istDayEnd, parseDateKey } from '../utils/dates.js';

/** Admin: 7-day token. Worker: token valid only until midnight (IST) of the approved day. */
export function signToken(user, loginRequest) {
  const payload = { sub: String(user._id), role: user.role, tv: user.tokenVersion };
  if (user.role === 'admin') return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.ADMIN_JWT_EXPIRES_IN });
  const exp = Math.floor(istDayEnd(parseDateKey(loginRequest.dateKey)).getTime() / 1000);
  return jwt.sign({ ...payload, ls: String(loginRequest._id), exp }, env.JWT_SECRET);
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
