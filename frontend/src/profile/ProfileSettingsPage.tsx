import { useMemo, useState } from 'react';
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
  UserRound,
  Users,
} from 'lucide-react';
import type { Department, Role, ToastState, User } from '../types';
import { ManagerContactDialog } from './ManagerContactDialog';
import { initialsFromName } from './utils';

const DIRECT_PREVIEW = 5;

const ROLE_LABEL: Record<Role, string> = {
  employee: '員工',
  supervisor: '主管',
  admin: '管理員',
};

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
  onNavigateToDirectReportsList,
  onNavigateToSubordinateHistory,
}: {
  user: User;
  departmentName: string;
  allUsers: User[];
  departments: Department[];
  showToast: (t: ToastState) => void;
  onLogout: () => void;
  onNavigateToDirectReportsList: () => void;
  onNavigateToSubordinateHistory: (userId: string) => void;
}) {
  const [managerDialogOpen, setManagerDialogOpen] = useState(false);
  const [pushMaster, setPushMaster] = useState(user.pushEnabled);
  const [pushEmergency, setPushEmergency] = useState(true);
  const [pushStatusReminder, setPushStatusReminder] = useState(true);
  const [pushEscalation, setPushEscalation] = useState(user.pushEnabled);
  const [language, setLanguage] = useState('zh-Hant');
  const [timeZone, setTimeZone] = useState('Asia/Taipei');

  const deptLabel = (id: string) => departments.find((d) => d.id === id)?.name ?? '';

  const manager = useMemo(() => {
    if (!user.managerId) return null;
    return allUsers.find((u) => u.id === user.managerId) ?? null;
  }, [user.managerId, allUsers]);

  const directReports = useMemo(() => allUsers.filter((u) => u.managerId === user.id), [user.id, allUsers]);

  const previewReports = directReports.slice(0, DIRECT_PREVIEW);
  const hasMoreReports = directReports.length > DIRECT_PREVIEW;

  const toggleRow = (checked: boolean, set: (v: boolean) => void) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`profile-settings-switch${checked ? ' is-on' : ''}`}
      onClick={() => set(!checked)}
    />
  );

  return (
    <section className="page-section employee-events-page profile-settings-page">
      <header className="employee-events-hero">
        <div className="employee-events-hero-text">
          <h2 className="employee-events-title">
            <Settings className="employee-events-title-icon" aria-hidden />
            Profile &amp; Settings
          </h2>
          <p className="employee-events-subtitle">管理帳號、通知偏好與組織報告關係。</p>
        </div>
      </header>

      <div className="employee-events-card-list">
        <article className="profile-settings-panel">
          <div className="employee-events-section-intro profile-settings-panel-intro">
            <UserRound className="employee-events-intro-icon" size={22} aria-hidden />
            <div>
              <h3>個人摘要</h3>
              <p>聯絡方式與部門資訊。</p>
            </div>
          </div>
          <div className="profile-settings-summary-grid">
            <div className="profile-settings-summary-avatar-wrap">
              <span className="profile-settings-summary-avatar">{initialsFromName(user.name)}</span>
            </div>
            <div className="profile-settings-summary-fields">
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
            </div>
            <button
              type="button"
              className="btn ghost profile-settings-edit-btn"
              onClick={() => showToast({ tone: 'info', message: '編輯功能於正式版開放' })}
            >
              <Pencil size={16} aria-hidden />
              編輯資料
            </button>
          </div>
        </article>

        <article className="profile-settings-panel">
          <div className="employee-events-section-intro profile-settings-panel-intro">
            <Users className="employee-events-intro-icon" size={22} aria-hidden />
            <div>
              <h3>角色與報告關係</h3>
              <p>您在組織中的角色與上下線。</p>
            </div>
          </div>
          <div className="profile-settings-role-pills">
            {user.roles.map((r) => (
              <span key={r} className={roleBadgeClass(r)}>
                {ROLE_LABEL[r]}
              </span>
            ))}
          </div>

          <div className="profile-settings-subsection">
            <h4 className="profile-settings-subheading">直屬主管</h4>
            {manager ? (
              <ReportingPersonRow
                person={manager}
                departmentLabel={deptLabel(manager.departmentId)}
                onClick={() => setManagerDialogOpen(true)}
              />
            ) : (
              <p className="profile-settings-empty">目前沒有指定直屬主管。</p>
            )}
          </div>

          <div className="profile-settings-subsection profile-settings-subsection--divider">
            <h4 className="profile-settings-subheading">
              直屬部屬
              {directReports.length > 0 ? <span className="employee-events-group-count">{directReports.length}</span> : null}
            </h4>
            {directReports.length === 0 ? (
              <p className="profile-settings-empty">目前沒有直屬部屬。</p>
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
                    查看所有
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
              <h3>通知</h3>
              <p>選擇要接收的提醒類型。</p>
            </div>
          </div>
          <ul className="profile-settings-notify-list">
            <li>
              <div>
                <p className="profile-settings-notify-title">推播總開關</p>
                <p className="profile-settings-notify-desc">接收重要警訊與系統更新。</p>
              </div>
              {toggleRow(pushMaster, (v) => {
                setPushMaster(v);
                showToast({ tone: 'info', message: v ? '已開啟推播（原型）' : '已關閉推播（原型）' });
              })}
            </li>
            <li>
              <div>
                <p className="profile-settings-notify-title">緊急事件警報</p>
                <p className="profile-settings-notify-desc">新事件發布時通知。</p>
              </div>
              {toggleRow(pushEmergency, setPushEmergency)}
            </li>
            <li>
              <div>
                <p className="profile-settings-notify-title">狀態提醒</p>
                <p className="profile-settings-notify-desc">提醒回報安全狀態。</p>
              </div>
              {toggleRow(pushStatusReminder, setPushStatusReminder)}
            </li>
            <li>
              <div>
                <p className="profile-settings-notify-title">升級／團隊更新</p>
                <p className="profile-settings-notify-desc">追蹤待回應與升級流程。</p>
              </div>
              {toggleRow(pushEscalation, setPushEscalation)}
            </li>
          </ul>
        </article>

        <article className="profile-settings-panel">
          <div className="employee-events-section-intro profile-settings-panel-intro">
            <Globe className="employee-events-intro-icon" size={22} aria-hidden />
            <div>
              <h3>偏好與帳號</h3>
              <p>語言、時區與密碼。</p>
            </div>
          </div>
          <div className="profile-settings-pref-grid">
            <label className="profile-settings-pref-field">
              <span>語言</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="zh-Hant">繁體中文</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="profile-settings-pref-field">
              <span>時區</span>
              <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                <option value="Asia/Taipei">Asia/Taipei（UTC+08:00）</option>
                <option value="UTC">UTC</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            className="btn ghost profile-settings-password-btn"
            onClick={() => showToast({ tone: 'info', message: '請聯繫 IT 或於正式版重設密碼' })}
          >
            <Lock size={16} aria-hidden />
            變更密碼
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

      <div className="profile-settings-signout-wrap">
        <button
          type="button"
          className="btn profile-settings-signout"
          onClick={() => {
            onLogout();
          }}
        >
          <LogOut size={16} aria-hidden />
          登出
        </button>
      </div>
    </section>
  );
}
