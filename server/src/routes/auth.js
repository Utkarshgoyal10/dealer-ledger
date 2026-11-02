import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { LoginRequest } from '../models/LoginRequest.js';
import { AuthChallenge, Passkey } from '../models/Passkey.js';
import { adminOnly, requireAuth, signToken } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/http.js';
import { audit } from '../services/audit.js';
import { istDateKey } from '../utils/dates.js';
import { notifyAdmins } from '../services/push.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, try again in 15 minutes' },
});

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---------------------------------------------------------------------------
// Username + password
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ username }).select('+passwordHash');
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return res.status(401).json({ message: 'Wrong username or password' });
  if (!user.active) return res.status(403).json({ message: 'Your account is deactivated. Contact admin.' });
  req.user = user;

  if (user.role === 'admin') {
    user.lastLoginAt = new Date();
    await user.save();
    await audit(req, { action: 'login', entity: 'User', entityId: user._id, summary: `${user.username} logged in` });
    return res.json({ token: signToken(user), user: user.toSafeJSON() });
  }

  // Worker: create a login request and wait for admin approval
  const pollKey = crypto.randomBytes(24).toString('base64url');
  const dateKey = istDateKey();
  // Older pending requests from this worker are replaced by the new one
  await LoginRequest.updateMany({ worker: user._id, status: 'pending' }, { status: 'cancelled' });
  const lr = await LoginRequest.create({
    worker: user._id,
    dateKey,
    pollKeyHash: sha256(pollKey),
    device: String(req.headers['user-agent'] || '').slice(0, 200),
    ip: req.ip,
  });
  await audit(req, { action: 'login-request', entity: 'LoginRequest', entityId: lr._id, summary: `${user.username} asked to log in` });
  // Phone notification to admin (not awaited, so the worker gets an instant reply)
  notifyAdmins({ title: 'Login request', body: `${user.name} wants to log in. Tap to approve.`, url: '/logins', tag: `login-${user._id}` });
  res.status(202).json({ pending: true, requestId: lr._id, pollKey, message: 'Waiting for admin to approve your login' });
});

/** The waiting worker device polls this. Returns the token once (after approval). */
router.post('/login-status', async (req, res) => {
  const { requestId, pollKey } = z.object({ requestId: z.string(), pollKey: z.string() }).parse(req.body);
  const lr = await LoginRequest.findById(requestId).select('+pollKeyHash');
  if (!lr || lr.pollKeyHash !== sha256(pollKey)) throw notFound('Login request not found');
  if (lr.dateKey !== istDateKey()) return res.json({ status: 'expired', message: 'This request was for an earlier day. Log in again.' });
  if (lr.status === 'pending') return res.json({ status: 'pending' });
  if (lr.status !== 'approved') return res.json({ status: lr.status, message: lr.status === 'rejected' ? 'Admin rejected your login' : 'Login request closed' });
  if (lr.tokenIssued) return res.json({ status: 'used', message: 'Already logged in with this request. Log in again.' });

  const user = await User.findById(lr.worker);
  if (!user?.active) return res.json({ status: 'rejected', message: 'Account deactivated' });
  lr.tokenIssued = true;
  await lr.save();
  user.lastLoginAt = new Date();
  await user.save();
  res.json({ status: 'approved', token: signToken(user, lr), user: user.toSafeJSON() });
});

