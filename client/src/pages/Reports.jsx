import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { download } from '../api';
import { Button, Card, Chips, Empty, ErrorBox, Field, Input, PageHeader, Spinner, cx } from '../components/ui';
import RouteSelect from '../components/RouteSelect';
import { fmtDate, inr, monthStartKey, todayKey } from '../utils/format';

const TABS = [
  { value: 'summary', label: 'Sales summary' },
  { value: 'workers', label: 'Worker-wise' },
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
  const workerOptions = [{ value: '', label: 'All workers' }, ...(workers.data || []).map((w) => ({ value: w._id, label: w.name }))];

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
              <Field as="div" label="Worker">
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
                {report.rows.map((r, i) => (
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
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {report.rows.map((r, i) => (
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
