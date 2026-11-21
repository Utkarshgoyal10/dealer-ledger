import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { Balance, Card, Chips, Empty, ErrorBox, Modal, PageHeader, Spinner } from '../components/ui';
import RouteSelect from '../components/RouteSelect';
import { fmtDate, fmtDateTime, inr } from '../utils/format';

/** Admin: which dealers are short (stock < outstanding), biggest first */
export default function StockChecks() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'short';
  const [route, setRoute] = useState('');
  const [viewing, setViewing] = useState(null);
  const { data, loading, error } = useApi('/stock-checks/overview');

  const groups = useMemo(() => {
    const g = { short: [], covered: [], never: [] };
    for (const d of data || []) {
      if (route && d.route !== route) continue;
      if (!d.last) g.never.push(d);
      else if (d.last.stillShort > 0) g.short.push(d);
      else g.covered.push(d);
    }
    g.short.sort((a, b) => b.last.stillShort - a.last.stillShort);
    g.covered.sort((a, b) => new Date(a.last.createdAt) - new Date(b.last.createdAt));
    g.never.sort((a, b) => b.balance - a.balance);
    return g;
  }, [data, route]);
  const totalShort = groups.short.reduce((s, d) => s + d.last.stillShort, 0);
  const list = groups[tab];

  return (
    <div>
      <PageHeader title="Stock checks" subtitle={totalShort > 0 ? `${groups.short.length} dealer${groups.short.length === 1 ? '' : 's'} short • ${inr(totalShort)} to collect` : 'Stock at shop vs outstanding'} />
      <div className="mb-3">
        <RouteSelect value={route} onChange={setRoute} allowAll allowAdd={false} scroll />
      </div>
      <div className="mb-3">
        <Chips
          scroll
          value={tab}
          onChange={(v) => setParams({ tab: v }, { replace: true })}
          options={[
            { value: 'short', label: `Short (${groups.short.length})` },
            { value: 'covered', label: `Covered (${groups.covered.length})` },
            { value: 'never', label: `Never checked (${groups.never.length})` },
          ]}
        />
      </div>
      <ErrorBox>{error}</ErrorBox>
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : list.length === 0 ? (
          <Empty>{tab === 'short' ? 'No dealer is short 🎉' : 'Nothing here'}</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((d) => (
              <li key={d._id}>
                <button type="button" disabled={!d.last} onClick={() => setViewing(d.last._id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{d.shopName}</div>
                    <div className="truncate text-xs text-slate-500">
                      {d.route || 'No route'} •{' '}
                      {d.last ? `checked ${fmtDate(d.last.createdAt)} by ${d.last.by} • stock ${inr(d.last.stockValue)}` : 'never checked'}
                    </div>
                    {d.last?.paidSince > 0 && <div className="text-[11px] text-emerald-700">Paid {inr(d.last.paidSince)} since check</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    {tab === 'short' ? (
                      <>
                        <div className="text-sm font-bold text-rose-700 tabular">{inr(d.last.stillShort)}</div>
                        <div className="text-[11px] text-slate-500">to collect</div>
                      </>
                    ) : (
                      <Balance value={d.balance} />
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <StockCheckView id={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

/** One saved stock check with every model counted */
export function StockCheckView({ id, onClose }) {
  const { data: k, error } = useApi(id ? `/stock-checks/${id}` : null);
  return (
    <Modal open={!!id} onClose={onClose} title="Stock check">
      {error ? (
        <div className="text-sm text-rose-700">{error}</div>
      ) : !k ? (
        <Spinner />
      ) : (
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-bold">{k.customer?.shopName}</div>
            <div className="text-xs text-slate-500">
              {fmtDateTime(k.createdAt)} • by {k.createdBy?.name}
            </div>
          </div>
          <div className="rounded-lg ring-1 ring-slate-200">
            {k.items.length === 0 ? (
              <div className="px-3 py-2 text-slate-500">No phones in stock</div>
            ) : (
              k.items.map((i, n) => (
                <div key={n} className="flex justify-between border-b border-slate-100 px-3 py-1.5 last:border-0">
                  <span>
                    {i.name} <span className="text-slate-500">× {i.qty}</span>
                  </span>
                  <span className="tabular">{inr(i.value)}</span>
                </div>
              ))
            )}
          </div>
          <div className="space-y-1 rounded-lg bg-slate-50 p-3">
            <div className="flex justify-between">
              <span>Stock ({k.totalQty} phones)</span>
              <b className="tabular">{inr(k.stockValue)}</b>
            </div>
            <div className="flex justify-between">
              <span>Outstanding at that time</span>
              <b className="tabular">{inr(k.outstanding)}</b>
            </div>
            <div className={`flex justify-between font-bold ${k.gap > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              <span>{k.gap > 0 ? 'Short' : 'Covered'}</span>
              <span className="tabular">{k.gap > 0 ? inr(k.gap) : '✓'}</span>
            </div>
          </div>
          {k.note && <div className="text-xs text-slate-600">Note: {k.note}</div>}
        </div>
      )}
    </Modal>
  );
}
