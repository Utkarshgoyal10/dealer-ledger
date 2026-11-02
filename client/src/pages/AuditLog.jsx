import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { Card, Chip, Chips, Empty, ErrorBox, PageHeader, Pager, Spinner } from '../components/ui';
import { fmtDateTime } from '../utils/format';

const SKIP = new Set(['_id', '__v', 'createdAt', 'updatedAt', 'createdBy']);

function changes(before, after) {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out = [];
  for (const k of keys) {
    if (SKIP.has(k)) continue;
    const a = JSON.stringify(before[k]);
    const b = JSON.stringify(after[k]);
    if (a !== b) out.push({ k, a, b });
  }
  return out;
}

const ACTION_CHIP = {
  create: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  update: 'bg-blue-50 text-blue-700 ring-blue-200',
  delete: 'bg-rose-50 text-rose-700 ring-rose-200',
  approve: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  reject: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export default function AuditLog() {
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error } = useApi('/audit', { entity: entity || undefined, page });
  const [open, setOpen] = useState(null);

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Who created, edited or deleted what, and when" />
      <div className="mb-3">
        <Chips
          value={entity}
          scroll
          onChange={(v) => {
            setEntity(v);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Everything' },
            { value: 'Transaction', label: 'Entries' },
            { value: 'Customer', label: 'Dealers' },
            { value: 'User', label: 'Users & logins' },
            { value: 'LoginRequest', label: 'Login approvals' },
            { value: 'AccessRequest', label: 'Data requests' },
            { value: 'CashClosing', label: 'Cash closings' },
          ]}
        />
      </div>
      <ErrorBox>{error}</ErrorBox>
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : !data?.items.length ? (
          <Empty>No activity</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.items.map((l) => {
              const diff = changes(l.before, l.after);
              const expandable = diff.length > 0;
              const isOpen = open === l._id;
              return (
                <li key={l._id} className="px-4 py-2.5">
                  <button className="flex w-full items-start gap-2 text-left" onClick={() => expandable && setOpen(isOpen ? null : l._id)}>
                    {expandable ? isOpen ? <ChevronDown className="mt-0.5 h-4 w-4 text-slate-400" /> : <ChevronRight className="mt-0.5 h-4 w-4 text-slate-400" /> : <span className="w-4" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Chip className={ACTION_CHIP[l.action]}>{l.action}</Chip>
                        <span className="truncate">{l.summary}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {l.user?.name || 'System'} • {fmtDateTime(l.createdAt)}
                      </div>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="mt-2 ml-6 overflow-x-auto rounded-lg bg-slate-50 p-2 text-xs">
                      <table>
                        <tbody>
                          {diff.map((d) => (
                            <tr key={d.k}>
                              <td className="pr-3 font-semibold text-slate-600">{d.k}</td>
                              <td className="pr-3 text-rose-700 line-through">{d.a ?? '—'}</td>
                              <td className="text-emerald-700">{d.b ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}
    </div>
  );
}
