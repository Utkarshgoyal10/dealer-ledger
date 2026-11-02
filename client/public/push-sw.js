/* Loaded into the app's service worker. Shows push notifications even when the app is closed. */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Dealer Ledger', {
      body: data.body || '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: data.tag,
      renotify: !!data.tag,
      requireInteraction: true, // stays on screen until the admin taps it
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' },
    })
  );
});

// Tapping the notification opens the app on the right page (e.g. Logins)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin) {
          try {
            await w.focus();
            await w.navigate(url);
            return;
          } catch {
            /* fall through and open a new window */
          }
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
