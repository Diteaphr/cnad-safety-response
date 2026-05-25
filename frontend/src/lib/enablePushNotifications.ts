import { updateFcmTokenApi } from '../api';

/**
 * Best-effort FCM registration (same as Profile settings push master ON).
 * Never throws — missing Firebase build env must not block saving push prefs.
 */
export async function registerPushTokenIfConfigured(): Promise<string | null> {
  try {
    const { isFirebaseConfigured, requestFcmToken } = await import('./firebase');
    if (!isFirebaseConfigured()) return null;
    const token = await requestFcmToken();
    if (token) await updateFcmTokenApi(token);
    return token;
  } catch (err) {
    console.warn('[push] FCM registration skipped:', err);
    return null;
  }
}