router.post('/login-cancel', async (req, res) => {
  const { requestId, pollKey } = z.object({ requestId: z.string(), pollKey: z.string() }).parse(req.body);
  const lr = await LoginRequest.findById(requestId).select('+pollKeyHash');
  if (lr && lr.pollKeyHash === sha256(pollKey) && lr.status === 'pending') {
    lr.status = 'cancelled';
    await lr.save();
  }
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

router.post('/logout', requireAuth, async (req, res) => {
  // Worker logout ends today's approved session on the server too
  if (req.loginRequest) await LoginRequest.updateOne({ _id: req.loginRequest._id }, { status: 'revoked' });
  res.json({ ok: true });
});

const changeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

router.post('/change-password', requireAuth, adminOnly, async (req, res) => {
  const { currentPassword, newPassword } = changeSchema.parse(req.body);
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw badRequest('Current password is wrong');
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.tokenVersion += 1; // log out other devices
  await user.save();
  await audit(req, { action: 'change-password', entity: 'User', entityId: user._id, summary: 'Changed own password' });
  res.json({ token: signToken(user), user: user.toSafeJSON() });
});

// ---------------------------------------------------------------------------
// Fingerprint login for admin (WebAuthn / passkeys — free, built into phones & browsers)
// ---------------------------------------------------------------------------

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

router.get('/passkeys', requireAuth, adminOnly, async (req, res) => {
  const keys = await Passkey.find({ user: req.user._id }).select('deviceName createdAt lastUsedAt').sort({ createdAt: -1 }).lean();
  res.json(keys);
});

router.post('/passkeys/register-options', requireAuth, adminOnly, async (req, res) => {
  const existing = await Passkey.find({ user: req.user._id }).lean();
  const options = await generateRegistrationOptions({
    rpName: env.RP_NAME,
    rpID: env.RP_ID,
    userName: req.user.username,
    userDisplayName: req.user.name,
    userID: new TextEncoder().encode(String(req.user._id)),
    attestationType: 'none',
    excludeCredentials: existing.map((k) => ({ id: k.credId, transports: k.transports })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required', authenticatorAttachment: 'platform' },
  });
  await AuthChallenge.create({ challenge: options.challenge, purpose: 'register', user: req.user._id, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) });
  res.json(options);
});

router.post('/passkeys/register', requireAuth, adminOnly, async (req, res) => {
  const { response, deviceName } = z.object({ response: z.any(), deviceName: z.string().trim().max(60).optional() }).parse(req.body);
  const ch = await AuthChallenge.findOneAndDelete({ user: req.user._id, purpose: 'register', expiresAt: { $gt: new Date() } }, { sort: { expiresAt: -1 } });
  if (!ch) throw badRequest('Fingerprint setup timed out. Try again.');

  let result;
  try {
    result = await verifyRegistrationResponse({
      response,
      expectedChallenge: ch.challenge,
      expectedOrigin: env.RP_ORIGIN,
      expectedRPID: env.RP_ID,
      requireUserVerification: true,
    });
  } catch (e) {
    throw badRequest(`Fingerprint setup failed: ${e.message}`);
  }
  if (!result.verified) throw badRequest('Fingerprint setup failed');

  const { credential } = result.registrationInfo;
  await Passkey.create({
    user: req.user._id,
    credId: credential.id,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports || [],
    deviceName: deviceName || 'This device',
  });
  await audit(req, { action: 'create', entity: 'Passkey', summary: `Fingerprint login added (${deviceName || 'device'})` });
  res.status(201).json({ ok: true });
});

router.delete('/passkeys/:id', requireAuth, adminOnly, async (req, res) => {
  const r = await Passkey.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!r.deletedCount) throw notFound('Not found');
  await audit(req, { action: 'delete', entity: 'Passkey', summary: 'Fingerprint login removed' });
  res.json({ ok: true });
});

router.post('/passkey-login/options', loginLimiter, async (req, res) => {
  // No username needed: the device offers the admin's saved fingerprint credential
  const options = await generateAuthenticationOptions({ rpID: env.RP_ID, userVerification: 'required', allowCredentials: [] });
  const ch = await AuthChallenge.create({ challenge: options.challenge, purpose: 'login', expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) });
  res.json({ options, challengeId: ch._id });
});

router.post('/passkey-login/verify', loginLimiter, async (req, res) => {
  const { challengeId, response } = z.object({ challengeId: z.string(), response: z.any() }).parse(req.body);
  const ch = await AuthChallenge.findOneAndDelete({ _id: challengeId, purpose: 'login', expiresAt: { $gt: new Date() } });
  if (!ch) throw badRequest('Fingerprint login timed out. Try again.');
  const key = await Passkey.findOne({ credId: response?.id });
  if (!key) return res.status(401).json({ message: 'This fingerprint is not registered. Log in with password and set it up in Profile.' });

  let result;
  try {
    result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: ch.challenge,
      expectedOrigin: env.RP_ORIGIN,
      expectedRPID: env.RP_ID,
      credential: { id: key.credId, publicKey: new Uint8Array(key.publicKey), counter: key.counter, transports: key.transports },
      requireUserVerification: true,
    });
  } catch (e) {
    return res.status(401).json({ message: `Fingerprint login failed: ${e.message}` });
  }
  if (!result.verified) return res.status(401).json({ message: 'Fingerprint login failed' });

  const user = await User.findById(key.user);
  if (!user || !user.active || user.role !== 'admin') return res.status(403).json({ message: 'Account not allowed' });
  key.counter = result.authenticationInfo.newCounter;
  key.lastUsedAt = new Date();
  await key.save();
  user.lastLoginAt = new Date();
  await user.save();
  req.user = user;
  await audit(req, { action: 'login', entity: 'User', entityId: user._id, summary: `${user.username} logged in with fingerprint` });
  res.json({ token: signToken(user), user: user.toSafeJSON() });
});

export default router;
