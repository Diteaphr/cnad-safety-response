importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase config is a public identifier, not a secret.
// See: https://firebase.google.com/docs/projects/api-keys
firebase.initializeApp({
  apiKey: 'AIzaSyALQqA4tL9T-1XNXv5erfi0chtIh94jUm8',
  authDomain: 'cnad-safety-response.firebaseapp.com',
  projectId: 'cnad-safety-response',
  storageBucket: 'cnad-safety-response.firebasestorage.app',
  messagingSenderId: '959534192972',
  appId: '1:959534192972:web:f0142b4c52764282f5d7e9',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? '安全確認', {
    body: body ?? '',
    icon: '/icon-192x192.png',
    data: payload.data,
  });
});
