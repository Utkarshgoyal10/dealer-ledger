// All business dates are in India Standard Time (UTC+05:30, no DST).
// A "business date" is stored as the instant of IST midnight for that day.
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function istDayStart(d = new Date()) {
  const shifted = new Date(d).getTime() + IST_OFFSET_MS;
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - IST_OFFSET_MS);
}

export function istDayEnd(d = new Date()) {
  return new Date(istDayStart(d).getTime() + DAY_MS - 1);
}

export function addDays(d, n) {
  return new Date(new Date(d).getTime() + n * DAY_MS);
}

/** 'YYYY-MM-DD' for the IST calendar day of `d` */
export function istDateKey(d = new Date()) {
  return new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' -> Date at IST midnight */
export function parseDateKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key))) throw Object.assign(new Error('Invalid date, use YYYY-MM-DD'), { status: 400 });
  const d = new Date(`${key}T00:00:00+05:30`);
  if (Number.isNaN(d.getTime())) throw Object.assign(new Error('Invalid date'), { status: 400 });
  return d;
}

export function daysBetween(a, b) {
  return Math.floor((istDayStart(b).getTime() - istDayStart(a).getTime()) / DAY_MS);
}

export function isSameIstDay(a, b) {
  return istDateKey(a) === istDateKey(b);
}
