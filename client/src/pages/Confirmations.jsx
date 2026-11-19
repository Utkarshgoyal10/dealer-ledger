import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApi } from '../hooks/useApi';
import { api, errMsg } from '../api';
import { Balance, Card, Chip, Chips, Empty, ErrorBox, PageHeader, Spinner } from '../components/ui';
import RouteSelect from '../components/RouteSelect';
import ConfirmationView, { CONFIRM_STATUS } from '../components/ConfirmationView';
import { fmtDate } from '../utils/format';

const monthName = () => new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

/** Admin: who has confirmed this month, who is due, disputes, and skip */
export default function Confirmations() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'due';
  const [route, setRoute] = useState('');
  const [viewing, setViewing] = useState(null);
  const ov = useApi('/confirmations/overview');
  const pend = useApi('/confirmations', { toApprove: 'true', limit: 300 });
  const { data, loading, error } = ov;
  const reload = () => {
    ov.reload();
    pend.reload();
  };
  const toApprove = (pend.data || []).filter((x) => !route || x.customer?.route === route);

  const counts = useMemo(() => {
    const c = { due: 0, done: 0, disputed: 0, other: 0 };
    for (const d of data || []) {
      if (route && d.route !== route) continue;
      if (d.monthStatus === 'due' || d.monthStatus === 'done' || d.monthStatus === 'disputed') c[d.monthStatus]++;
      else c.other++;
    }
    return c;
  }, [data, route]);

  const list = (data || []).filter(
    (d) => (!route || d.route === route) && (tab === 'other' ? ['skipped', 'zero'].includes(d.monthStatus) : d.monthStatus === tab)
  );

  const skip = async (d, value) => {
    try {
      await api.post('/confirmations/skip', { customer: d._id, skip: value });
      toast.success(value ? `${d.shopName}: skipped for ${monthName()}` : `${d.shopName}: skip removed`);
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader title="Balance confirmations" subtitle={`${monthName()} — dealer signs the ledger once or twice a month`} />
      <div className="mb-3">
        <RouteSelect value={route} onChange={setRoute} allowAll allowAdd={false} scroll />
      </div>
      <div className="mb-3">
        <Chips
          scroll
          value={tab}
          onChange={(v) => setParams({ tab: v }, { replace: true })}
          options={[
            { value: 'due', label: `Due (${counts.due})` },
            { value: 'approve', label: `To approve (${toApprove.length})` },
            { value: 'disputed', label: `Disputed (${counts.disputed})` },
            { value: 'done', label: `Done (${counts.done})` },
            { value: 'other', label: `Skipped / ₹0 (${counts.other})` },
          ]}
        />
      </div>

      <ErrorBox>{error}</ErrorBox>
      <Card>
        {tab === 'approve' ? (
          toApprove.length === 0 ? (
            <Empty>No signed confirmations waiting for you</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {toApprove.map((x) => (
                <li key={x._id}>
                  <button type="button" onClick={() => setViewing(x._id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{x.customer?.shopName}</div>
                      <div className="truncate text-xs text-slate-500">
                        Signed {fmtDate(x.createdAt)} • by {x.createdBy?.name}
                        {x.signerName ? ` • ${x.signerName}` : ''}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Balance value={x.closingBalance} />
                      <div className="text-xs font-bold text-emerald-700">Tap to check</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : loading && !data ? (
          <Spinner />
        ) : list.length === 0 ? (
          <Empty>{tab === 'due' ? 'All dealers are confirmed or skipped this month 🎉' : 'Nothing here'}</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((d) => (
              <li key={d._id} className="flex items-center gap-3 px-4 py-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => d.latest && setViewing(d.latest._id)} disabled={!d.latest}>
                  <div className="truncate text-sm font-bold">{d.shopName}</div>
                  <div className="truncate text-xs text-slate-500">
                    {d.route || 'No route'}
                    {d.hideBalance && ' • handled by admin'}
                    {' • '}
                    {d.lastConfirmedAt ? `last signed ${fmtDate(d.lastConfirmedAt)}` : 'never signed'}
                  </div>
                  {d.monthStatus === 'disputed' && <Chip className={`mt-1 ${CONFIRM_STATUS.disputed.chip}`}>Tap to see what dealer said</Chip>}
                </button>
                <div className="shrink-0 text-right">
                  <Balance value={d.balance} />
                  {d.monthStatus === 'due' && (
                    <button type="button" onClick={() => skip(d, true)} className="mt-0.5 block w-full text-right text-xs font-bold text-slate-500 underline">
                      Skip month
                    </button>
                  )}
                  {d.monthStatus === 'skipped' && (
                    <button type="button" onClick={() => skip(d, false)} className="mt-0.5 block w-full text-right text-xs font-bold text-indigo-700 underline">
                      Undo skip
                    </button>
                  )}
                  {d.monthStatus === 'zero' && <div className="text-[11px] text-slate-500">₹0 — not needed</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmationView id={viewing} onClose={() => setViewing(null)} onChanged={reload} />
    </div>
  );
}
