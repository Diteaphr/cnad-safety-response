import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Building2,
  ChevronRight,
  Globe,
  IdCard,
  Lock,
  Mail,
  Pencil,
  Settings,
  LogOut,
  Phone,
  UserRound,
  Users,
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { useLocale } from '../locale/LocaleContext';
import type { AppLocale } from '../locale/LocaleContext';
import { getStrings, type ProfilePageStrings } from '../locale/strings';
import type { Department, Role, ToastState, User } from '../types';
import { getMyProfileApi, updateMyProfileApi } from '../api';
import { ManagerContactDialog } from './ManagerContactDialog';
import { initialsFromName } from './utils';

const DIRECT_PREVIEW = 5;

function roleDisplay(role: Role, pp: ProfilePageStrings): string {
  if (role === 'employee') return pp.roleEmployee;
  if (role === 'supervisor') return pp.roleSupervisor;
  return pp.roleAdmin;
}

function roleBadgeClass(role: Role): string {
  if (role === 'employee') return 'profile-settings-badge profile-settings-badge--employee';
  if (role === 'supervisor') return 'profile-settings-badge profile-settings-badge--supervisor';
  return 'profile-settings-badge profile-settings-badge--admin';
}

function ReportingPersonRow({
  person,
  departmentLabel,
  onClick,
}: {
  person: User;
  departmentLabel: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="profile-settings-person-avatar" aria-hidden>
        {initialsFromName(person.name)}
      </span>
      <span className="profile-settings-person-meta">
        <span className="profile-settings-person-name">{person.name}</span>
        <span className="profile-settings-person-sub">
          {[person.jobTitle, departmentLabel].filter(Boolean).join(' · ') || departmentLabel}
        </span>
      </span>
      {onClick ? <ChevronRight className="profile-settings-chevron" size={18} aria-hidden /> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="profile-settings-person-row profile-settings-person-row--action" onClick={onClick}>
        {inner}
      </button>
    );
  }

  return <div className="profile-settings-person-row">{inner}</div>;
}

