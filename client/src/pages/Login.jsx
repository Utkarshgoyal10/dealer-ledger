import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Fingerprint, Loader2, Clock } from 'lucide-react';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { useAuth } from '../auth/AuthContext';
import { api, errMsg } from '../api';
import { Button, Card, ErrorBox, Field, Input } from '../components/ui';
import InstallApp from '../components/InstallApp';

const PENDING_KEY = 'pendingLogin';
const POLL_MS = 4000;

export default function Login() {
  const { user, login, fingerprintLogin, saveSession } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Worker waiting for admin approval (kept across page reloads)
  const [pending, setPending] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
    } catch {
      return null;
    }
  });
  const timer = useRef(null);

  useEffect(() => {
    if (!pending) return;
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    const poll = async () => {
      try {
        const { data } = await api.post('/auth/login-status', { requestId: pending.requestId, pollKey: pending.pollKey });
        if (data.status === 'approved') {
          sessionStorage.removeItem(PENDING_KEY);
          saveSession(data);
          return;
        }
        if (data.status !== 'pending') {
          sessionStorage.removeItem(PENDING_KEY);
          setPending(null);
          setError(data.message || 'Login was not approved');
          return;
        }
      } catch (e) {
        if (e.response?.status === 404) {
          sessionStorage.removeItem(PENDING_KEY);
          setPending(null);
          return;
        }
        /* network blip: keep trying */
      }
      timer.current = setTimeout(poll, POLL_MS);
    };
    poll();
    return () => clearTimeout(timer.current);
  }, [pending, saveSession]);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await login(username, password);
      if (r.pending) setPending({ requestId: r.requestId, pollKey: r.pollKey, username });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const cancel = async () => {
    clearTimeout(timer.current);
    try {
      await api.post('/auth/login-cancel', { requestId: pending.requestId, pollKey: pending.pollKey });
    } catch {
      /* ignore */
    }
    sessionStorage.removeItem(PENDING_KEY);
    setPending(null);
  };

  const fingerprint = async () => {
    setError('');
    setLoading(true);
    try {
      await fingerprintLogin();
    } catch (err) {
      if (err?.name === 'NotAllowedError') setError('Fingerprint cancelled or not recognised');
      else setError(err?.response ? errMsg(err) : err.message || 'Fingerprint login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/logo.png" alt="itel" className="mb-3 h-20 w-auto object-contain" />
          <h1 className="text-xl font-bold">Dealer Ledger</h1>
        </div>

        <InstallApp />
        {pending ? (
          <Card className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <h2 className="text-base font-bold">Waiting for admin approval</h2>
            <p className="mt-1 text-sm text-slate-500">
              Hi <b>{pending.username}</b>, your login request was sent. Keep this screen open — you'll be logged in as soon as admin approves.
            </p>
            <div className="my-4 flex justify-center text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <p className="mb-4 text-xs text-slate-500">Approval is valid for today only.</p>
            <Button variant="secondary" onClick={cancel}>
              Cancel
            </Button>
          </Card>
        ) : (
          <>
            <Card className="p-5">
              <form onSubmit={submit} className="space-y-4">
                <Field label="Username">
                  <Input autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
                </Field>
                <Field label="Password">
                  <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Field>
                <ErrorBox>{error}</ErrorBox>
                <Button type="submit" className="w-full" loading={loading}>
                  Log in
                </Button>
              </form>
            </Card>
            {browserSupportsWebAuthn() && (
              <Button variant="secondary" className="mt-3 w-full" onClick={fingerprint} disabled={loading}>
                <Fingerprint className="h-5 w-5" /> Admin: log in with fingerprint
              </Button>
            )}
            <p className="mt-4 text-center text-xs text-slate-500">Workers need admin approval each day. Forgot password? Ask admin.</p>
          </>
        )}
      </div>
    </div>
  );
}
