import { useState } from 'react';
import { useLocale } from '../locale/LocaleContext';
import { getStrings } from '../locale/strings';
import type { ToastState, User } from '../types';
import { updateMyProfileApi } from '../api';

export function ProfileOnboardingPage({
  user,
  showToast,
  onCompleted,
}: {
  user: User;
  showToast: (t: ToastState) => void;
  onCompleted: (next: User) => void;
}) {
  const { locale } = useLocale();
  const pp = getStrings(locale).profilePage;
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone?.trim() ?? '');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const pn = phone.trim();
    if (!pn) {
      showToast({ tone: 'danger', message: pp.onboardingPhoneRequired });
      return;
    }
    setSubmitting(true);
    try {
      const next = await updateMyProfileApi({ name: name.trim(), phone: pn });
      onCompleted(next);
      showToast({ tone: 'success', message: pp.onboardingSuccess });
    } catch (e) {
      showToast({ tone: 'danger', message: e instanceof Error ? e.message : pp.onboardingError });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell profile-onboarding-shell">
      <div className="auth-card profile-onboarding-card">
        <h1>{pp.onboardingTitle}</h1>
        <p className="muted-text">{pp.onboardingSubtitle}</p>
        <label className="event-form-field">
          <span className="event-form-field-label">{pp.onboardingNameLabel}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" disabled={submitting} />
        </label>
        <label className="event-form-field">
          <span className="event-form-field-label">{pp.onboardingPhoneLabel}</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={pp.onboardingPhonePlaceholder}
            inputMode="tel"
            autoComplete="tel"
            disabled={submitting}
          />
        </label>
        <p className="muted-text" style={{ fontSize: '0.85rem' }}>
          {pp.onboardingNoSkip}
        </p>
        <button
          className="btn primary"
          type="button"
          disabled={submitting || !name.trim() || !phone.trim()}
          onClick={() => void submit()}
        >
          {submitting ? '…' : pp.onboardingContinue}
        </button>
      </div>
    </div>
  );
}
