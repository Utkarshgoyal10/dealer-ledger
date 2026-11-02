import { useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { inr } from '../utils/format';

const cx = (...c) => c.filter(Boolean).join(' ');

const BTN = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-indigo-300',
  secondary: 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

export function Button({ variant = 'primary', size = 'md', loading, className, children, ...props }) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
        BTN[variant],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

const inputCls =
  'block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50';

export function Field({ label, hint, children, className, as }) {
  const Tag = as || 'label'; // use as="div" when the field contains buttons/chips
  return (
    <Tag className={cx('block', className)}>
      {label && <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </Tag>
  );
}

export const Input = ({ className, ...p }) => <input className={cx(inputCls, className)} {...p} />;
export const Textarea = ({ className, ...p }) => <textarea rows={2} className={cx(inputCls, className)} {...p} />;
export const Select = ({ className, children, ...p }) => (
  <select className={cx(inputCls, 'pr-8', className)} {...p}>
    {children}
  </select>
);

export function Card({ className, children, ...p }) {
  return (
    <div className={cx('rounded-xl bg-white ring-1 ring-slate-200', className)} {...p}>
      {children}
    </div>
  );
}

export function Chip({ className, children }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', className || 'bg-slate-100 text-slate-700 ring-slate-200')}>
      {children}
    </span>
  );
}

export function Spinner({ className }) {
  return (
    <div className={cx('flex justify-center py-10 text-slate-400', className)}>
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

export function Empty({ children = 'Nothing here yet' }) {
  return <div className="py-10 text-center text-sm text-slate-500">{children}</div>;
}

export function ErrorBox({ children }) {
  if (!children) return null;
  return <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{children}</div>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, tone = 'slate', sub }) {
  const tones = {
    slate: 'text-slate-900',
    blue: 'text-blue-700',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    violet: 'text-violet-700',
    rose: 'text-rose-700',
  };
  return (
    <Card className="p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cx('mt-1 text-lg font-bold tabular', tones[tone])}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

/** Balance: positive = customer owes us (red), negative = advance (green) */
export function Balance({ value, className }) {
  const v = Number(value || 0);
  return (
    <span className={cx('tabular font-bold', v > 0 ? 'text-rose-700' : v < 0 ? 'text-emerald-700' : 'text-slate-500', className)}>
      {v < 0 ? `${inr(-v)} adv` : inr(v)}
    </span>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={cx('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-4 pt-3 pb-safe [--pb:0.75rem]">{footer}</div>}
      </div>
    </div>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="grid gap-1 rounded-lg bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-md px-2 py-2 text-xs font-semibold transition-colors',
            value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-center gap-3 text-sm">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="text-slate-600">
        Page {page} of {pages}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}

export { cx };

/**
 * Tappable choice buttons — replaces native <select> dropdowns (which look broken on phones).
 * options: [{ value, label }]. `scroll` = one sideways-scrolling row instead of wrapping.
 */
export function Chips({ value, onChange, options, scroll = false, size = 'md' }) {
  return (
    <div className={cx('flex gap-2', scroll ? 'no-scrollbar -mx-4 overflow-x-auto px-4 py-1' : 'flex-wrap')}>
      {options.map((o) => {
        const on = (value ?? '') === (o.value ?? '');
        return (
          <button
            key={o.value || '__all'}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx(
              'shrink-0 rounded-full whitespace-nowrap ring-1 transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              on ? 'bg-indigo-600 font-bold text-white ring-indigo-600' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
