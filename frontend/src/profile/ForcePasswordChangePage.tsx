import { useState } from 'react';
import { changeMyPasswordApi } from '../api';
import { useLocale } from '../locale/LocaleContext';
import { getStrings } from '../locale/strings';
import type { ToastState, User } from '../types';

export function ForcePasswordChangePage({
  showToast,
  onCompleted,
}: Readonly<{
  showToast: (t: ToastState) => void;
  onCompleted: (user: User) => void;
}>) {
  const { locale } = useLocale();
  const pp = getStrings(locale).profilePage;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      showToast({ tone: 'danger', message: pp.forcePasswordRequired });
      return;
    }
    if (newPassword.length < 8) {
      showToast({ tone: 'danger', message: pp.forcePasswordMinLength });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({ tone: 'danger', message: pp.forcePasswordMismatch });
      return;
    }
    setSubmitting(true);
    try {
      const user = await changeMyPasswordApi({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });
      onCompleted(user);
      showToast({ tone: 'success', message: pp.forcePasswordSuccess });
    } catch (e) {
      showToast({
        tone: 'danger',
        message: e instanceof Error ? e.message : pp.forcePasswordError,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell profile-onboarding-shell">
      <div className="auth-card profile-onboarding-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h1>{pp.forcePasswordTitle}</h1>
          <p className="muted-text">{pp.forcePasswordSubtitle}</p>
          <label className="event-form-field">
            <span className="event-form-field-label">{pp.forcePasswordCurrentLabel}</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              disabled={submitting}
            />
          </label>
          <label className="event-form-field">
            <span className="event-form-field-label">{pp.forcePasswordNewLabel}</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              disabled={submitting}
            />
          </label>
          <label className="event-form-field">
            <span className="event-form-field-label">{pp.forcePasswordConfirmLabel}</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={submitting}
            />
          </label>
          <p className="muted-text" style={{ fontSize: '0.85rem' }}>
            {pp.forcePasswordHint}
          </p>
          <button className="btn primary" type="submit" disabled={submitting || !currentPassword || !newPassword}>
            {submitting ? '…' : pp.forcePasswordSubmit}
          </button>
        </form>
      </div>
    </div>
  );
}
