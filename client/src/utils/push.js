import { api } from '../api';

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** iPhone/iPad only allow push when the app is installed to the home screen */
export function isIosNotInstalled() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  return ios && !standalone;
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function registration() {
  // Waits for the app's service worker (registered by vite-plugin-pwa)
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('App is still installing. Reload the page and try again.')), 10000)),
  ]);
}

/** Is THIS device currently receiving notifications? */
export async function pushStatus() {
  if (!pushSupported()) return { supported: false };
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { supported: true, enabled: false, permission: Notification.permission };
  const { data } = await api.get('/push/status', { params: { endpoint: sub.endpoint } });
  return { supported: true, enabled: data.subscribed, permission: Notification.permission };
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser does not support notifications');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked for this site. Click the icon left of the address bar → Site settings → Notifications → Allow, reload the page, then tap Enable again. (Incognito/private windows always block notifications.)'
        : 'You closed the permission popup. Tap Enable again and choose "Allow".'
    );
  }
  const reg = await registration();
  const { data } = await api.get('/push/public-key');
  let sub = await reg.pushManager.getSubscription();
  // If the server keys changed, the old subscription must be replaced
  if (sub && sub.options?.applicationServerKey) {
    const current = btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    if (current !== data.publicKey) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.publicKey) });
  }
  await api.post('/push/subscribe', { subscription: sub.toJSON() });
}

export async function disablePush() {
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTestPush() {
  const { data } = await api.post('/push/test');
  return data.sent;
}
