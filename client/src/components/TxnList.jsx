import { Chip, cx } from './ui';
import { fmtDate, inr, TYPE_META, txnDetail } from '../utils/format';

/** Mobile-friendly list of entries. Tapping an editable row calls onSelect. */
export default function TxnList({ items, onSelect, showCustomer = true, canEdit = () => false, renderActions }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((t) => {
        const editable = canEdit(t);
        const minus = t.type !== 'sale';
        return (
          <li
            key={t._id}
            onClick={() => editable && onSelect?.(t)}
            className={cx('flex items-start gap-3 px-4 py-3', editable && 'cursor-pointer hover:bg-slate-50')}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip className={TYPE_META[t.type].chip}>{TYPE_META[t.type].label}</Chip>
                {t.type === 'payment' && t.paymentMode && <Chip className={t.paymentMode === 'cash' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-sky-50 text-sky-700 ring-sky-200'}>{t.paymentMode === 'cash' ? 'Cash' : 'Bank'}</Chip>}
                {showCustomer && <span className="truncate text-sm font-semibold text-slate-900">{t.customer?.shopName}</span>}
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">
                {fmtDate(t.date)}
                {t.createdBy?.name ? ` • by ${t.createdBy.name}` : ''}
                {txnDetail(t) ? ` • ${txnDetail(t)}` : ''}
              </div>
              {renderActions && <div className="mt-2">{renderActions(t)}</div>}
            </div>
            <div className={cx('shrink-0 text-right text-sm font-bold tabular', t.type === 'sale' ? 'text-slate-900' : 'text-emerald-700')}>
              {minus ? '−' : ''}
              {inr(t.amount)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
