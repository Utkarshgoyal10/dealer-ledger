import bcrypt from 'bcryptjs';

// Passwords are NOT case-sensitive: "Ravi123", "ravi123" and "RAVI123" are the same password.
// They are stored lower-cased (hashed). Older passwords saved before this rule (case-sensitive)
// still work with their exact case and are converted on the next successful login.

const norm = (p) => String(p ?? '').toLowerCase();

export function hashPassword(password) {
  return bcrypt.hash(norm(password), 10);
}

/** Returns { ok, needsUpgrade }. needsUpgrade = matched an old case-sensitive hash; re-save it. */
export async function verifyPassword(password, hash) {
  if (!hash) return { ok: false, needsUpgrade: false };
  if (await bcrypt.compare(norm(password), hash)) return { ok: true, needsUpgrade: false };
  if (norm(password) !== String(password) && (await bcrypt.compare(String(password), hash))) {
    return { ok: true, needsUpgrade: true }; // old password typed with its original capitals
  }
  return { ok: false, needsUpgrade: false };
}
