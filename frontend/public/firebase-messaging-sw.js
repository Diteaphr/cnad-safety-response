importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Config 由主應用程式透過 postMessage 傳入，不在此寫死任何 key。
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'FIREBASE_INIT') return;
  if (firebase.apps.length > 0) return;
  firebase.initializeApp(event.data.config);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification ?? {};
    self.registration.showNotification(title ?? '安全確認', {
      body: body ?? '',
      icon: '/manifest.webmanifest',
      data: payload.data,
    });
  });
});
