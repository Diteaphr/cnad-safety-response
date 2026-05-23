import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, deleteToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Service worker 初始化後傳入 config（避免 key 寫死在 sw 裡）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    registration.active?.postMessage({ type: 'FIREBASE_INIT', config: firebaseConfig });
  });
}

/** 向使用者要通知權限，並取得 FCM device token。未設定 VAPID 或使用者拒絕時回傳 null。 */
export async function requestFcmToken(): Promise<string | null> {
  if (!VAPID_KEY) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    // 明確指定 firebase-messaging-sw.js，避免與 Vite PWA 的 sw.js 衝突
    const swRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    // 強制清除舊 push subscription 和 Firebase token，確保取得全新的 token
    try { await deleteToken(messaging); } catch {}
    if (swRegistration) {
      const existing = await swRegistration.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
    }
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      ...(swRegistration ? { serviceWorkerRegistration: swRegistration } : {}),
    });
    return token || null;
  } catch (err) {
    console.error('[FCM] getToken failed:', err);
    return null;
  }
}

/** 前景訊息處理（App 開著時）。 */
export function onForegroundMessage(handler: (payload: unknown) => void) {
  return onMessage(messaging, handler);
}
