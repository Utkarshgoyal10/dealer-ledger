import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { LogIn } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api, errMsg } from '../api';
import { Button, Card, Chip, Empty, ErrorBox, PageHeader, Segmented, Spinner } from '../components/ui';
import { fmtDate, fmtDateTime, STATUS_CHIP } from '../utils/format';
import NotificationSetup from '../components/NotificationSetup';

function deviceLabel(ua = '') {
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad/i.test(ua)) return 'iPhone';
  if (/windows/i.test(ua)) return 'Windows';
  if (/mac/i.test(ua)) return 'Mac';
  return 'Browser';
}

export default function LoginApprovals() {
  const [tab, setTab] = useState('pending');
  const { data, loading, error, reload } = useApi('/login-requests', tab === 'pending' ? { status: 'pending' } : undefined);
  const [busy, setBusy] = useState('');

  // Refresh every 10 seconds so new requests appear on their own
  useEffect(() => {
    const t = setInterval(reload, 10000);
    return () => clearInterval(t);
  }, [reload]);

  const act = async (r, action) => {
    setBusy(r._id + action);
    try {
      await api.post(`/login-requests/${r._id}/${action}`);
      toast.success(action === 'approve' ? `${r.worker?.name} can log in today` : action === 'reject' ? 'Login rejected' : 'Logged out');
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy('');
    }
  };

  const STATUS = { approved: 'Logged in', pending: 'Waiting', rejected: 'Rejected', revoked: 'Logged out', cancelled: 'Cancelled' };

  return (
    <div>
      <PageHeader title="Salesman logins" subtitle={`Approve salesman logins for today, ${fmtDate(new Date())}. Approval ends at midnight.`} />
      <NotificationSetup compact />
      <div className="mb-3 max-w-xs">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pending', label: 'Waiting' },
            { value: 'today', label: 'All today' },
          ]}
        />
      </div>
      <ErrorBox>{error}</ErrorBox>
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : !data?.length ? (
          <Empty>{tab === 'pending' ? 'No one is waiting to log in' : 'No logins today'}</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((r) => (
              <li key={r._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                    <LogIn className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">{r.worker?.name}</span>
                      <span className="text-slate-500">@{r.worker?.username}</span>
                      <Chip className={STATUS_CHIP[r.status] || STATUS_CHIP.expired}>{STATUS[r.status]}</Chip>
                    </div>
                    <div className="text-xs text-slate-500">
                      Asked {fmtDateTime(r.createdAt)} • {deviceLabel(r.device)}
                      {r.reviewedBy && ` • by ${r.reviewedBy.name}`}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {r.status === 'pending' && (
                    <>
                      <Button size="sm" variant="success" loading={busy === r._id + 'approve'} onClick={() => act(r, 'approve')}>
                        Approve
                      </Button>
                      <Button size="sm" variant="secondary" className="text-rose-600" loading={busy === r._id + 'reject'} onClick={() => act(r, 'reject')}>
                        Reject
                      </Button>
                    </>
                  )}
                  {r.status === 'approved' && (
                    <Button size="sm" variant="secondary" loading={busy === r._id + 'revoke'} onClick={() => act(r, 'revoke')}>
                      Log out now
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
