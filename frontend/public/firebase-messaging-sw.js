// Direct Web Push handler — no Firebase compat SDK needed.
// The browser decrypts the push payload before passing it to the SW,
// so we can read event.data directly without the Firebase SDK.

self.addEventListener('push', (event) => {
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
