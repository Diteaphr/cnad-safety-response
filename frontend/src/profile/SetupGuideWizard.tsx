import { useState, type ReactNode } from 'react';
import {
  Bookmark,
  Glasses,
  PlusSquare,
  Search,
  Share,
  SquarePen,
  Star,
} from 'lucide-react';
import { changeMyPasswordApi, getMyProfileApi, updateMyProfileApi } from '../api';
import { registerPushTokenIfConfigured } from '../lib/enablePushNotifications';
import { useLocale, type AppLocale } from '../locale/LocaleContext';
import { getStrings } from '../locale/strings';
import type { ToastState, User } from '../types';

const STEP_COUNT = 3;

function IosShareSheetMock({ sg }: Readonly<{ sg: ReturnType<typeof getStrings>['setupGuide'] }>) {
  const rows: { label: string; icon: ReactNode; highlight?: boolean }[] = [
    { label: sg.iosShareSheetReadingList, icon: <Glasses size={18} aria-hidden /> },
    { label: sg.iosShareSheetBookmark, icon: <Bookmark size={18} aria-hidden /> },
    { label: sg.iosShareSheetFavorites, icon: <Star size={18} aria-hidden /> },
    { label: sg.iosShareSheetQuickNote, icon: <SquarePen size={18} aria-hidden /> },
    { label: sg.iosShareSheetFindOnPage, icon: <Search size={18} aria-hidden /> },
    {
      label: sg.iosShareSheetAddHome,
      icon: <PlusSquare size={18} aria-hidden />,
      highlight: true,
    },
  ];

  return (
    <div className="setup-guide-ios-sheet" role="img" aria-label={sg.iosShareSheetAddHome}>
      <ul className="setup-guide-ios-sheet-list">
        {rows.map((row) => (
          <li
            key={row.label}
            className={`setup-guide-ios-sheet-row${row.highlight ? ' is-target' : ''}`}
          >
            <span className="setup-guide-ios-sheet-label">{row.label}</span>
            <span className="setup-guide-ios-sheet-icon">{row.icon}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type FirstLoginWizardProps = Readonly<{
  user: User;
  mustChangePassword: boolean;
  showToast: (t: ToastState) => void;
  onCompleted: (user: User) => void;
  onUserUpdated: (user: User) => void;
}>;

function computeCanNext(
  step: number,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
  passwordSubmitting: boolean,
): boolean {
  if (step === 0) {
    return Boolean(currentPassword && newPassword && confirmPassword) && !passwordSubmitting;
  }
  return step === 1;
}

function computeNextLabel(
  step: number,
  passwordSubmitting: boolean,
  submitLabel: string,
  nextLabel: string,
): string {
  if (step !== 0) {
    return nextLabel;
  }
  return passwordSubmitting ? '…' : submitLabel;
}

/** First login: ① password → ② language + push → ③ Add to Home Screen */
export function FirstLoginWizard({
  user,
  mustChangePassword,
  showToast,
  onCompleted,
  onUserUpdated,
}: FirstLoginWizardProps) {
  const { locale, setLocale } = useLocale();
  const { setupGuide: sg, profilePage: pp } = getStrings(locale);

  const [step, setStep] = useState(() => (mustChangePassword ? 0 : 1));
  const [topAlert, setTopAlert] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [draftLocale, setDraftLocale] = useState<AppLocale>(locale);
  /** Wizard starts OFF; same toggle flow as ProfileSettingsPage push master. */
  const [pushMaster, setPushMaster] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);

  const [homeAck, setHomeAck] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const clearTopAlert = () => setTopAlert(null);

  const persistWizardPushPrefs = async (patch: { pushEnabled: boolean }) => {
    if (pushSaving) return;
    setPushSaving(true);
    try {
      const updated = await updateMyProfileApi({
        name: user.name,
        phone: user.phone?.trim() ? user.phone.trim() : null,
        pushEnabled: patch.pushEnabled,
        ...(patch.pushEnabled
          ? {
              pushEmergencyEnabled: true,
              pushReminderEnabled: true,
              pushEscalationEnabled: true,
            }
          : {}),
      });
      onUserUpdated(updated);
      setPushMaster(updated.pushEnabled);
      clearTopAlert();
    } catch (e) {
      showToast({
        tone: 'danger',
        message: e instanceof Error ? e.message : pp.profileSaveError,
      });
    } finally {
      setPushSaving(false);
    }
  };

  const toggleRow = (checked: boolean, onToggle: (next: boolean) => void, ariaLabel: string) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-testid="setup-guide-push-master"
      disabled={pushSaving}
      className={`profile-settings-switch${checked ? ' is-on' : ''}`}
      onClick={() => {
        if (pushSaving) return;
        onToggle(!checked);
      }}
    />
  );

  const submitPassword = async () => {
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
    setPasswordSubmitting(true);
    clearTopAlert();
    try {
      await changeMyPasswordApi({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });
      const me = await getMyProfileApi();
      onUserUpdated(me);
      showToast({ tone: 'success', message: pp.forcePasswordSuccess });
      setStep(1);
    } catch (e) {
      showToast({
        tone: 'danger',
        message: e instanceof Error ? e.message : pp.forcePasswordError,
      });
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const goNext = () => {
    clearTopAlert();
    if (step === 0) {
      void submitPassword();
      return;
    }
    if (step === 1) {
      if (!pushMaster) {
        setTopAlert(`${sg.pushBlockedTitle} — ${sg.pushBlockedBody}`);
        return;
      }
      setLocale(draftLocale);
      setStep(2);
    }
  };

  const goBack = () => {
    clearTopAlert();
    if (step > (mustChangePassword ? 0 : 1)) setStep((s) => s - 1);
  };

  const finish = async () => {
    if (!homeAck || !pushMaster || finishing) return;
    setFinishing(true);
    clearTopAlert();
    try {
      const updated = await updateMyProfileApi({
        name: user.name,
        phone: user.phone?.trim() ? user.phone.trim() : null,
        pushEnabled: true,
        pushEmergencyEnabled: true,
        pushReminderEnabled: true,
        pushEscalationEnabled: true,
        setupGuideCompleted: true,
      });
      onCompleted(updated);
      showToast({ tone: 'success', message: sg.setupComplete });
    } catch (e) {
      showToast({
        tone: 'danger',
        message: e instanceof Error ? e.message : sg.setupError,
      });
    } finally {
      setFinishing(false);
    }
  };

  const stepLabel = sg.stepIndicator(step + 1, STEP_COUNT);

  const canNext = computeCanNext(
    step,
    currentPassword,
    newPassword,
    confirmPassword,
    passwordSubmitting,
  );

  const nextLabel = computeNextLabel(
    step,
    passwordSubmitting,
    pp.forcePasswordSubmit,
    sg.next,
  );

  const showBackButton = step > (mustChangePassword ? 0 : 1);

  return (
    <div className="auth-shell setup-guide-shell">
      <div className="setup-guide-card">
        <p className="setup-guide-step-meta muted-text">{stepLabel}</p>

        {topAlert ? (
          <div className="setup-guide-top-alert" role="alert">
            <p>{topAlert}</p>
          </div>
        ) : null}

        <div className="setup-guide-viewport">
          <div className="setup-guide-track" style={{ transform: `translateX(-${step * 100}%)` }}>
            <section className="setup-guide-panel" aria-hidden={step !== 0}>
              <h1>{sg.stepPasswordTitle}</h1>
              <p className="muted-text setup-guide-lead">{pp.forcePasswordSubtitle}</p>
              <label className="event-form-field">
                <span className="event-form-field-label">{pp.forcePasswordCurrentLabel}</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={passwordSubmitting}
                />
              </label>
              <label className="event-form-field">
                <span className="event-form-field-label">{pp.forcePasswordNewLabel}</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={passwordSubmitting}
                />
              </label>
              <label className="event-form-field">
                <span className="event-form-field-label">{pp.forcePasswordConfirmLabel}</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={passwordSubmitting}
                />
              </label>
              <p className="muted-text setup-guide-hint">{pp.forcePasswordHint}</p>
            </section>

            <section className="setup-guide-panel" aria-hidden={step !== 1}>
              <h1>{sg.stepSettingsTitle}</h1>
              <p className="muted-text setup-guide-lead">{sg.stepSettingsSubtitle}</p>

              <article className="profile-settings-panel setup-guide-basic-card">
                <div className="setup-guide-basic-part">
                  <h3 className="setup-guide-part-title">{sg.languageSectionLabel}</h3>
                  <label className="profile-settings-pref-field">
                    <select
                      value={draftLocale}
                      onChange={(e) => setDraftLocale(e.target.value as AppLocale)}
                      disabled={pushSaving}
                      aria-label={sg.languageSectionLabel}
                    >
                      <option value="zh-Hant">{sg.languageZhLabel}</option>
                      <option value="en">{sg.languageEnLabel}</option>
                    </select>
                  </label>
                </div>

                <div className="setup-guide-basic-part setup-guide-basic-part--split">
                  <h3 className="setup-guide-part-title">{sg.notificationsIntroTitle}</h3>
                  <p className="setup-guide-part-desc">{sg.notificationsIntroDesc}</p>
                  <div className="setup-guide-push-row">
                    <div className="setup-guide-push-row-copy">
                      <span className="setup-guide-push-row-label">{pp.pushMaster}</span>
                      <span className="setup-guide-push-row-desc">{pp.pushMasterDesc}</span>
                    </div>
                    {toggleRow(
                      pushMaster,
                      (next) => {
                        if (next) {
                          void (async () => {
                            await registerPushTokenIfConfigured();
                            await persistWizardPushPrefs({ pushEnabled: true });
                          })();
                        } else {
                          void persistWizardPushPrefs({ pushEnabled: false });
                        }
                      },
                      pp.pushMaster,
                    )}
                  </div>
                </div>
              </article>
            </section>

            <section className="setup-guide-panel" aria-hidden={step !== 2}>
              <h1>{sg.stepHomeTitle}</h1>
              <p className="muted-text setup-guide-lead">{sg.stepHomeSubtitle}</p>
              <ol className="setup-guide-steps-list">
                <li>
                  <span className="setup-guide-step-body">
                    {sg.stepHomeStep1Before}
                    <span className="setup-guide-share-chip">
                      <Share size={16} strokeWidth={2.25} aria-hidden />
                      {sg.stepHomeStep1ShareLabel}
                    </span>
                    {sg.stepHomeStep1After}
                  </span>
                </li>
                <li>
                  <span className="setup-guide-step-body">{sg.stepHomeStep2}</span>
                </li>
              </ol>
              <IosShareSheetMock sg={getStrings(draftLocale).setupGuide} />
              <label className="setup-guide-check">
                <input
                  type="checkbox"
                  className="setup-guide-check-input"
                  checked={homeAck}
                  onChange={(e) => {
                    setHomeAck(e.target.checked);
                    if (e.target.checked) clearTopAlert();
                  }}
                />
                <span className="setup-guide-check-box" aria-hidden />
                <span className="setup-guide-check-label">
                  <span className="setup-guide-required" aria-hidden>
                    *
                  </span>
                  {sg.stepHomeCheckbox}
                </span>
              </label>
              {homeAck && (
                <div className="setup-guide-top-alert" role="note">
                  <p>加到桌面後，請從桌面圖示重新開啟 App，再至「帳號與設定」頁面，關閉再開啟推播總開關，並確認手機系統已允許此 App 傳送通知。</p>
                </div>
              )}
            </section>
          </div>
        </div>

        <div className="setup-guide-dots" role="tablist" aria-label="Setup progress">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span
              key={i}
              role="tab"
              aria-selected={step === i}
              className={`setup-guide-dot${step === i ? ' is-active' : ''}`}
            />
          ))}
        </div>

        <div className="setup-guide-actions">
          {showBackButton ? (
            <button
              type="button"
              className="btn ghost"
              onClick={goBack}
              disabled={finishing || pushSaving || passwordSubmitting}
            >
              {sg.back}
            </button>
          ) : (
            <span className="setup-guide-actions-spacer" />
          )}
          {step < STEP_COUNT - 1 ? (
            <button
              type="button"
              className="btn primary"
              onClick={goNext}
              disabled={step === 0 ? !canNext : false}
            >
              {nextLabel}
            </button>
          ) : (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                if (!homeAck) {
                  setTopAlert(sg.homeRequiredAlert);
                  return;
                }
                void finish();
              }}
              disabled={finishing}
            >
              {finishing ? '…' : sg.finish}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use FirstLoginWizard */
export const SetupGuideWizard = FirstLoginWizard;
