// Direct Web Push handler — no Firebase compat SDK needed.
// The browser decrypts the push payload before passing it to the SW,
// so we can read event.data directly without the Firebase SDK.

self.addEventListener('install', () => self.skipWaiting());
// No clients.claim() — claiming open pages causes Firebase SDK to detect
// a SW change and reset app state, which kicks users back to login.

self.addEventListener('push', (event) => {
  // Notify all open app windows so the push receipt is visible in the app.
  self.clients.matchAll({ type: 'window' }).then((wins) => {
    wins.forEach((w) => w.postMessage({ type: 'SW_PUSH_RECEIVED', hasData: !!event.data }));
  });

  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: '安全確認', body: event.data.text() } };
  }

  // FCM sends { notification: { title, body }, data: { ... } }
  const notif = payload.notification ?? {};
  const title = notif.title ?? '安全確認';
  const body = notif.body ?? '';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: payload.data ?? {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
