import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

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

/** 向使用者要通知權限，並取得 FCM device token。未設定 VAPID 或使用者拒絕時回傳 null。 */
export async function requestFcmToken(): Promise<string | null> {
  if (!VAPID_KEY) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token || null;
  } catch {
    return null;
  }
}

/** 前景訊息處理（App 開著時）。 */
export function onForegroundMessage(handler: (payload: unknown) => void) {
  return onMessage(messaging, handler);
}
