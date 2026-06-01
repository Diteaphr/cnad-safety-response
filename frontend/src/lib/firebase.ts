import { initializeApp, type FirebaseApp } from 'firebase/app';
import { deleteToken, getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

type RequiredFirebaseConfig = {
  apiKey: string;
  authDomain: string | undefined;
  projectId: string;
  storageBucket: string | undefined;
  messagingSenderId: string;
  appId: string;
};

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

function requiredFirebaseConfig(): RequiredFirebaseConfig | null {
  const { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId } = firebaseConfig;
  if (!apiKey?.trim() || !projectId?.trim() || !appId?.trim() || !messagingSenderId?.trim()) return null;
  return {
    apiKey: apiKey.trim(),
    authDomain,
    projectId: projectId.trim(),
    storageBucket,
    messagingSenderId: messagingSenderId.trim(),
    appId: appId.trim(),
  };
}

/** True when build-time env includes the minimum Firebase web app fields. */
export function isFirebaseConfigured(): boolean {
  return requiredFirebaseConfig() !== null;
}

function getMessagingInstance(): Messaging | null {
  const config = requiredFirebaseConfig();
  if (!config) return null;
  if (!app) {
    app = initializeApp(config);
    messaging = getMessaging(app);
  }
  return messaging;
}

async function registerMessagingServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const swReg = await navigator.serviceWorker.ready;
    console.log('[FCM] SW scope:', swReg.scope, 'state:', (swReg.active ?? swReg.installing ?? swReg.waiting)?.state);
    return swReg;
  } catch (err) {
    console.error('[FCM] service worker registration failed:', err);
    return null;
  }
}

async function ensureNotificationPermission(): Promise<boolean> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[FCM] permission denied:', permission);
    return false;
  }
  return true;
}

async function clearExistingFcmToken(messagingInstance: Messaging): Promise<void> {
  try {
    await deleteToken(messagingInstance);
    console.log('[FCM] old token deleted');
  } catch (e) {
    console.warn('[FCM] deleteToken failed (may be ok if no prior token):', e);
  }
}

async function clearExistingPushSubscription(swReg: ServiceWorkerRegistration): Promise<void> {
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
}

/** 向使用者要通知權限，並取得 FCM device token。未設定 Firebase/VAPID 或使用者拒絕時回傳 null。 */
export async function requestFcmToken(): Promise<string | null> {
  if (!isFirebaseConfigured() || !VAPID_KEY?.trim()) return null;
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance) return null;

  const swReg = await registerMessagingServiceWorker();
  if (!swReg) return null;
  if (!(await ensureNotificationPermission())) return null;

  await clearExistingFcmToken(messagingInstance);
  await clearExistingPushSubscription(swReg);

  try {
    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
    console.log('[FCM] new token prefix:', token?.slice(0, 12));
    return token || null;
  } catch (err) {
    console.error('[FCM] getToken failed:', err);
    return null;
  }
}

/** 前景訊息處理（App 開著時）。未設定 Firebase 時回傳 no-op unsubscribe。 */
export function onForegroundMessage(handler: (payload: unknown) => void): () => void {
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance) return () => {};
  return onMessage(messagingInstance, handler);
}
