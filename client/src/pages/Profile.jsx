import { useState } from 'react';
import toast from 'react-hot-toast';
import { Fingerprint, LogOut, Trash2 } from 'lucide-react';
import { startRegistration, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { api, errMsg } from '../api';
import { Button, Card, ErrorBox, Field, Input, PageHeader } from '../components/ui';
import { fmtDateTime } from '../utils/format';
import NotificationSetup from '../components/NotificationSetup';
import AdminDevices from '../components/AdminDevices';

export default function Profile() {
  const { user, logout } = useAuth();
  const isAdmin = user.role === 'admin';

  return (
    <div className="max-w-lg">
      <PageHeader title="My profile" />
      <Card className="mb-4 p-4">
        <div className="text-base font-bold">{user.name}</div>
        <div className="text-sm text-slate-600">Username: {user.username}</div>
        <div className="mt-1 text-xs text-slate-500 capitalize">{user.role}</div>
        {!isAdmin && <div className="mt-2 text-xs text-slate-500">Your login is valid until midnight today. To change your password, ask admin.</div>}
      </Card>

      {isAdmin && <AdminDevices />}
      {isAdmin && <NotificationSetup />}
      {isAdmin && <FingerprintSetup />}
      {isAdmin && <ChangePassword />}

      <Button variant="secondary" onClick={logout}>
        <LogOut className="h-4 w-4" /> Log out
      </Button>
    </div>
  );
}

function FingerprintSetup() {
  const keys = useApi('/auth/passkeys');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');

  if (!browserSupportsWebAuthn()) {
    return (
      <Card className="mb-4 p-4 text-sm text-slate-600">
        Fingerprint login is not supported in this browser. Use Chrome on Android or Safari on iPhone.
      </Card>
    );
  }

  const register = async () => {
    setError('');
    setBusy(true);
    try {
      if (!(await platformAuthenticatorIsAvailable())) {
        throw new Error('This device has no fingerprint / screen lock set up. Turn on screen lock first.');
      }
      const { data: optionsJSON } = await api.post('/auth/passkeys/register-options');
      const response = await startRegistration({ optionsJSON });
      await api.post('/auth/passkeys/register', { response, deviceName: name || guessDevice() });
      toast.success('Fingerprint login is on for this device');
      setName('');
      keys.reload();
    } catch (e) {
      if (e?.name === 'InvalidStateError') setError('This device is already set up.');
      else if (e?.name === 'NotAllowedError') setError('Cancelled.');
      else setError(e?.response ? errMsg(e) : e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove fingerprint login for this device?')) return;
    try {
      await api.delete(`/auth/passkeys/${id}`);
      keys.reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Card className="mb-4 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Fingerprint className="h-4 w-4 text-indigo-600" /> Fingerprint login
      </h2>
      <p className="mt-1 mb-3 text-xs text-slate-500">
        Log in with your phone's fingerprint, face or screen lock instead of a password. Free and stored only on your device. Needs HTTPS when deployed.
      </p>
      {keys.data?.length > 0 && (
        <ul className="mb-3 divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
          {keys.data.map((k) => (
            <li key={k._id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <div>{k.deviceName}</div>
                <div className="text-xs text-slate-500">Added {fmtDateTime(k.createdAt)} • last used {fmtDateTime(k.lastUsedAt)}</div>
              </div>
              <button onClick={() => remove(k._id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Device name (optional)" className="min-w-40 flex-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={guessDevice()} />
        </Field>
        <Button onClick={register} loading={busy}>
          <Fingerprint className="h-4 w-4" /> Add this device
        </Button>
      </div>
      <div className="mt-2">
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Card>
  );
}

function guessDevice() {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Android phone';
  if (/iphone|ipad/i.test(ua)) return 'iPhone / iPad';
  if (/windows/i.test(ua)) return 'Windows PC';
  if (/mac/i.test(ua)) return 'Mac';
  return 'This device';
}

function ChangePassword() {
  const { saveSession } = useAuth();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (f.newPassword !== f.confirm) return setError('New passwords do not match');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword: f.currentPassword, newPassword: f.newPassword });
      saveSession(data);
      setF({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed. Other devices are logged out.');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-4 p-4">
      <h2 className="mb-3 text-sm font-bold">Change password</h2>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Current password">
          <Input type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} required />
        </Field>
        <Field label="New password" hint="At least 6 characters">
          <Input type="password" autoComplete="new-password" minLength={6} value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} required />
        </Field>
        <Field label="Confirm new password">
          <Input type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />
        </Field>
        <ErrorBox>{error}</ErrorBox>
        <Button type="submit" loading={loading}>
          Update password
        </Button>
      </form>
    </Card>
  );
}