export function ProfileSettingsPage({
  user,
  departmentName,
  allUsers,
  departments,
  showToast,
  onLogout,
  onProfileUpdated,
  onNavigateToDirectReportsList,
  onNavigateToSubordinateHistory,
  offlineMockSession = false,
}: {
  user: User;
  departmentName: string;
  allUsers: User[];
  departments: Department[];
  showToast: (t: ToastState) => void;
  onLogout: () => void;
  onProfileUpdated: (next: User) => void;
  onNavigateToDirectReportsList: () => void;
  onNavigateToSubordinateHistory: (userId: string) => void;
  /** 為 true 時不呼叫 GET/PUT /api/users/me（Demo 靜態資料模式）。 */
  offlineMockSession?: boolean;
}) {
  const { locale, setLocale } = useLocale();
  const profileCopy = getStrings(locale).profile;
  const pp = getStrings(locale).profilePage;
  const [langConfirmOpen, setLangConfirmOpen] = useState(false);
  const [pendingLocale, setPendingLocale] = useState<AppLocale | null>(null);
  const [managerDialogOpen, setManagerDialogOpen] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editPhone, setEditPhone] = useState(user.phone ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [pushMaster, setPushMaster] = useState(user.pushEnabled);
  const [pushEmergency, setPushEmergency] = useState(user.pushEmergencyEnabled ?? true);
  const [pushStatusReminder, setPushStatusReminder] = useState(user.pushReminderEnabled ?? true);
  const [pushEscalation, setPushEscalation] = useState(user.pushEscalationEnabled ?? user.pushEnabled);
  const [timeZone, setTimeZone] = useState('Asia/Taipei');
  const [pushSaving, setPushSaving] = useState(false);

  const onProfileUpdatedRef = useRef(onProfileUpdated);
  onProfileUpdatedRef.current = onProfileUpdated;

  const deptLabel = (id: string) => departments.find((d) => d.id === id)?.name ?? '';

  useEffect(() => {
    if (offlineMockSession) return;
    let cancelled = false;
    void getMyProfileApi()
      .then((next) => {
        if (!cancelled) onProfileUpdatedRef.current(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user.id, offlineMockSession]);

  useEffect(() => {
    setPushMaster(user.pushEnabled);
    setPushEmergency(user.pushEmergencyEnabled ?? true);
    setPushStatusReminder(user.pushReminderEnabled ?? true);
    setPushEscalation(user.pushEscalationEnabled ?? user.pushEnabled);
  }, [
    user.pushEnabled,
    user.pushEmergencyEnabled,
    user.pushReminderEnabled,
    user.pushEscalationEnabled,
  ]);

  useEffect(() => {
    if (!profileEditing) {
      setEditName(user.name);
      setEditPhone(user.phone ?? '');
    }
  }, [user.name, user.phone, profileEditing]);

  const persistNotificationPrefs = async (patch: {
    pushEnabled?: boolean;
    pushEmergencyEnabled?: boolean;
    pushReminderEnabled?: boolean;
    pushEscalationEnabled?: boolean;
  }) => {
    if (pushSaving) return;
    setPushSaving(true);
    try {
      if (offlineMockSession) {
        const updated: User = {
          ...user,
          pushEnabled: patch.pushEnabled ?? pushMaster,
          pushEmergencyEnabled: patch.pushEmergencyEnabled ?? pushEmergency,
          pushReminderEnabled: patch.pushReminderEnabled ?? pushStatusReminder,
          pushEscalationEnabled: patch.pushEscalationEnabled ?? pushEscalation,
        };
        onProfileUpdated(updated);
        setPushMaster(updated.pushEnabled);
        setPushEmergency(updated.pushEmergencyEnabled ?? true);
        setPushStatusReminder(updated.pushReminderEnabled ?? true);
        setPushEscalation(updated.pushEscalationEnabled ?? true);
        return;
      }
      const updated = await updateMyProfileApi({
        name: user.name,
        phone: user.phone?.trim() ? user.phone.trim() : null,
        pushEnabled: patch.pushEnabled ?? pushMaster,
        pushEmergencyEnabled: patch.pushEmergencyEnabled ?? pushEmergency,
        pushReminderEnabled: patch.pushReminderEnabled ?? pushStatusReminder,
        pushEscalationEnabled: patch.pushEscalationEnabled ?? pushEscalation,
      });
      onProfileUpdated(updated);
      setPushMaster(updated.pushEnabled);
      setPushEmergency(updated.pushEmergencyEnabled ?? true);
      setPushStatusReminder(updated.pushReminderEnabled ?? true);
      setPushEscalation(updated.pushEscalationEnabled ?? true);
    } catch (e) {
      showToast({
        tone: 'danger',
        message: e instanceof Error ? e.message : pp.profileSaveError,
      });
    } finally {
      setPushSaving(false);
    }
  };

  const manager = useMemo(() => {
    if (!user.managerId) return null;
    return allUsers.find((u) => u.id === user.managerId) ?? null;
  }, [user.managerId, allUsers]);

  const directReports = useMemo(() => allUsers.filter((u) => u.managerId === user.id), [user.id, allUsers]);

  const previewReports = directReports.slice(0, DIRECT_PREVIEW);
  const hasMoreReports = directReports.length > DIRECT_PREVIEW;

  const toggleRow = (checked: boolean, onToggle: (next: boolean) => void) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={pushSaving}
      className={`profile-settings-switch${checked ? ' is-on' : ''}`}
      onClick={() => {
        if (pushSaving) return;
        onToggle(!checked);
      }}
    />
  );

  return (
    <section className="page-section employee-events-page profile-settings-page">
      <header className="employee-events-hero">
        <div className="employee-events-hero-text">
          <h2 className="employee-events-title">
            <Settings className="employee-events-title-icon" aria-hidden />
            {pp.pageTitle}
          </h2>
          <p className="employee-events-subtitle">{pp.pageSubtitle}</p>
        </div>
      </header>

      <div className="employee-events-card-list">
        <article className="profile-settings-panel">
          <div className="employee-events-section-intro profile-settings-panel-intro">
            <UserRound className="employee-events-intro-icon" size={22} aria-hidden />
            <div>
              <h3>{pp.personalSummary}</h3>
              <p>{pp.personalSummaryDesc}</p>
            </div>
          </div>
          <div className="profile-settings-summary-grid">
            <div className="profile-settings-summary-avatar-wrap">
              <span className="profile-settings-summary-avatar">{initialsFromName(user.name)}</span>
            </div>
            <div className="profile-settings-summary-fields">
              {profileEditing ? (
                <div className="profile-settings-edit-form">
                  <label className="event-form-field">
                    <span className="event-form-field-label">{pp.profileEditNameLabel}</span>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} autoComplete="name" disabled={profileSaving} />
                  </label>
                  <label className="event-form-field">
                    <span className="event-form-field-label">{pp.profileEditPhoneLabel}</span>
                    <input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      inputMode="tel"
                      autoComplete="tel"
                      disabled={profileSaving}
                      placeholder={pp.onboardingPhonePlaceholder}
                    />
                  </label>
                  <p className="muted-text" style={{ fontSize: '0.82rem' }}>
                    {pp.profileEditPhoneHint}
                  </p>
                  <div className="row-actions" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={profileSaving || !editName.trim()}
                      onClick={() => void (async () => {
                        const name = editName.trim();
                        if (!name) return;
                        setProfileSaving(true);
                        try {
                          if (offlineMockSession) {
                            const next: User = {
                              ...user,
                              name,
                              phone: editPhone.trim() ? editPhone.trim() : undefined,
                              pushEnabled: pushMaster,
                              pushEmergencyEnabled: pushEmergency,
                              pushReminderEnabled: pushStatusReminder,
                              pushEscalationEnabled: pushEscalation,
                            };
                            onProfileUpdated(next);
                            setProfileEditing(false);
                            showToast({ tone: 'success', message: pp.profileUpdatedToast });
                            return;
                          }
                          const next = await updateMyProfileApi({
                            name,
                            phone: editPhone.trim() ? editPhone.trim() : null,
                            pushEnabled: pushMaster,
                            pushEmergencyEnabled: pushEmergency,
                            pushReminderEnabled: pushStatusReminder,
                            pushEscalationEnabled: pushEscalation,
                          });
                          onProfileUpdated(next);
                          setProfileEditing(false);
                          showToast({ tone: 'success', message: pp.profileUpdatedToast });
                        } catch (e) {
                          showToast({
                            tone: 'danger',
                            message: e instanceof Error ? e.message : pp.profileSaveError,
                          });
                        } finally {
                          setProfileSaving(false);
                        }
                      })()}
                    >
                      {profileSaving ? '…' : pp.profileSave}
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={profileSaving}
                      onClick={() => {
                        setProfileEditing(false);
                        setEditName(user.name);
                        setEditPhone(user.phone ?? '');
                      }}
                    >
                      {pp.profileCancelEdit}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="profile-settings-summary-name">{user.name}</p>
                  <p className="profile-settings-summary-line">
                    <Mail size={14} aria-hidden />
                    {user.email}
                  </p>
                  <p className="profile-settings-summary-line">
                    <Building2 size={14} aria-hidden />
                    {departmentName}
                  </p>
                  <p className="profile-settings-summary-line">
                    <IdCard size={14} aria-hidden />
                    {user.employeeCode ?? user.id.toUpperCase()}
                  </p>
                  <p className="profile-settings-summary-line">
                    <Phone size={14} aria-hidden />
                    {user.phone?.trim() ? user.phone : <span className="muted-text">—</span>}
                  </p>
                </>
              )}
            </div>
            {!profileEditing ? (
              <button
                type="button"
                className="btn ghost profile-settings-edit-btn"
                onClick={() => {
                  setEditName(user.name);
                  setEditPhone(user.phone ?? '');
                  setProfileEditing(true);
                }}
              >
                <Pencil size={16} aria-hidden />
                {pp.editProfile}
              </button>
            ) : null}
          </div>
        </article>

        <article className="profile-settings-panel">
          <div className="employee-events-section-intro profile-settings-panel-intro">
            <Users className="employee-events-intro-icon" size={22} aria-hidden />
            <div>
              <h3>{pp.rolesSection}</h3>
              <p>{pp.rolesSectionDesc}</p>
            </div>
          </div>
          <div className="profile-settings-role-pills">
            {user.roles.map((r) => (
              <span key={r} className={roleBadgeClass(r)}>
                {roleDisplay(r, pp)}
              </span>
            ))}
          </div>

          <div className="profile-settings-subsection">
            <h4 className="profile-settings-subheading">{pp.directManager}</h4>
            {manager ? (
              <ReportingPersonRow
                person={manager}
                departmentLabel={deptLabel(manager.departmentId)}
                onClick={() => setManagerDialogOpen(true)}
              />
            ) : (
              <p className="profile-settings-empty">{pp.noManager}</p>
            )}
          </div>

          <div className="profile-settings-subsection profile-settings-subsection--divider">
            <h4 className="profile-settings-subheading">
              {pp.directReports}
              {directReports.length > 0 ? <span className="employee-events-group-count">{directReports.length}</span> : null}
            </h4>
            {directReports.length === 0 ? (
              <p className="profile-settings-empty">{pp.noReports}</p>
            ) : (
              <>
                <div className="profile-settings-person-stack">
                  {previewReports.map((rep) => (
                    <ReportingPersonRow
                      key={rep.id}
                      person={rep}
                      departmentLabel={deptLabel(rep.departmentId)}
                      onClick={() => onNavigateToSubordinateHistory(rep.id)}
                    />
                  ))}
                </div>
                {hasMoreReports ? (
                  <button type="button" className="profile-settings-see-all btn ghost" onClick={onNavigateToDirectReportsList}>
                    {pp.seeAll}
                    <ChevronRight size={16} aria-hidden />
                  </button>
                ) : null}
              </>
            )}
          </div>
        </article>

        <article className="profile-settings-panel">
          <div className="employee-events-section-intro profile-settings-panel-intro">
            <Bell className="employee-events-intro-icon" size={22} aria-hidden />
            <div>
              <h3>{pp.notificationsSection}</h3>
              <p>{pp.notificationsSectionDesc}</p>
            </div>
          </div>
          <ul className="profile-settings-notify-list">
            <li>
              <div>
                <p className="profile-settings-notify-title">{pp.pushMaster}</p>
                <p className="profile-settings-notify-desc">{pp.pushMasterDesc}</p>
              </div>
              {toggleRow(pushMaster, (next) => {
                void persistNotificationPrefs({ pushEnabled: next });
              })}
            </li>
            <li>
              <div>
                <p className="profile-settings-notify-title">{pp.pushEmergency}</p>
                <p className="profile-settings-notify-desc">{pp.pushEmergencyDesc}</p>
              </div>
              {toggleRow(pushEmergency, (next) => {
                void persistNotificationPrefs({ pushEmergencyEnabled: next });
              })}
            </li>
            <li>
              <div>
                <p className="profile-settings-notify-title">{pp.pushReminder}</p>
                <p className="profile-settings-notify-desc">{pp.pushReminderDesc}</p>
              </div>
              {toggleRow(pushStatusReminder, (next) => {
                void persistNotificationPrefs({ pushReminderEnabled: next });
              })}
            </li>
            <li>
              <div>
                <p className="profile-settings-notify-title">{pp.pushEscalation}</p>
                <p className="profile-settings-notify-desc">{pp.pushEscalationDesc}</p>
              </div>
              {toggleRow(pushEscalation, (next) => {
                void persistNotificationPrefs({ pushEscalationEnabled: next });
              })}
            </li>
          </ul>
        </article>

        <article className="profile-settings-panel">
          <div className="employee-events-section-intro profile-settings-panel-intro">
            <Globe className="employee-events-intro-icon" size={22} aria-hidden />
            <div>
              <h3>{pp.prefsSection}</h3>
              <p>{pp.prefsSectionDesc}</p>
            </div>
          </div>
          <div className="profile-settings-pref-grid">
            <label className="profile-settings-pref-field">
              <span>{pp.languageLabel}</span>
              <select
                value={locale}
                onChange={(e) => {
                  const v = e.target.value as AppLocale;
                  if (v !== locale) {
                    setPendingLocale(v);
                    setLangConfirmOpen(true);
                  }
                }}
              >
                <option value="zh-Hant">繁體中文</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="profile-settings-pref-field">
              <span>{pp.timeZoneLabel}</span>
              <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                <option value="Asia/Taipei">{pp.timezoneTaipei}</option>
                <option value="UTC">{pp.timezoneUtc}</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            className="btn ghost profile-settings-password-btn"
            onClick={() => showToast({ tone: 'info', message: pp.toastPasswordSoon })}
          >
            <Lock size={16} aria-hidden />
            {pp.changePassword}
          </button>
        </article>
      </div>

      {manager ? (
        <ManagerContactDialog
          manager={manager}
          open={managerDialogOpen}
          onClose={() => setManagerDialogOpen(false)}
          showToast={showToast}
        />
      ) : null}

      <ConfirmModal
        open={langConfirmOpen && pendingLocale !== null}
        title={profileCopy.languageConfirmTitle}
        description={pendingLocale ? profileCopy.languageConfirmBody(pendingLocale) : ''}
        cancelText={profileCopy.cancel}
        confirmText={profileCopy.confirm}
        confirmTone="primary"
        onCancel={() => {
          setLangConfirmOpen(false);
          setPendingLocale(null);
        }}
        onConfirm={() => {
          const next = pendingLocale;
          if (next) {
            setLocale(next);
            showToast({
              tone: 'info',
              message: getStrings(next).profilePage.languageApplied,
            });
          }
          setLangConfirmOpen(false);
          setPendingLocale(null);
        }}
      />

      <div className="profile-settings-signout-wrap">
        <button
          type="button"
          className="btn profile-settings-signout"
          onClick={() => {
            onLogout();
          }}
        >
          <LogOut size={16} aria-hidden />
          {pp.signOut}
        </button>
      </div>
    </section>
  );
}
