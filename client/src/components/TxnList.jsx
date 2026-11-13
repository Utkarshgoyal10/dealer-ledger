import { ShoppingCart, Undo2, Wallet, Gift } from 'lucide-react';
import { cx } from './ui';
import { fmtDate, inr, istKey } from '../utils/format';

const META = {
  sale: { label: 'Sale', icon: ShoppingCart, bg: 'bg-blue-50', fg: 'text-blue-700' },
  return: { label: 'Sale return', icon: Undo2, bg: 'bg-amber-50', fg: 'text-amber-700' },
  payment: { label: 'Payment', icon: Wallet, bg: 'bg-emerald-50', fg: 'text-emerald-700' },
  scheme: { label: 'Scheme', icon: Gift, bg: 'bg-violet-50', fg: 'text-violet-700' },
};

/**
 * Simple list of entries, grouped by date (newest first as given).
 * Each row: icon · dealer name · "Payment · Cash" (· by …) · amount.
 * showBy = show who entered it (admin view). Tapping an editable row calls onSelect.
 */
export default function TxnList({ items, onSelect, showCustomer = true, showBy = false, canEdit = () => false }) {
  const groups = [];
  for (const t of items) {
    const k = istKey(t.date);
    if (!groups.length || groups[groups.length - 1][0] !== k) groups.push([k, []]);
    groups[groups.length - 1][1].push(t);
  }

  return (
    <div>
      {groups.map(([day, list]) => (
        <div key={day}>
          <div className="bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-600">{fmtDate(day)}</div>
          <ul className="divide-y divide-slate-100">
            {list.map((t) => {
              const editable = canEdit(t);
              const m = META[t.type];
              const plus = t.type === 'sale';
              const sub = [
                m.label + (t.type === 'payment' && t.paymentMode ? ` · ${t.paymentMode === 'cash' ? 'Cash' : 'Bank'}` : ''),
                showBy && t.createdBy?.name ? `by ${t.createdBy.name}` : null,
                t.note || null,
              ]
                .filter(Boolean)
                .join(' • ');
              return (
                <li
                  key={t._id}
                  onClick={() => editable && onSelect?.(t)}
                  className={cx('flex items-center gap-3 px-4 py-3', editable && 'cursor-pointer active:bg-slate-50 hover:bg-slate-50')}
                >
                  <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', m.bg)}>
                    <m.icon className={cx('h-4 w-4', m.fg)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-900">{showCustomer ? t.customer?.shopName : m.label}</div>
                    <div className="truncate text-xs text-slate-500">{sub}</div>
                  </div>
                  <div className={cx('shrink-0 text-right text-sm font-bold tabular', plus ? 'text-slate-900' : 'text-emerald-700')}>
                    {plus ? '+' : '−'}
                    {inr(t.amount)}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
