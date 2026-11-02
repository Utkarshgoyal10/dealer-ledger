import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { errMsg } from '../api';
import { Button, Card, ErrorBox } from './ui';
import { disablePush, enablePush, isIosNotInstalled, pushStatus, pushSupported, sendTestPush } from '../utils/push';

/**
 * Admin: turn on phone notifications for worker login requests (and other approvals).
 * `compact` shows a one-line banner that hides itself once notifications are on.
 */
export default function NotificationSetup({ compact = false }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const refresh = () =>
    pushStatus()
      .then(setStatus)
      .catch(() => setStatus({ supported: pushSupported(), enabled: false }));

  useEffect(() => {
    refresh();
  }, []);

  const run = async (what, fn) => {
    setError('');
    setBusy(what);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e?.response ? errMsg(e) : e.message);
    } finally {
      setBusy('');
    }
  };

  const enable = () =>
    run('on', async () => {
      await enablePush();
      toast.success('Notifications are on for this device');
    });
  const disable = () => run('off', disablePush);
  const test = () =>
    run('test', async () => {
      const n = await sendTestPush();
      toast.success(n ? `Test sent to ${n} device(s)` : 'No devices are set up yet');
    });

  if (!status) return null;

  // ----- compact banner (Dashboard / Logins page) -----
  if (compact) {
    if (status.enabled) return null;
    return (
      <Card className="mb-4 flex flex-wrap items-center gap-3 bg-indigo-50 p-3 ring-indigo-200">
        <BellRing className="h-5 w-5 shrink-0 text-indigo-700" />
        <div className="min-w-0 flex-1 text-sm text-indigo-900">
          <div className="font-semibold">Get a phone notification when a salesman wants to log in</div>
          {isIosNotInstalled() ? (
            <div className="text-xs">On iPhone: tap Share → "Add to Home Screen", open the app from there, then enable.</div>
          ) : !status.supported ? (
            <div className="text-xs">This browser doesn't support notifications. Use Chrome on Android.</div>
          ) : (
            <div className="text-xs">Works even when the app is closed.</div>
          )}
          {error && <div className="mt-1 text-xs text-rose-700">{error}</div>}
        </div>
        {status.supported && !isIosNotInstalled() && (
          <Button size="sm" onClick={enable} loading={busy === 'on'}>
            <Bell className="h-4 w-4" /> Enable
          </Button>
        )}
      </Card>
    );
  }

  // ----- full card (Profile page) -----
  return (
    <Card className="mb-4 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Bell className="h-4 w-4 text-indigo-600" /> Phone notifications
      </h2>
      <p className="mt-1 mb-3 text-xs text-slate-500">
        Get notified when a salesman asks to log in, asks for old data, or submits cash closing — even when the app is closed. Free, no SMS. Turn it on separately on each phone/computer you use.
      </p>

      {!status.supported ? (
        <p className="text-sm text-slate-600">This browser doesn't support notifications. Use Chrome on Android, or Safari on iPhone after "Add to Home Screen".</p>
      ) : isIosNotInstalled() ? (
        <p className="text-sm text-slate-600">
          On iPhone, first tap <b>Share → Add to Home Screen</b>, then open Dealer Ledger from the home screen and come back here. (Needs iOS 16.4 or newer.)
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2 text-sm">
            {status.enabled ? (
              <>
                <BellRing className="h-4 w-4 text-emerald-600" /> <span className="font-semibold text-emerald-700">On for this device</span>
              </>
            ) : (
              <>
                <BellOff className="h-4 w-4 text-slate-400" /> <span className="text-slate-600">Off for this device</span>
              </>
            )}
          </div>
          {status.permission === 'denied' && (
            <p className="mb-3 text-xs text-rose-700">Notifications are blocked for this site. Open browser settings → Site settings → Notifications, allow this site, then tap Enable.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {status.enabled ? (
              <>
                <Button size="sm" variant="secondary" onClick={test} loading={busy === 'test'}>
                  Send test notification
                </Button>
                <Button size="sm" variant="ghost" onClick={disable} loading={busy === 'off'}>
                  Turn off
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={enable} loading={busy === 'on'}>
                <Bell className="h-4 w-4" /> Enable notifications
              </Button>
            )}
          </div>
        </>
      )}
      {error && (
        <div className="mt-2">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}
    </Card>
  );
}
