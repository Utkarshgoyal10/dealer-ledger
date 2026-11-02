import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Check } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { cx } from './ui';

/**
 * Searchable dealer picker: type part of the shop name or route, tap a match.
 * value = dealer id ('' = none). `placeholder` is shown when nothing is chosen.
 */
export default function CustomerPicker({ value, onChange, disabled, placeholder = 'Search dealer by name or route…' }) {
  const { data: customers, loading } = useApi('/customers');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = useMemo(() => (customers || []).find((c) => c._id === value), [customers, value]);
  const label = (c) => (c ? `${c.shopName}${c.route ? ` — ${c.route}` : ''}` : '');

  const matches = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const all = customers || [];
    if (!words.length) return all;
    return all.filter((c) => {
      const text = `${c.shopName} ${c.route}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [customers, q]);

  useEffect(() => setActive(0), [q, open]);

  // Keep the highlighted item visible when using arrow keys
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (c) => {
    onChange(c._id);
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const clear = () => {
    onChange('');
    setQ('');
    setOpen(true);
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault(); // don't submit the form
      if (matches[active]) choose(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  if (disabled) {
    return <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200">{label(selected) || '—'}</div>;
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={open ? q : label(selected)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={open && selected ? label(selected) : placeholder}
          autoComplete="off"
          className={cx(
            'block w-full rounded-lg border-0 bg-white py-2.5 pr-9 pl-9 text-sm text-slate-900 ring-1 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none',
            selected && !open ? 'font-semibold ring-indigo-300' : 'ring-slate-300'
          )}
        />
        {(selected || q) && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <ul ref={listRef} className="mt-1 max-h-56 overflow-y-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200">
          {loading && !customers ? (
            <li className="px-3 py-2 text-sm text-slate-500">Loading…</li>
          ) : matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No dealer matches "{q}"</li>
          ) : (
            matches.map((c, i) => (
              <li key={c._id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // keep focus so blur doesn't close first
                  onClick={() => choose(c)}
                  className={cx('flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm', i === active ? 'bg-indigo-50' : 'hover:bg-slate-50')}
                >
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-slate-900">{c.shopName}</span>
                    {c.route && <span className="text-slate-500"> — {c.route}</span>}
                  </span>
                  {c._id === value && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
