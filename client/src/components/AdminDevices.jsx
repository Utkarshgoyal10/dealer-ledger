import { useState } from 'react';
import toast from 'react-hot-toast';
import { Fingerprint, KeyRound, LogOut, MonitorSmartphone, Smartphone, Monitor } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { api, errMsg } from '../api';
import { Button, Card, Chip, Modal, Spinner, cx } from './ui';
import { fmtDate, fmtDateTime } from '../utils/format';

function timeAgo(d) {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 2) return 'Active now';
  if (mins < 60) return `Active ${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Active ${hrs} hr ago`;
  return `Last active ${fmtDateTime(d)}`;
}

const isPhone = (device) => /android|iphone|ipad/i.test(device);

/** Admin: list of devices where the admin is logged in, with log out buttons */
export default function AdminDevices() {
  const { logout } = useAuth();
  const { data, loading, reload } = useApi('/auth/sessions');
  const [confirm, setConfirm] = useState(null); // { type: 'one', s } | { type: 'others' }
  const [busy, setBusy] = useState(false);

  const others = (data || []).filter((s) => !s.current).length;

  const run = async () => {
    setBusy(true);
    try {
      if (confirm.type === 'others') {
        const { data: r } = await api.post('/auth/sessions/logout-others');
        toast.success(`Logged out ${r.count} other device${r.count === 1 ? '' : 's'}`);
      } else {
        const { data: r } = await api.delete(`/auth/sessions/${confirm.s._id}`);
        if (r.current) {
          setConfirm(null);
          logout();
          return;
        }
        toast.success(`${confirm.s.device} logged out`);
      }
      setConfirm(null);
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <MonitorSmartphone className="h-4 w-4 text-indigo-600" /> Logged-in devices
        {data && <Chip>{data.length}</Chip>}
      </h2>
      <p className="mt-1 mb-3 text-xs text-slate-500">
        Every phone or computer where you are logged in as admin. Each login lasts 7 days. If you don't recognise a device, log it out and change your password.
      </p>

      {loading && !data ? (
        <Spinner className="py-4" />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
          {(data || []).map((s) => {
            const Icon = isPhone(s.device) ? Smartphone : Monitor;
            return (
              <li key={s._id} className={cx('flex items-start gap-3 px-3 py-3', s.current && 'bg-indigo-50/50')}>
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold">{s.device}</span>
                    {s.current && <Chip className="bg-emerald-50 text-emerald-700 ring-emerald-200">This device</Chip>}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {s.current ? 'Active now' : timeAgo(s.lastSeenAt)}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    {s.method === 'fingerprint' ? <Fingerprint className="h-3 w-3" /> : <KeyRound className="h-3 w-3" />}
                    Logged in {fmtDateTime(s.loggedInAt)} with {s.method} • ends {fmtDate(s.expiresAt)}
                  </div>
                </div>
                <Button size="sm" variant={s.current ? 'secondary' : 'ghost'} className={s.current ? '' : 'text-rose-600'} onClick={() => setConfirm({ type: 'one', s })}>
                  <LogOut className="h-3.5 w-3.5" /> Log out
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {others > 0 && (
        <Button size="sm" variant="secondary" className="mt-3 text-rose-600" onClick={() => setConfirm({ type: 'others' })}>
          <LogOut className="h-4 w-4" /> Log out all other devices ({others})
        </Button>
      )}

      {confirm && (
        <Modal
          open
          onClose={() => setConfirm(null)}
          title={confirm.type === 'others' ? 'Log out other devices?' : confirm.s.current ? 'Log out this device?' : `Log out ${confirm.s.device}?`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button variant="danger" loading={busy} onClick={run}>
                Log out
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-700">
            {confirm.type === 'others'
              ? `All ${others} other device${others === 1 ? '' : 's'} will be logged out right away. This device stays logged in.`
              : confirm.s.current
                ? 'You will be logged out on this device now.'
                : 'That device will be logged out right away. It will need the password or fingerprint to log in again.'}
          </p>
        </Modal>
      )}
    </Card>
  );
}
