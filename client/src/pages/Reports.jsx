import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, ArrowUpDown, FileSpreadsheet, FileText } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { download } from '../api';
import { Button, Card, Chips, Empty, ErrorBox, Field, Input, PageHeader, Spinner, cx } from '../components/ui';
import RouteSelect from '../components/RouteSelect';
import { fmtDate, inr, monthStartKey, todayKey } from '../utils/format';

const TABS = [
  { value: 'summary', label: 'Sales summary' },
  { value: 'workers', label: 'Salesman-wise' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'collections', label: 'Cash vs bank' },
  { value: 'schemes', label: 'Scheme' },
  { value: 'returns', label: 'Returns' },
];

/** Show 2026-11-03 as 03 Nov 2026 and 2026-11 as Nov 2026 */
function niceText(v) {
  if (typeof v !== 'string') return v ?? '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtDate(v);
  if (/^\d{4}-\d{2}$/.test(v)) return new Date(`${v}-01`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  return v;
}
const show = (col, v) => (col.type === 'money' ? inr(v) : niceText(v));

export default function Reports() {
  const [sp, setSp] = useSearchParams();
  const tab = TABS.some((t) => t.value === sp.get('tab')) ? sp.get('tab') : 'summary';
  const [f, setF] = useState({ from: monthStartKey(), to: todayKey(), asOf: todayKey(), group: 'day', worker: '', route: '', nonZero: 'true' });
  const [busy, setBusy] = useState('');
  const workers = useApi('/users', { role: 'worker' });

  const params =
    tab === 'outstanding'
      ? { asOf: f.asOf, route: f.route || undefined, nonZero: f.nonZero }
      : { from: f.from, to: f.to, worker: f.worker || undefined, ...(tab === 'summary' ? { group: f.group } : {}) };
  const { data: report, loading, error } = useApi(`/reports/${tab}`, params);

  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const workerOptions = [{ value: '', label: 'All salesmen' }, ...(workers.data || []).map((w) => ({ value: w._id, label: w.name }))];

  const exportAs = async (format) => {
    setBusy(format);
    try {
      await download(`/reports/${tab}`, { ...params, format }, `${tab}.${format}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const [first, ...rest] = report?.columns || [];

  // Sorting: click a column heading (PC) or a "Sort by" button (phone). asc -> desc -> original order
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  useEffect(() => setSort({ key: null, dir: 'asc' }), [tab]);
  const toggleSort = (key) =>
    setSort((s) => (s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : { key: null, dir: 'asc' }));
  const rows = useMemo(() => {
    const list = report?.rows || [];
    if (!sort.key) return list;
    const col = report.columns.find((c) => c.key === sort.key);
    const num = col && col.type !== 'text';
    return [...list].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      const cmp = num ? (Number(x) || 0) - (Number(y) || 0) : String(x ?? '').localeCompare(String(y ?? ''), 'en', { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [report, sort]);
  const SortIcon = ({ k }) =>
    sort.key !== k ? <ArrowUpDown className="h-3 w-3 opacity-40" /> : sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;

  return (
    <div>
      <PageHeader
        title="Reports"
        actions={
          <>
            <Button size="sm" variant="secondary" loading={busy === 'xlsx'} onClick={() => exportAs('xlsx')}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button size="sm" variant="secondary" loading={busy === 'pdf'} onClick={() => exportAs('pdf')}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </>
        }
      />

      <div className="mb-3">
        <Chips value={tab} onChange={(v) => setSp({ tab: v })} options={TABS} scroll />
      </div>

      <Card className="mb-3 space-y-3 p-3">
        {tab === 'outstanding' ? (
          <>
            <Field label="As of date">
              <Input type="date" value={f.asOf} onChange={set('asOf')} />
            </Field>
            <Field as="div" label="Route">
              <RouteSelect value={f.route} onChange={set('route')} allowAll allowAdd={false} scroll />
            </Field>
            <Field as="div" label="Show">
              <Chips
                value={f.nonZero}
                onChange={set('nonZero')}
                options={[
                  { value: 'true', label: 'Only with balance' },
                  { value: 'false', label: 'All dealers' },
                ]}
              />
            </Field>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="From">
                <Input type="date" value={f.from} onChange={set('from')} />
              </Field>
              <Field label="To">
                <Input type="date" value={f.to} onChange={set('to')} />
              </Field>
            </div>
            {tab === 'summary' && (
              <Field as="div" label="Group by">
                <Chips
                  value={f.group}
                  onChange={set('group')}
                  options={[
                    { value: 'day', label: 'Day' },
                    { value: 'month', label: 'Month' },
                  ]}
                />
              </Field>
            )}
            {tab !== 'workers' && (
              <Field as="div" label="Salesman">
                <Chips value={f.worker} onChange={set('worker')} options={workerOptions} scroll />
              </Field>
            )}
          </>
        )}
      </Card>

      <ErrorBox>{error}</ErrorBox>
      {loading && !report ? (
        <Spinner />
      ) : !report ? null : (
        <div className={cx(loading && 'opacity-60')}>
          <div className="mb-2 px-1">
            <div className="text-sm font-bold">{report.title}</div>
            <div className="text-xs text-slate-500">{(report.subtitle || '').replace(/\d{4}-\d{2}-\d{2}/g, (d) => fmtDate(d))}</div>
          </div>

          {report.rows.length === 0 ? (
            <Card>
              <Empty>No data for this period</Empty>
            </Card>
          ) : (
            <>
              {/* Phone: one card per row, every column visible */}
              <div className="space-y-2 md:hidden">
                <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
                  <span className="shrink-0 text-xs text-slate-500">Sort by</span>
                  {report.columns.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cx(
                        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs whitespace-nowrap ring-1',
                        sort.key === c.key ? 'bg-indigo-600 font-bold text-white ring-indigo-600' : 'bg-white text-slate-700 ring-slate-300'
                      )}
                    >
                      {c.label}
                      {sort.key === c.key && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  ))}
                </div>
                {rows.map((r, i) => (
                  <Card key={r._id || i} className="p-3">
                    <div className="mb-1.5 font-bold text-slate-900">{show(first, r[first.key])}</div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {rest.map((c) => (
                        <div key={c.key} className="flex justify-between gap-2">
                          <dt className="text-slate-500">{c.label}</dt>
                          <dd className={cx('tabular font-bold')}>{show(c, r[c.key])}</dd>
                        </div>
                      ))}
                    </dl>
                  </Card>
                ))}
                {report.totals && (
                  <Card className="bg-slate-50 p-3 ring-slate-300">
                    <div className="mb-1.5 font-bold text-slate-900">Total</div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {rest
                        .filter((c) => report.totals[c.key] !== undefined)
                        .map((c) => (
                          <div key={c.key} className="flex justify-between gap-2">
                            <dt className="text-slate-500">{c.label}</dt>
                            <dd className="tabular font-bold">{show(c, report.totals[c.key])}</dd>
                          </div>
                        ))}
                    </dl>
                  </Card>
                )}
              </div>

              {/* PC / tablet: table */}
              <Card className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      {report.columns.map((c) => (
                        <th key={c.key} className={cx('px-3 py-2 font-bold whitespace-nowrap', c.type === 'text' ? 'text-left' : 'text-right')}>
                          <button
                            type="button"
                            onClick={() => toggleSort(c.key)}
                            title="Click to sort"
                            className={cx(
                              'inline-flex items-center gap-1 rounded px-1 -mx-1 hover:bg-slate-200/60 hover:text-slate-900',
                              c.type !== 'text' && 'flex-row-reverse',
                              sort.key === c.key && 'text-indigo-700'
                            )}
                          >
                            {c.label}
                            <SortIcon k={c.key} />
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {rows.map((r, i) => (
                      <tr key={r._id || i} className="border-t border-slate-100">
                        {report.columns.map((c) => (
                          <td key={c.key} className={cx('px-3 py-2 whitespace-nowrap', c.type === 'text' ? 'text-left' : 'text-right')}>
                            {show(c, r[c.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {report.totals && (
                    <tfoot className="tabular">
                      <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                        {report.columns.map((c) => (
                          <td key={c.key} className={cx('px-3 py-2 whitespace-nowrap', c.type === 'text' ? 'text-left' : 'text-right')}>
                            {report.totals[c.key] === undefined ? '' : show(c, report.totals[c.key])}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
