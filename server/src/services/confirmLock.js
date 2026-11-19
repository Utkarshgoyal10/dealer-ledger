import { Confirmation } from '../models/Confirmation.js';
import { forbidden } from '../utils/http.js';
import { istDayStart, istDayEnd, istDateKey } from '../utils/dates.js';

/** Latest signed (not rejected) confirmation for a dealer → { at, day } or null */
export async function getLock(customerId) {
  const c = await Confirmation.findOne({ customer: customerId, status: 'confirmed', rejectedAt: null }, { createdAt: 1 }).sort({ createdAt: -1 }).lean();
  return c ? { at: c.createdAt, day: istDayStart(c.createdAt), id: c._id } : null;
}

/**
 * Is an entry inside the period the dealer signed for?
 *  - dated before the signing day → locked
 *  - dated on the signing day and already existing before the signature → locked
 *  - new entries on/after the signing day → allowed (business carries on)
 */
export function inLockedPeriod(lock, { date, createdAt }) {
  if (!lock) return false;
  if (date < lock.day) return true;
  if (date <= istDayEnd(lock.day) && createdAt && createdAt <= lock.at) return true;
  return false;
}

export async function assertNotLocked(customerId, entry) {
  const lock = await getLock(customerId);
  if (inLockedPeriod(lock, entry)) {
    throw forbidden(
      `Dealer has signed the balance on ${istDateKey(lock.at).split('-').reverse().join('-')}. Entries up to that signature are locked. ` +
        'To change them, admin must first reject that confirmation.'
    );
  }
}
