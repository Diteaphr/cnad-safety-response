// Service worker for FCM push notifications.
// Uses the Web Push API directly — no Firebase SDK needed in the SW.
// The main app's Firebase SDK handles token registration via getToken().

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { return; }
  const title = payload.notification?.title ?? '安全確認';
  const body  = payload.notification?.body  ?? '';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192x192.png',
      data: payload.data ?? {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
