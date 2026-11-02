const IST = 'Asia/Kolkata';

/** What users see for each role (the saved role value stays 'worker') */
export const ROLE_LABEL = { admin: 'Admin', worker: 'Salesman' };

export function inr(n, { sign = false } = {}) {
  const v = Number(n || 0);
  const s = Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const prefix = v < 0 ? '-' : sign && v > 0 ? '+' : '';
  return `${prefix}₹${s}`;
}

/** YYYY-MM-DD for the India calendar day of `d` */
export function istKey(d = new Date()) {
  return new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 10);
}
export const todayKey = () => istKey(new Date());
export const daysAgoKey = (n) => istKey(new Date(Date.now() - n * 86400000));
export const monthStartKey = () => todayKey().slice(0, 8) + '01';

export function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: IST });
}
export function fmtDateTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: IST });
}

export const TYPE_META = {
  sale: { label: 'Sale', chip: 'bg-blue-50 text-blue-700 ring-blue-200' },
  return: { label: 'Sale return', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  payment: { label: 'Payment', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  scheme: { label: 'Scheme', chip: 'bg-violet-50 text-violet-700 ring-violet-200' },
};

export const STATUS_CHIP = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
  revoked: 'bg-slate-100 text-slate-600 ring-slate-200',
  expired: 'bg-slate-100 text-slate-600 ring-slate-200',
  submitted: 'bg-amber-50 text-amber-700 ring-amber-200',
  verified: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  disputed: 'bg-rose-50 text-rose-700 ring-rose-200',
};

/** Same rule as the server: worker can change own entry on the same day only */
export function canEditTxn(user, t) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const by = t.createdBy?._id ?? t.createdBy;
  return String(by) === String(user._id) && istKey(t.createdAt) === todayKey();
}

export function txnDetail(t) {
  if (t.type !== 'payment') return t.note || '';
  if (t.paymentMode === 'cash') return ['Cash', t.note].filter(Boolean).join(' • ');
  return ['Bank', t.note].filter(Boolean).join(' • ');
}
