import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateFcmTokenApi } from '../api';
import { registerPushTokenIfConfigured } from './enablePushNotifications';

vi.mock('../api', () => ({
  updateFcmTokenApi: vi.fn(),
}));

vi.mock('./firebase', () => ({
  isFirebaseConfigured: vi.fn(),
  requestFcmToken: vi.fn(),
}));

import { isFirebaseConfigured, requestFcmToken } from './firebase';

const mockedIsConfigured = vi.mocked(isFirebaseConfigured);
const mockedRequestFcm = vi.mocked(requestFcmToken);
const mockedUpdateFcm = vi.mocked(updateFcmTokenApi);

describe('registerPushTokenIfConfigured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUpdateFcm.mockResolvedValue(undefined);
  });

  it('skips FCM when Firebase is not configured', async () => {
    mockedIsConfigured.mockReturnValue(false);
    const token = await registerPushTokenIfConfigured();
    expect(token).toBeNull();
    expect(mockedRequestFcm).not.toHaveBeenCalled();
    expect(mockedUpdateFcm).not.toHaveBeenCalled();
  });

  it('never throws when requestFcmToken fails', async () => {
    mockedIsConfigured.mockReturnValue(true);
    mockedRequestFcm.mockRejectedValue(
      new Error('Installations: Missing App configuration value: "projectId"'),
    );
    const token = await registerPushTokenIfConfigured();
    expect(token).toBeNull();
  });
});
