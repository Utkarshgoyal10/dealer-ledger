import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { api, errMsg } from '../api';
import { useApi } from '../hooks/useApi';
import { Button, Input, cx } from './ui';

/**
 * Route picker as tappable buttons (works well on phones, unlike a native dropdown).
 * allowAll  -> first button is "All routes" (value '')
 * allowAdd  -> last button "+ New route" saves a new route to the shared list
 * scroll    -> one horizontally scrolling row instead of wrapping (for filters)
 */
export default function RouteSelect({ value, onChange, allowAll, allowAdd = true, scroll = false }) {
  const routes = useApi('/customers/routes');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (name.trim().length < 2) return;
    setSaving(true);
    try {
      const { data } = await api.post('/customers/routes', { name: name.trim() });
      if (data.existed) toast(`"${data.name}" is already in the list`);
      else toast.success(`Route "${data.name}" added`);
      routes.reload();
      onChange(data.name);
      setAdding(false);
      setName('');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const chip = (label, val, key) => {
    const on = (value || '') === val;
    return (
      <button
        key={key ?? val}
        type="button"
        onClick={() => onChange(val)}
        className={cx(
          'shrink-0 rounded-full px-3 py-1.5 text-sm whitespace-nowrap ring-1 transition-colors',
          on ? 'bg-indigo-600 font-semibold text-white ring-indigo-600' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
        )}
      >
        {label}
      </button>
    );
  };

  return (
    <div>
      <div className={cx('flex gap-2', scroll ? 'no-scrollbar -mx-4 overflow-x-auto px-4 py-1.5' : 'flex-wrap')}>
        {allowAll && chip('All routes', '', '__all')}
        {(routes.data || []).map((r) => chip(r, r))}
        {allowAdd && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm text-indigo-700 ring-1 ring-indigo-200 ring-dashed hover:bg-indigo-50"
          >
            <Plus className="h-3.5 w-3.5" /> New route
          </button>
        )}
      </div>
      {adding && (
        <div className="mt-2 flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New route name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                save();
              }
            }}
          />
          <Button type="button" onClick={save} loading={saving}>
            Add
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
