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

/** 向使用者要通知權限，並取得 FCM device token。未設定 VAPID 或使用者拒絕時回傳 null。 */
export async function requestFcmToken(): Promise<string | null> {
  if (!VAPID_KEY) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] permission denied:', permission);
      return null;
    }

    // Explicitly register firebase-messaging-sw.js so we control which SW handles push.
    // Using register() (not getRegistration()) ensures we always get OUR named SW,
    // not whatever Workbox SW might be controlling the page.
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('[FCM] SW scope:', swReg.scope, 'state:', (swReg.active ?? swReg.installing ?? swReg.waiting)?.state);

    // Delete old FCM token
    try {
      await deleteToken(messaging);
      console.log('[FCM] old token deleted');
    } catch (e) {
      console.warn('[FCM] deleteToken failed (may be ok if no prior token):', e);
    }

    // Force-unsubscribe any existing push subscription so FCM creates a fresh one
    try {
      const existingSub = await swReg.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
        console.log('[FCM] unsubscribed old push subscription');
      } else {
        console.log('[FCM] no existing push subscription');
      }
    } catch (e) {
      console.warn('[FCM] unsubscribe failed:', e);
    }

    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    console.log('[FCM] new token prefix:', token?.slice(0, 12));
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
