import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check, ArrowLeft } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { cx } from './ui';

const PHONE = '(max-width: 767px)';

function useIsPhone() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const fn = () => setPhone(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return phone;
}

/**
 * Searchable dealer picker: type part of the shop name or route, tap a match.
 * value = dealer id ('' = none). `placeholder` is shown when nothing is chosen.
 * PC: dropdown under the box. Phone: full-screen search, so the keyboard never hides the list.
 */
export default function CustomerPicker({ value, onChange, disabled, placeholder = 'Search dealer by name or route…' }) {
  const { data: customers, loading } = useApi('/customers');
  const isPhone = useIsPhone();
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

  const close = () => {
    setQ('');
    setOpen(false);
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
      close();
    }
  };

  const list = (cls) => (
    <ul ref={listRef} className={cls}>
      {loading && !customers ? (
        <li className="px-4 py-3 text-sm text-slate-500">Loading…</li>
      ) : matches.length === 0 ? (
        <li className="px-4 py-3 text-sm text-slate-500">No dealer matches "{q}"</li>
      ) : (
        matches.map((c, i) => (
          <li key={c._id}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()} // keep focus so blur doesn't close first
              onClick={() => choose(c)}
              className={cx(
                'flex w-full items-center justify-between gap-2 px-4 text-left text-sm',
                isPhone ? 'border-b border-slate-100 py-3.5' : 'py-2.5',
                i === active && !isPhone ? 'bg-indigo-50' : 'hover:bg-slate-50 active:bg-slate-100'
              )}
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
  );

  if (disabled) {
    return <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200">{label(selected) || '—'}</div>;
  }

  // ---------- Phone: a tap opens a full-screen search ----------
  if (isPhone) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cx(
            'relative block w-full rounded-lg bg-white py-2.5 pr-9 pl-9 text-left text-sm ring-1',
            selected ? 'font-semibold text-slate-900 ring-indigo-300' : 'text-slate-400 ring-slate-300'
          )}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <span className="block truncate">{selected ? label(selected) : placeholder}</span>
          {selected && (
            <span
              role="button"
              aria-label="Clear"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400"
            >
              <X className="h-4 w-4" />
            </span>
          )}
        </button>

        {open &&
          createPortal(
            <div className="fixed inset-0 z-[70] flex h-[100dvh] flex-col bg-white pt-safe">
              <div className="flex items-center gap-2 border-b border-slate-200 px-2 py-2">
                <button type="button" onClick={close} className="rounded-full p-2 text-slate-600 active:bg-slate-100" aria-label="Back">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={inputRef}
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Type dealer name or route…"
                    autoComplete="off"
                    enterKeyHint="search"
                    className="block w-full rounded-full border-0 bg-slate-100 py-2.5 pr-9 pl-9 text-base text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  {q && (
                    <button type="button" onClick={() => setQ('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-slate-400" aria-label="Clear search">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="px-4 py-1.5 text-xs text-slate-500">
                {customers ? `${matches.length} dealer${matches.length === 1 ? '' : 's'}` : ''}
              </div>
              {list('flex-1 overflow-y-auto overscroll-contain pb-safe')}
            </div>,
            document.body
          )}
      </>
    );
  }

  // ---------- PC: dropdown under the box ----------
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
      {open && list('mt-1 max-h-56 overflow-y-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200')}
    </div>
  );
}
