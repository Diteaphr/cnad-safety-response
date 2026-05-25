import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateMyProfileApi } from '../api';
import { registerPushTokenIfConfigured } from '../lib/enablePushNotifications';
import { LocaleProvider } from '../locale/LocaleContext';
import type { User } from '../types';
import { FirstLoginWizard } from './SetupGuideWizard';

vi.mock('../api', () => ({
  changeMyPasswordApi: vi.fn(),
  getMyProfileApi: vi.fn(),
  updateMyProfileApi: vi.fn(),
}));

vi.mock('../lib/enablePushNotifications', () => ({
  registerPushTokenIfConfigured: vi.fn(),
}));

const mockedUpdateProfile = vi.mocked(updateMyProfileApi);
const mockedRegisterPush = vi.mocked(registerPushTokenIfConfigured);

const baseUser: User = {
  id: 'user-1',
  name: 'Demo User',
  email: 'demo@example.com',
  departmentId: 'dept-1',
  roles: ['employee'],
  pushEnabled: true,
  pushEmergencyEnabled: true,
  pushReminderEnabled: true,
  pushEscalationEnabled: true,
  setupGuideCompleted: false,
};

function userWithPush(enabled: boolean): User {
  return {
    ...baseUser,
    pushEnabled: enabled,
    pushEmergencyEnabled: enabled,
    pushReminderEnabled: enabled,
    pushEscalationEnabled: enabled,
  };
}

function renderWizard() {
  const onCompleted = vi.fn();
  const onUserUpdated = vi.fn();
  const showToast = vi.fn();

  render(
    <LocaleProvider>
      <FirstLoginWizard
        user={baseUser}
        mustChangePassword={false}
        showToast={showToast}
        onCompleted={onCompleted}
        onUserUpdated={onUserUpdated}
      />
    </LocaleProvider>,
  );

  return { onCompleted, onUserUpdated, showToast };
}

function pushSwitch() {
  return screen.getByTestId('setup-guide-push-master');
}

function nextButton() {
  return screen.getByRole('button', { name: '下一步' });
}

describe('FirstLoginWizard push master switch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRegisterPush.mockResolvedValue(null);
  });

  it('starts OFF on basic settings even when profile pushEnabled is true', () => {
    renderWizard();
    expect(pushSwitch()).toHaveAttribute('aria-checked', 'false');
    expect(pushSwitch()).not.toHaveClass('is-on');
  });

  it('turns ON after click and persists pushEnabled (no FCM token required)', async () => {
    const user = userEvent.setup();
    mockedUpdateProfile.mockResolvedValue(userWithPush(true));

    renderWizard();
    await user.click(pushSwitch());

    await waitFor(() => expect(pushSwitch()).toHaveAttribute('aria-checked', 'true'));
    expect(mockedRegisterPush).toHaveBeenCalledTimes(1);
    expect(mockedUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        pushEnabled: true,
        pushEmergencyEnabled: true,
        pushReminderEnabled: true,
        pushEscalationEnabled: true,
      }),
    );
  });

  it('turns OFF after click when already ON', async () => {
    const user = userEvent.setup();
    mockedUpdateProfile
      .mockResolvedValueOnce(userWithPush(true))
      .mockResolvedValueOnce(userWithPush(false));

    renderWizard();
    await user.click(pushSwitch());
    await waitFor(() => expect(pushSwitch()).toHaveAttribute('aria-checked', 'true'));

    await user.click(pushSwitch());
    await waitFor(() => expect(pushSwitch()).toHaveAttribute('aria-checked', 'false'));
    expect(mockedUpdateProfile).toHaveBeenLastCalledWith(expect.objectContaining({ pushEnabled: false }));
  });

  it('stays OFF and shows toast when profile save fails', async () => {
    const user = userEvent.setup();
    const { showToast } = renderWizard();
    mockedUpdateProfile.mockRejectedValue(new Error('network error'));

    await user.click(pushSwitch());

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' })),
    );
    expect(pushSwitch()).toHaveAttribute('aria-checked', 'false');
  });

  it('blocks Next while push is OFF', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(nextButton());

    expect(screen.getByRole('alert')).toHaveTextContent(/推播/);
    expect(screen.getByRole('heading', { name: '基本設定' })).toBeInTheDocument();
  });

  it('allows Next after push is turned ON', async () => {
    const user = userEvent.setup();
    mockedUpdateProfile.mockResolvedValue(userWithPush(true));

    renderWizard();
    await user.click(pushSwitch());
    await waitFor(() => expect(pushSwitch()).toHaveAttribute('aria-checked', 'true'));

    await user.click(nextButton());

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '加入主畫面' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
