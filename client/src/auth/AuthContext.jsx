import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { api, setUnauthorizedHandler } from '../api';

const AuthCtx = createContext(null);

function readUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (localStorage.getItem('token') ? readUser() : null));
  const [checking, setChecking] = useState(() => !!localStorage.getItem('token') && !readUser());

  const clear = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout'); // ends worker's approved session on the server
    } catch {
      /* already expired — fine */
    }
    clear();
  }, [clear]);

  const saveSession = useCallback((data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    if (!localStorage.getItem('token')) return;
    // Refresh profile (also detects expired / revoked sessions via 401)
    api
      .get('/auth/me')
      .then((r) => {
        localStorage.setItem('user', JSON.stringify(r.data.user));
        setUser(r.data.user);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [clear]);

  /** Returns { done: true } for admin, or { pending: true, requestId, pollKey } for worker */
  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    if (data.pending) return data;
    saveSession(data);
    return { done: true };
  };

  /** Admin fingerprint / face / screen-lock login */
  const fingerprintLogin = async () => {
    const { data } = await api.post('/auth/passkey-login/options');
    const response = await startAuthentication({ optionsJSON: data.options });
    const res = await api.post('/auth/passkey-login/verify', { challengeId: data.challengeId, response });
    saveSession(res.data);
  };

  return <AuthCtx.Provider value={{ user, checking, login, fingerprintLogin, logout, saveSession }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
