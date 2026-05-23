importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Handle background push directly — no Firebase init required.
// FCM delivers the message as a standard Web Push event; we read it and show it.
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

// Optional: Firebase init from main app (kept for forward-compat)
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'FIREBASE_INIT') return;
  if (firebase.apps.length > 0) return;
  firebase.initializeApp(event.data.config);
});
