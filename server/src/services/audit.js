import { AuditLog } from '../models/AuditLog.js';

function clean(doc) {
  if (!doc) return undefined;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
}

/** Writes an audit entry. Never throws, so a logging failure cannot break the real action. */
export async function audit(req, { action, entity, entityId, summary = '', before, after }) {
  try {
    await AuditLog.create({
      user: req.user?._id,
      action,
      entity,
      entityId,
      summary,
      before: clean(before),
      after: clean(after),
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}
