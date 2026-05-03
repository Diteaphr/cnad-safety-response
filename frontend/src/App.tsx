import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CloudUpload,
  FileImage,
  Flame,
  Filter,
  Headphones,
  Hourglass,
  Info,
  LifeBuoy,
  MapPin,
  MessageSquare,
  Package,
  Paperclip,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Wind,
} from 'lucide-react';
import { ConfirmModal } from './components/ConfirmModal';
import { EmployeeTable } from './components/EmployeeTable';
import { EventCard } from './components/EventCard';
import { Layout } from './components/Layout';
import { StatCard } from './components/StatCard';
import { StatusBadge } from './components/StatusBadge';
import { Toast } from './components/Toast';
import { DirectReportEventHistoryPage } from './profile/DirectReportEventHistoryPage';
import { DirectReportsListPage } from './profile/DirectReportsListPage';
import { ProfileSettingsPage } from './profile/ProfileSettingsPage';
import {
  activateEventApi,
  clearAccessToken,
  closeEventApi,
  createEventApi,
  demoAccountsFallbackSeeded,
  getDemoAccounts,
  getDepartments,
  getEvents,
  getReports,
  getUsers,
  loginWithEmailApi,
  registerApi,
  submitReportApi,
  type DemoAccount,
} from './api';
import { notificationSummary } from './mockData';
import type { Department, EventItem, NavKey, Role, SafetyResponse, ToastState, User } from './types';

type AuthMode = 'login' | 'register';

interface SessionState {
  isLoggedIn: boolean;
  user: User | null;
  availableRoles: Role[];
  currentRole: Role | null;
}

const roleDefaultNav: Record<Role, NavKey> = {
  employee: 'employee-home',
  supervisor: 'supervisor-dashboard',
  admin: 'admin-dashboard',
};

function App() {
  const [session, setSession] = useState<SessionState>({ isLoggedIn: false, user: null, availableRoles: [], currentRole: null });
  const [navKey, setNavKey] = useState<NavKey>('employee-home');
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [responses, setResponses] = useState<SafetyResponse[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [profileSubordinateUserId, setProfileSubordinateUserId] = useState<string | null>(null);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [eventToActivate, setEventToActivate] = useState<string | null>(null);
  const [selectedEmployeeEventId, setSelectedEmployeeEventId] = useState('');
  const [selectedSupervisorEventId, setSelectedSupervisorEventId] = useState('');
  const [selectedAdminEventId, setSelectedAdminEventId] = useState('');
  const [selectedNotificationEventId, setSelectedNotificationEventId] = useState('');
  const eventsSelectionInitialized = useRef(false);

  const demoAccountsForLogin = useMemo(
    () => (demoAccounts.length > 0 ? demoAccounts : demoAccountsFallbackSeeded),
    [demoAccounts],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setCatalogError(null);
        const [accounts, deptRows, userRows, evRows, respRows] = await Promise.all([
          getDemoAccounts(),
          getDepartments(),
          getUsers(),
          getEvents(),
          getReports(),
        ]);
        if (cancelled) return;
        setDemoAccounts(accounts);
        setDepartments(deptRows);
        setUsers(userRows);
        setEvents(evRows);
        setResponses(respRows);
        setCatalogLoaded(true);
      } catch (e) {
        if (!cancelled) {
          setCatalogError(e instanceof Error ? e.message : '無法載入資料');
          setCatalogLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (events.length === 0) return;
    if (eventsSelectionInitialized.current) return;
    eventsSelectionInitialized.current = true;
    const id = events.find((e) => e.status === 'active')?.id ?? events[0].id;
    setSelectedEmployeeEventId(id);
    setSelectedSupervisorEventId(id);
    setSelectedAdminEventId(id);
    setSelectedNotificationEventId(id);
  }, [events]);
  const [employeeEventFilter, setEmployeeEventFilter] = useState<'ongoing' | 'closed'>('ongoing');
  const [employeeListSearch, setEmployeeListSearch] = useState('');
  const [employeeComment, setEmployeeComment] = useState('');
  const [employeeLocation, setEmployeeLocation] = useState('');
  const [employeeAttachment, setEmployeeAttachment] = useState<File | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'safe' | 'need_help'>('all');
  const [supervisorFilter, setSupervisorFilter] = useState<'all' | 'safe' | 'need_help' | 'pending'>('all');
  const [searchText, setSearchText] = useState('');
  const [eventForm, setEventForm] = useState({
    title: '',
    type: 'Earthquake' as EventItem['type'],
    customType: '',
    description: '',
    startAt: new Date().toISOString().slice(0, 16),
  });

  const employeeDeptId = session.user?.departmentId;

  const employeeAccessibleEvents = useMemo(() => {
    if (!employeeDeptId) return [];
    return events.filter((event) => event.status !== 'draft' && event.targetDepartmentIds.includes(employeeDeptId));
  }, [events, employeeDeptId]);

  const employeeTabCounts = useMemo(
    () => ({
      ongoing: employeeAccessibleEvents.filter((e) => e.status === 'active').length,
      closed: employeeAccessibleEvents.filter((e) => e.status === 'closed').length,
    }),
    [employeeAccessibleEvents],
  );

  const employeeListRows = useMemo(() => {
    const uid = session.user?.id;
    if (!uid || !employeeDeptId) return [];
    const tabStatus = employeeEventFilter === 'ongoing' ? 'active' : 'closed';
    let list = employeeAccessibleEvents.filter((e) => e.status === tabStatus);
    const q = employeeListSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const hay = `${e.title} ${e.type} ${e.description} ${e.cardDepartment ?? ''} ${e.venue ?? ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    const enriched = list.map((event) => ({
      event,
      latest: responses
        .filter((r) => r.eventId === event.id && r.userId === uid)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0],
    }));

    if (employeeEventFilter === 'ongoing') {
      enriched.sort((a, b) => {
        const ap = a.latest ? 1 : 0;
        const bp = b.latest ? 1 : 0;
        if (ap !== bp) return ap - bp;
        return new Date(b.event.startAt).getTime() - new Date(a.event.startAt).getTime();
      });
    } else {
      enriched.sort((a, b) => new Date(b.event.startAt).getTime() - new Date(a.event.startAt).getTime());
    }
    return enriched;
  }, [
    employeeAccessibleEvents,
    employeeDeptId,
    employeeEventFilter,
    employeeListSearch,
    responses,
    session.user?.id,
  ]);
  const selectedEmployeeEvent = useMemo(
    () => events.find((event) => event.id === selectedEmployeeEventId) ?? null,
    [events, selectedEmployeeEventId],
  );
  const selectedSupervisorEvent = useMemo(
    () => events.find((event) => event.id === selectedSupervisorEventId) ?? null,
    [events, selectedSupervisorEventId],
  );
  const selectedAdminEvent = useMemo(
    () => events.find((event) => event.id === selectedAdminEventId) ?? null,
    [events, selectedAdminEventId],
  );
  const currentDepartment = useMemo(
    () => departments.find((d) => d.id === session.user?.departmentId)?.name ?? 'Unknown',
    [session.user],
  );

  const profileDirectReportIds = useMemo(() => {
    const uid = session.user?.id;
    if (!uid) return new Set<string>();
    return new Set(users.filter((u) => u.managerId === uid).map((u) => u.id));
  }, [session.user?.id]);

  const profileDirectReports = useMemo(() => {
    const uid = session.user?.id;
    if (!uid) return [];
    return users.filter((u) => u.managerId === uid);
  }, [session.user?.id]);

  const profileHistorySubordinate = useMemo(
    () => (profileSubordinateUserId ? users.find((u) => u.id === profileSubordinateUserId) ?? null : null),
    [profileSubordinateUserId],
  );

  useEffect(() => {
    const profileFamily = ['profile', 'profile-direct-reports-list', 'profile-direct-report-history'];
    if (!profileFamily.includes(navKey)) setProfileSubordinateUserId(null);
  }, [navKey]);

  useEffect(() => {
    if (!session.user?.id) return;
    if (navKey === 'profile-direct-reports-list' && profileDirectReportIds.size === 0) setNavKey('profile');
    if (navKey === 'profile-direct-report-history') {
      if (!profileSubordinateUserId || !profileDirectReportIds.has(profileSubordinateUserId)) {
        setProfileSubordinateUserId(null);
        setNavKey('profile');
      }
    }
  }, [navKey, session.user?.id, profileSubordinateUserId, profileDirectReportIds]);

  const employeeRows = useMemo(() => {
    if (!selectedSupervisorEvent && !selectedAdminEvent) return [];
    const eventId = session.currentRole === 'admin' ? selectedAdminEvent?.id : selectedSupervisorEvent?.id;
    if (!eventId) return [];
    const supervisorSubordinates = users
      .filter((user) => user.managerId === session.user?.id)
      .map((user) => user.id);
    return users
      .filter((u) => (session.currentRole === 'admin' ? true : supervisorSubordinates.includes(u.id)))
      .map((u) => {
        const latest = responses
          .filter((r) => r.eventId === eventId && r.userId === u.id)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        return {
          id: u.id,
          name: u.name,
          department: departments.find((d) => d.id === u.departmentId)?.name ?? '-',
          status: latest?.status ?? 'pending',
          updatedAt: latest?.updatedAt,
          note: latest?.comment,
        };
      });
  }, [selectedSupervisorEvent, selectedAdminEvent, responses, session.currentRole, session.user?.id]);

  const stats = useMemo(() => {
    const total = employeeRows.length;
    const safe = employeeRows.filter((row) => row.status === 'safe').length;
    const needHelp = employeeRows.filter((row) => row.status === 'need_help').length;
    const pending = total - safe - needHelp;
    const responseRate = total ? Math.round(((safe + needHelp) / total) * 100) : 0;
    return { total, safe, needHelp, pending, responseRate };
  }, [employeeRows]);

  const showToast = (next: ToastState) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 2200);
  };

  const handleLogin = (demoId: string) => {
    clearAccessToken();
    const account = demoAccountsForLogin.find((item) => item.id === demoId);
    if (!account) return;
    const selectedUser = users.find((u) => u.id === account.userId);
    if (!selectedUser) {
      showToast({
        tone: 'danger',
        message: '載入使用者清單後才能 Demo 登入。請確認 /api/users 可走通並重新整理頁面。',
      });
      return;
    }
    const initialRole = account.roles[0];
    setSession({
      isLoggedIn: true,
      user: selectedUser,
      availableRoles: account.roles,
      currentRole: account.roles.length === 1 ? initialRole : null,
    });
    setNavKey(roleDefaultNav[initialRole]);
  };

  const mergeUserIntoList = (user: User) => {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === user.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = user;
        return next;
      }
      return [...prev, user];
    });
  };

  const handleEmailLogin = async (email: string, password: string) => {
    const { user } = await loginWithEmailApi({ email, password });
    mergeUserIntoList(user);
    const roles = user.roles;
    const initialRole = roles[0];
    setSession({
      isLoggedIn: true,
      user,
      availableRoles: roles,
      currentRole: roles.length === 1 ? initialRole : null,
    });
    setNavKey(roleDefaultNav[initialRole]);
  };

  const pickRole = (role: Role) => {
    setSession((prev) => ({ ...prev, currentRole: role }));
    setNavKey(roleDefaultNav[role]);
  };

  const logout = () => {
    clearAccessToken();
    setSession({ isLoggedIn: false, user: null, availableRoles: [], currentRole: null });
    showToast({ tone: 'info', message: 'Logged out.' });
  };

  const submitEmployeeStatus = async (status: 'safe' | 'need_help', meta?: { omitStoredAttachment?: boolean }) => {
    if (!selectedEmployeeEvent || !session.user) return;
    const uid = session.user.id;
    const eid = selectedEmployeeEvent.id;
    const prior = responses
      .filter((r) => r.eventId === eid && r.userId === uid)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
    const keepPriorAttach = !(meta?.omitStoredAttachment ?? false);
    try {
      const out = await submitReportApi({
        eventId: eid,
        userId: uid,
        status,
        comment: employeeComment.trim() || undefined,
        location: employeeLocation.trim() || undefined,
      });
      const raw = out.data;
      const nextResponse: SafetyResponse = {
        ...raw,
        attachmentName: employeeAttachment?.name ?? (keepPriorAttach ? prior?.attachmentName : undefined) ?? raw.attachmentName,
        attachmentSizeBytes: employeeAttachment?.size ?? (keepPriorAttach ? prior?.attachmentSizeBytes : undefined) ?? raw.attachmentSizeBytes,
      };
      setResponses((prev) => [
        ...prev.filter((r) => !(r.eventId === nextResponse.eventId && r.userId === nextResponse.userId)),
        nextResponse,
      ]);
      showToast({ tone: 'success', message: `Report received at ${new Date(nextResponse.updatedAt).toLocaleTimeString()}` });
    } catch (e) {
      showToast({ tone: 'danger', message: e instanceof Error ? e.message : '送出失敗' });
    }
  };

  const createEvent = async () => {
    if (!session.user) return;
    const type = eventForm.type === 'Other' && eventForm.customType.trim() ? ('Other' as EventItem['type']) : eventForm.type;
    try {
      const out = await createEventApi(session.user.id, {
        title: eventForm.title || 'Untitled Event',
        type,
        description: eventForm.description,
        startAt: new Date(eventForm.startAt).toISOString(),
        targetDepartmentIds: departments.map((d) => d.id),
      });
      setEvents((prev) => [out.event, ...prev]);
      showToast({ tone: 'success', message: 'Event template saved. You can activate it when an incident starts.' });
    } catch (e) {
      showToast({ tone: 'danger', message: e instanceof Error ? e.message : '建立失敗' });
    }
  };

  const requestActivateEvent = (eventId: string) => {
    setEventToActivate(eventId);
    setShowActivateModal(true);
  };

  const activateEvent = async () => {
    if (!eventToActivate || !session.user) return;
    try {
      const out = await activateEventApi(session.user.id, eventToActivate);
      const fresh = await getEvents();
      setEvents(fresh);
      const updated = fresh.find((e) => e.id === out.event.id);
      if (updated) {
        setSelectedAdminEventId(updated.id);
        setSelectedSupervisorEventId(updated.id);
      }
      setShowActivateModal(false);
      setEventToActivate(null);
      showToast({ tone: 'warning', message: 'Event activated. Notifications will be sent to target users.' });
    } catch (e) {
      showToast({ tone: 'danger', message: e instanceof Error ? e.message : '啟用失敗' });
    }
  };

  const closeEvent = async (eventId: string) => {
    if (!session.user) return;
    try {
      await closeEventApi(session.user.id, eventId);
      const fresh = await getEvents();
      setEvents(fresh);
      showToast({ tone: 'info', message: 'Event closed.' });
    } catch (e) {
      showToast({ tone: 'danger', message: e instanceof Error ? e.message : '關閉失敗' });
    }
  };

  const selectedEventNotificationStats = useMemo(() => {
    const relatedReports = responses.filter((response) => response.eventId === selectedNotificationEventId);
    const targetedUsers = users.filter((user) =>
      (events.find((event) => event.id === selectedNotificationEventId)?.targetDepartmentIds ?? []).includes(user.departmentId),
    );
    const pushSent = targetedUsers.length;
    const pushFailed = Math.max(0, targetedUsers.length - relatedReports.length);
    const smsFallbackSent = Math.floor(pushFailed * 0.7);
    return { pushSent, pushFailed, smsFallbackSent };
  }, [responses, selectedNotificationEventId, events]);

  if (!session.isLoggedIn) {
    if (authMode === 'register') {
      return (
        <RegisterPage
          departments={departments}
          loading={!catalogLoaded}
          error={catalogError}
          onRegisterSuccess={(user) => {
            mergeUserIntoList(user);
            const roles = user.roles;
            const initialRole = roles[0];
            setSession({
              isLoggedIn: true,
              user,
              availableRoles: roles,
              currentRole: roles.length === 1 ? initialRole : null,
            });
            setNavKey(roleDefaultNav[initialRole]);
            setAuthMode('login');
          }}
          onBack={() => setAuthMode('login')}
        />
      );
    }
    return (
      <LoginPage
        accounts={demoAccountsForLogin}
        loading={!catalogLoaded}
        error={catalogError}
        onLogin={handleLogin}
        onEmailLogin={handleEmailLogin}
        onGoRegister={() => setAuthMode('register')}
      />
    );
  }

  if (!session.currentRole) {
    return <RoleSelectionPage roles={session.availableRoles} onPickRole={pickRole} />;
  }

  return (
    <>
      <Layout
        currentRole={session.currentRole}
        roleOptions={session.availableRoles}
        currentNav={
          navKey === 'employee-event-detail'
            ? 'employee-home'
            : navKey === 'supervisor-event-detail'
              ? 'supervisor-dashboard'
              : navKey === 'admin-event-detail'
                ? 'admin-dashboard'
                : navKey === 'notifications-event-detail'
                  ? 'notifications'
                  : navKey === 'profile-direct-reports-list' || navKey === 'profile-direct-report-history'
                    ? 'profile'
                    : navKey
        }
        onSwitchRole={pickRole}
        onSwitchNav={setNavKey}
        onLogout={logout}
      >
        {navKey === 'employee-home' && (
          <EmployeeEventListPage
            rows={employeeListRows}
            selectedEventId={selectedEmployeeEventId}
            onSelectEvent={(eventId) => {
              setSelectedEmployeeEventId(eventId);
              setNavKey('employee-event-detail');
            }}
            employeeEventFilter={employeeEventFilter}
            setEmployeeEventFilter={setEmployeeEventFilter}
            ongoingCount={employeeTabCounts.ongoing}
            closedCount={employeeTabCounts.closed}
            searchQuery={employeeListSearch}
            setSearchQuery={setEmployeeListSearch}
          />
        )}
        {navKey === 'employee-event-detail' && (
          <EmployeeHomePage
            userName={session.user?.name ?? ''}
            selectedEvent={selectedEmployeeEvent}
            currentDepartment={currentDepartment}
            latestResponse={responses
              .filter((r) => r.userId === session.user?.id && r.eventId === selectedEmployeeEvent?.id)
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]}
            employeeComment={employeeComment}
            setEmployeeComment={setEmployeeComment}
            employeeLocation={employeeLocation}
            setEmployeeLocation={setEmployeeLocation}
            employeeAttachment={employeeAttachment}
            setEmployeeAttachment={setEmployeeAttachment}
            onSubmit={submitEmployeeStatus}
            onBackToEvents={() => setNavKey('employee-home')}
          />
        )}
        {navKey === 'employee-history' && (
          <EmployeeHistoryPage
            responses={responses.filter((r) => r.userId === session.user?.id)}
            events={events}
            filter={historyFilter}
            setFilter={setHistoryFilter}
          />
        )}
        {navKey === 'supervisor-dashboard' && (
          <EventSelectionPage
            title="Supervisor Event Center"
            events={events.filter((event) => event.status !== 'draft')}
            selectedEventId={selectedSupervisorEventId}
            onSelectEvent={(eventId) => {
              setSelectedSupervisorEventId(eventId);
              setNavKey('supervisor-event-detail');
            }}
          />
        )}
        {navKey === 'supervisor-event-detail' && (
          <SupervisorDashboardPage
            stats={stats}
            rows={employeeRows}
            filter={supervisorFilter}
            setFilter={setSupervisorFilter}
            searchText={searchText}
            setSearchText={setSearchText}
            onSendReminder={() => showToast({ tone: 'warning', message: 'Reminder sent to non-responders.' })}
            onExport={() => showToast({ tone: 'info', message: 'Report exported and email queued.' })}
            onBackToEvents={() => setNavKey('supervisor-dashboard')}
          />
        )}
        {navKey === 'admin-dashboard' && (
          <EventSelectionPage
            title="Admin Global Event Center"
            events={events}
            selectedEventId={selectedAdminEventId}
            onSelectEvent={(eventId) => {
              setSelectedAdminEventId(eventId);
              setNavKey('admin-event-detail');
            }}
          />
        )}
        {navKey === 'admin-event-detail' && (
          <AdminDashboardPage
            stats={stats}
            rows={employeeRows}
            departments={departments}
            onBackToEvents={() => setNavKey('admin-dashboard')}
          />
        )}
        {navKey === 'event-management' && (
          <EventManagementPage
            events={events}
            eventForm={eventForm}
            setEventForm={setEventForm}
            onCreateEvent={createEvent}
            onActivate={requestActivateEvent}
            onClose={closeEvent}
          />
        )}
        {navKey === 'user-management' && <UserManagementPage users={users} departments={departments} />}
        {navKey === 'notifications' && (
          <EventSelectionPage
            title="Notification Event Center"
            events={events}
            selectedEventId={selectedNotificationEventId}
            onSelectEvent={(eventId) => {
              setSelectedNotificationEventId(eventId);
              setNavKey('notifications-event-detail');
            }}
          />
        )}
        {navKey === 'notifications-event-detail' && (
          <NotificationPage
            selectedEventStats={selectedEventNotificationStats}
            summary={notificationSummary}
            onSendReminder={() => showToast({ tone: 'warning', message: 'Manual reminder sent.' })}
            onBackToEvents={() => setNavKey('notifications')}
          />
        )}
        {navKey === 'profile' && (
          <ProfileSettingsPage
            user={session.user!}
            departmentName={currentDepartment}
            allUsers={users}
            departments={departments}
            showToast={showToast}
            onLogout={logout}
            onNavigateToDirectReportsList={() => setNavKey('profile-direct-reports-list')}
            onNavigateToSubordinateHistory={(userId) => {
              setProfileSubordinateUserId(userId);
              setNavKey('profile-direct-report-history');
            }}
          />
        )}
        {navKey === 'profile-direct-reports-list' && (
          <DirectReportsListPage
            directReports={profileDirectReports}
            departments={departments}
            onBack={() => setNavKey('profile')}
            onSelectSubordinate={(userId) => {
              setProfileSubordinateUserId(userId);
              setNavKey('profile-direct-report-history');
            }}
          />
        )}
        {navKey === 'profile-direct-report-history' && profileHistorySubordinate ? (
          <DirectReportEventHistoryPage
            subordinate={profileHistorySubordinate}
            events={events}
            responses={responses}
            onBack={() => {
              setProfileSubordinateUserId(null);
              setNavKey('profile');
            }}
          />
        ) : null}
      </Layout>

      <ConfirmModal
        open={showActivateModal}
        title="Activate Emergency Event?"
        description="Activating this event will send push notifications immediately to targeted departments."
        confirmText="Activate and Send"
        onCancel={() => setShowActivateModal(false)}
        onConfirm={activateEvent}
      />
      <Toast toast={toast} />
    </>
  );
}

function LoginPage({
  accounts,
  loading,
  error,
  onLogin,
  onEmailLogin,
  onGoRegister,
}: {
  accounts: DemoAccount[];
  loading: boolean;
  error: string | null;
  onLogin: (demoId: string) => void;
  onEmailLogin: (email: string, password: string) => Promise<void>;
  onGoRegister: () => void;
}) {
  const [demoId, setDemoId] = useState('employee');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoginError, setEmailLoginError] = useState<string | null>(null);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const submitEmail = async () => {
    setEmailLoginError(null);
    setEmailSubmitting(true);
    try {
      await onEmailLogin(email.trim(), password);
    } catch (e) {
      setEmailLoginError(e instanceof Error ? e.message : '登入失敗');
    } finally {
      setEmailSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Employee Safety & Response</h1>
        <p>Emergency safety reporting and command dashboard.</p>
        {loading && <p className="muted-text">載入後端資料…</p>}
        {error && <p className="muted-text" style={{ color: 'var(--danger, #c0392b)' }}>{error}</p>}

        <h2 className="auth-section-title">使用 Email 登入</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          disabled={loading}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={loading}
        />
        {emailLoginError ? <p className="auth-inline-error">{emailLoginError}</p> : null}
        <button
          className="btn primary"
          onClick={() => void submitEmail()}
          type="button"
          disabled={loading || emailSubmitting || !email.trim() || !password}
        >
          {emailSubmitting ? '登入中…' : 'Sign in'}
        </button>
        <p className="auth-footnote">
          還沒有帳號？{' '}
          <button type="button" className="auth-link" onClick={onGoRegister} disabled={loading}>
            建立帳號
          </button>
        </p>

        <hr className="auth-divider" />
        <h2 className="auth-section-title">Demo（原型）</h2>
        <label>
          Prototype Role Selector
          <select value={demoId} onChange={(e) => setDemoId(e.target.value)} disabled={loading || accounts.length === 0}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn ghost"
          onClick={() => onLogin(demoId)}
          type="button"
          disabled={loading || accounts.length === 0}
        >
          Login with demo role
        </button>
      </div>
    </div>
  );
}

function RegisterPage({
  departments,
  loading,
  error,
  onRegisterSuccess,
  onBack,
}: {
  departments: Department[];
  loading: boolean;
  error: string | null;
  onRegisterSuccess: (user: User) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeNo, setEmployeeNo] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setFormError(null);
    if (password.length < 8) {
      setFormError('密碼至少 8 個字元');
      return;
    }
    if (password !== confirm) {
      setFormError('兩次輸入的密碼不一致');
      return;
    }
    setSubmitting(true);
    try {
      await registerApi({
        name: name.trim(),
        email: email.trim(),
        password,
        departmentId: departmentId || undefined,
        phone: phone.trim() || undefined,
        employeeNo: employeeNo.trim() || undefined,
      });
      const loginOut = await loginWithEmailApi({ email: email.trim(), password });
      onRegisterSuccess(loginOut.user);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '註冊失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <button type="button" className="btn ghost auth-back" onClick={onBack}>
          ← 返回登入
        </button>
        <h1>建立帳號</h1>
        <p className="muted-text">註冊後將以一般員工身分登入（employee）。主管／管理員由後台指派。</p>
        {loading && <p className="muted-text">載入後端資料…</p>}
        {error && <p className="muted-text" style={{ color: 'var(--danger, #c0392b)' }}>{error}</p>}
        <input placeholder="姓名" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          disabled={loading}
        />
        <input
          placeholder="密碼（至少 8 字）"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          disabled={loading}
        />
        <input
          placeholder="確認密碼"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          disabled={loading}
        />
        <label>
          部門（選填）
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={loading}>
            <option value="">— 未指定 —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <input placeholder="電話（選填）" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} />
        <input placeholder="員工編號（選填，留空則自動產生）" value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} disabled={loading} />
        {formError && formError !== error ? <p className="auth-inline-error">{formError}</p> : null}
        <button
          className="btn primary"
          type="button"
          disabled={loading || submitting || !name.trim() || !email.trim() || !password}
          onClick={() => void submit()}
        >
          {submitting ? '送出中…' : '註冊並登入'}
        </button>
      </div>
    </div>
  );
}

function RoleSelectionPage({ roles, onPickRole }: { roles: Role[]; onPickRole: (role: Role) => void }) {
  return (
    <div className="auth-shell">
      <div className="auth-card role-pick prettier-role-select">
        <h2>Choose Your Role</h2>
        <div className="role-cards">
          {roles.map((role) => (
            <button key={role} className="role-card" onClick={() => onPickRole(role)} type="button">
              <strong>{role}</strong>
              <p>{role === 'employee' ? 'Quickly report your own status.' : role === 'supervisor' ? 'Monitor your team responses.' : 'Manage events and global response.'}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function employeeEventTypeIcon(type: EventItem['type']) {
  switch (type) {
    case 'Earthquake':
      return Activity;
    case 'Typhoon':
      return Wind;
    case 'Fire':
      return Flame;
    default:
      return Package;
  }
}

function formatEmployeeCardTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function EmployeeEventListCard({
  event,
  latest,
  filterTab,
  selectedEventId,
  onSelectEvent,
}: {
  event: EventItem;
  latest?: SafetyResponse;
  filterTab: 'ongoing' | 'closed';
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
}) {
  const Icon = employeeEventTypeIcon(event.type);
  const deptLabel = event.cardDepartment ?? '';
  const isOngoingTab = filterTab === 'ongoing';
  const pending = !latest && isOngoingTab;
  const stripeClass =
    !isOngoingTab ? 'muted' : pending ? 'pending' : latest?.status === 'need_help' ? 'danger' : 'safe';

  const ongoingStatusBlock = isOngoingTab ? (
    <>
      {pending ? (
        <span className="employee-events-status-pill pending">
          <Hourglass size={14} strokeWidth={2} aria-hidden />
          Pending response
        </span>
      ) : latest?.status === 'safe' ? (
        <span className="employee-events-status-pill safe">
          <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
          Reported · I&apos;m Safe
        </span>
      ) : latest ? (
        <span className="employee-events-status-pill danger">
          <AlertCircle size={14} strokeWidth={2} aria-hidden />
          Reported · I need help
        </span>
      ) : null}
      {pending ? (
        <span className="employee-events-status-hint">Please submit your status.</span>
      ) : latest ? (
        <span className="employee-events-status-hint muted">
          You responded at{' '}
          {new Date(latest.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </span>
      ) : null}
    </>
  ) : null;

  const closedStatusBlock =
    filterTab === 'closed' ? (
      <>
        <span className="employee-events-status-pill closed">Closed</span>
        {latest?.status === 'safe' ? (
          <span className="employee-events-closed-safe">
            <CheckCircle2 size={14} className="text-safe" aria-hidden />
            I&apos;m Safe ·{' '}
            {new Date(latest.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        ) : latest?.status === 'need_help' ? (
          <span className="employee-events-closed-safe danger-text">
            <AlertCircle size={14} aria-hidden />
            I need help ·{' '}
            {new Date(latest.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        ) : (
          <span className="employee-events-status-hint muted">No submission on file.</span>
        )}
      </>
    ) : null;

  return (
    <button
      type="button"
      className={`employee-events-card${selectedEventId === event.id ? ' is-selected' : ''}`}
      onClick={() => onSelectEvent(event.id)}
    >
      <div className="employee-events-card-inner">
        <div className={`employee-events-card-stripe ee-stripe-bg-${stripeClass}`} aria-hidden />
        <div className="employee-events-card-main">
          <div className="employee-events-card-icon" aria-hidden>
            <Icon size={22} strokeWidth={1.85} />
          </div>

          <div className="employee-events-card-body">
            <div className="employee-events-card-title">{event.title}</div>
            <div className="employee-events-meta">
              <span className="employee-events-meta-dot">
                {event.type}
                {deptLabel ? <> · {deptLabel}</> : null}
              </span>
            </div>
            <div className="employee-events-meta subtle">{formatEmployeeCardTime(event.startAt)}</div>
            {event.venue ? <div className="employee-events-meta subtle">{event.venue}</div> : null}

            <div className="employee-events-card-mobile-only">{ongoingStatusBlock ?? closedStatusBlock}</div>
          </div>

          <div className="employee-events-card-aside">
            <div className="employee-events-card-aside-text">
              {isOngoingTab ? (
                <>
                  {ongoingStatusBlock}
                  <span className={`employee-events-card-cta ${pending ? 'primary' : 'ghost'}`}>
                    <span className="employee-events-cta-label">{pending ? 'Continue' : 'View'}</span>
                    <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
                  </span>
                </>
              ) : (
                <>
                  {closedStatusBlock}
                  <span className="employee-events-card-cta ghost">
                    <span className="employee-events-cta-label">View</span>
                    <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
                  </span>
                </>
              )}
            </div>
            <span className="employee-events-card-chevron-only" aria-hidden>
              <ChevronRight size={22} strokeWidth={2.25} />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function EmployeeEventListPage({
  rows,
  selectedEventId,
  onSelectEvent,
  employeeEventFilter,
  setEmployeeEventFilter,
  ongoingCount,
  closedCount,
  searchQuery,
  setSearchQuery,
}: {
  rows: Array<{ event: EventItem; latest?: SafetyResponse }>;
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
  employeeEventFilter: 'ongoing' | 'closed';
  setEmployeeEventFilter: (value: 'ongoing' | 'closed') => void;
  ongoingCount: number;
  closedCount: number;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}) {
  const pendingRows = employeeEventFilter === 'ongoing' ? rows.filter((r) => !r.latest) : [];
  const respondedRows = employeeEventFilter === 'ongoing' ? rows.filter((r) => Boolean(r.latest)) : [];

  return (
    <section className="page-section employee-events-page">
      <header className="employee-events-hero">
        <div className="employee-events-hero-text">
          <h2 className="employee-events-title">
            <Activity className="employee-events-title-icon" aria-hidden />
            Emergency Events
          </h2>
          <p className="employee-events-subtitle">Stay informed. Report your status. Stay safe.</p>
        </div>
      </header>

      <div className="employee-events-tabs pills-counted">
        <button
          className={`employee-events-tab pill ${employeeEventFilter === 'ongoing' ? 'active' : ''}`}
          onClick={() => setEmployeeEventFilter('ongoing')}
          type="button"
        >
          Ongoing ({ongoingCount})
        </button>
        <button
          className={`employee-events-tab pill ${employeeEventFilter === 'closed' ? 'active' : ''}`}
          onClick={() => setEmployeeEventFilter('closed')}
          type="button"
        >
          Closed ({closedCount})
        </button>
      </div>

      <div className="employee-events-toolbar">
        <label className="employee-events-search">
          <Search className="employee-events-search-icon" size={18} aria-hidden />
          <input
            type="search"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="button" className="employee-events-filter-btn" aria-label="Filter events">
          <Filter size={18} />
        </button>
      </div>

      {employeeEventFilter === 'ongoing' ? (
        <div className="employee-events-section-intro">
          <Activity className="employee-events-intro-icon" size={22} aria-hidden />
          <div>
            <h3>Ongoing Events</h3>
            <p>Events that require your response.</p>
          </div>
        </div>
      ) : (
        <div className="employee-events-section-intro">
          <Archive className="employee-events-intro-icon" size={22} aria-hidden />
          <div>
            <h3>Closed Events</h3>
            <p>Events that have ended.</p>
          </div>
        </div>
      )}

      <div className="employee-events-card-list">
        {employeeEventFilter === 'ongoing' ? (
          <>
            {pendingRows.length > 0 ? (
              <div className="employee-events-status-group employee-events-status-group--pending">
                <h4 className="employee-events-group-heading">
                  Not responded yet
                  <span className="employee-events-group-count">{pendingRows.length}</span>
                </h4>
                <div className="employee-events-group-cards">
                  {pendingRows.map(({ event, latest }) => (
                    <EmployeeEventListCard
                      key={event.id}
                      event={event}
                      latest={latest}
                      filterTab="ongoing"
                      selectedEventId={selectedEventId}
                      onSelectEvent={onSelectEvent}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {respondedRows.length > 0 ? (
              <div
                className={`employee-events-status-group employee-events-status-group--responded${
                  pendingRows.length > 0 ? ' employee-events-status-group--after-pending' : ''
                }`}
              >
                <h4 className="employee-events-group-heading">
                  Responded
                  <span className="employee-events-group-count">{respondedRows.length}</span>
                </h4>
                <div className="employee-events-group-cards">
                  {respondedRows.map(({ event, latest }) => (
                    <EmployeeEventListCard
                      key={event.id}
                      event={event}
                      latest={latest}
                      filterTab="ongoing"
                      selectedEventId={selectedEventId}
                      onSelectEvent={onSelectEvent}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          rows.map(({ event, latest }) => (
            <EmployeeEventListCard
              key={event.id}
              event={event}
              latest={latest}
              filterTab="closed"
              selectedEventId={selectedEventId}
              onSelectEvent={onSelectEvent}
            />
          ))
        )}
      </div>

      {rows.length === 0 ? (
        <div className="empty employee-events-empty">No events match this filter.</div>
      ) : null}
    </section>
  );
}

function EventSelectionPage({
  title,
  events,
  selectedEventId,
  onSelectEvent,
}: {
  title: string;
  events: EventItem[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
}) {
  return (
    <section className="page-section">
      <h2>{title}</h2>
      <div className="event-card-row single-column">
        {events.map((event) => (
          <button key={event.id} className={selectedEventId === event.id ? 'event-mini-card active' : 'event-mini-card'} onClick={() => onSelectEvent(event.id)} type="button">
            <strong>{event.title}</strong>
            <span>{event.type}</span>
            <small>{event.status}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function formatFileSize(bytes?: number | null) {
  if (bytes == null || bytes <= 0) return '—';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

interface EditDraftBaseline {
  comment: string;
  location: string;
  attachment: File | null;
  selectedNeedHelp: boolean;
  pendingSubmission: 'safe' | 'need_help' | null;
  omitStoredAttachment: boolean;
}

function EmployeeHomePage({
  userName,
  selectedEvent,
  currentDepartment,
  latestResponse,
  employeeComment,
  setEmployeeComment,
  employeeLocation,
  setEmployeeLocation,
  employeeAttachment,
  setEmployeeAttachment,
  onSubmit,
  onBackToEvents,
}: {
  userName: string;
  selectedEvent: EventItem | null;
  currentDepartment: string;
  latestResponse?: SafetyResponse;
  employeeComment: string;
  setEmployeeComment: (value: string) => void;
  employeeLocation: string;
  setEmployeeLocation: (value: string) => void;
  employeeAttachment: File | null;
  setEmployeeAttachment: (file: File | null) => void;
  onSubmit: (status: 'safe' | 'need_help', meta?: { omitStoredAttachment?: boolean }) => void;
  onBackToEvents: () => void;
}) {
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const helpDetailsRef = useRef<HTMLDivElement>(null);
  const [dropActive, setDropActive] = useState(false);
  const [selectedNeedHelp, setSelectedNeedHelp] = useState(false);
  const [wantToUpdate, setWantToUpdate] = useState(false);
  const [draftBaseline, setDraftBaseline] = useState<EditDraftBaseline | null>(null);
  const [pendingSubmission, setPendingSubmission] = useState<'safe' | 'need_help' | null>(null);
  const [discardPromptAfter, setDiscardPromptAfter] = useState<'back' | 'cancel' | null>(null);
  const [confirmSwitchToSafeOpen, setConfirmSwitchToSafeOpen] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [omitStoredAttachment, setOmitStoredAttachment] = useState(false);

  const MAX_COMMENT_LEN = 500;
  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

  const hasReport = Boolean(latestResponse);
  const showReportingControls = !hasReport || wantToUpdate;
  const isRevisionDraft = Boolean(hasReport && wantToUpdate);

  /** 詳細區塊：初次回報在選「需要協助」後顯示；修訂草稿在選 need help 或已暫存 need_help 時顯示 */
  const showHelpDetailsPanel =
    selectedNeedHelp || (isRevisionDraft && pendingSubmission === 'need_help');

  const needFlowActive =
    (!isRevisionDraft && selectedNeedHelp) || (isRevisionDraft && (selectedNeedHelp || pendingSubmission === 'need_help'));

  const safeButtonDimmed = needFlowActive && (!isRevisionDraft || pendingSubmission !== 'safe');
  const revertToBaselineAndExitEdit = (baseline: EditDraftBaseline) => {
    setEmployeeComment(baseline.comment);
    setEmployeeLocation(baseline.location);
    setEmployeeAttachment(baseline.attachment);
    setSelectedNeedHelp(baseline.selectedNeedHelp);
    setPendingSubmission(baseline.pendingSubmission);
    setOmitStoredAttachment(baseline.omitStoredAttachment);
    setWantToUpdate(false);
    setDraftBaseline(null);
  };

  const isDraftDirty =
    draftBaseline !== null &&
    (employeeComment !== draftBaseline.comment ||
      employeeLocation !== draftBaseline.location ||
      employeeAttachment !== draftBaseline.attachment ||
      selectedNeedHelp !== draftBaseline.selectedNeedHelp ||
      pendingSubmission !== draftBaseline.pendingSubmission ||
      omitStoredAttachment !== draftBaseline.omitStoredAttachment);

  useEffect(() => {
    setWantToUpdate(false);
    setSelectedNeedHelp(false);
    setPendingSubmission(null);
    setDraftBaseline(null);
    setOmitStoredAttachment(false);
  }, [selectedEvent?.id]);

  useEffect(() => {
    if (latestResponse) setWantToUpdate(false);
  }, [latestResponse?.updatedAt]);

  useEffect(() => {
    if (!showHelpDetailsPanel) return;
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        helpDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [showHelpDetailsPanel]);

  useEffect(() => {
    if (!wantToUpdate) setDraftBaseline(null);
  }, [wantToUpdate]);

  const handleNeedHelp = () => {
    if (isRevisionDraft) {
      setPendingSubmission('need_help');
      setSelectedNeedHelp(true);
      return;
    }
    setPendingSubmission(null);
    setSelectedNeedHelp(true);
  };

  const enterRevisionMode = () => {
    if (!latestResponse) return;
    const wasNeedHelp = latestResponse.status === 'need_help';
    const pendingInit = wasNeedHelp ? 'need_help' : 'safe';
    const c = latestResponse.comment ?? '';
    const loc = latestResponse.location ?? '';
    setEmployeeComment(c);
    setEmployeeLocation(loc);
    setEmployeeAttachment(null);
    setUploadNotice(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    setDraftBaseline({
      comment: c,
      location: loc,
      attachment: null,
      selectedNeedHelp: wasNeedHelp,
      pendingSubmission: pendingInit,
      omitStoredAttachment: false,
    });
    setOmitStoredAttachment(false);
    setWantToUpdate(true);
    setPendingSubmission(pendingInit);
    setSelectedNeedHelp(wasNeedHelp);
  };

  const confirmDiscardDraft = () => {
    const reason = discardPromptAfter;
    if (draftBaseline) revertToBaselineAndExitEdit(draftBaseline);
    setDiscardPromptAfter(null);
    if (reason === 'back') onBackToEvents();
  };

  const requestBackNavigation = () => {
    if (isRevisionDraft && isDraftDirty) {
      setDiscardPromptAfter('back');
      return;
    }
    onBackToEvents();
  };

  const requestCancelRevision = () => {
    if (!draftBaseline || !isRevisionDraft) return;
    if (isDraftDirty) {
      setDiscardPromptAfter('cancel');
      return;
    }
    revertToBaselineAndExitEdit(draftBaseline);
  };

  const handleSubmitSafeTap = () => {
    if (isRevisionDraft) {
      setPendingSubmission('safe');
      setSelectedNeedHelp(false);
      return;
    }
    if (selectedNeedHelp) {
      setConfirmSwitchToSafeOpen(true);
      return;
    }
    onSubmit('safe', { omitStoredAttachment });
  };

  const handleSubmitNeedHelpConfirm = () => {
    if (isRevisionDraft) return;
    onSubmit('need_help', { omitStoredAttachment });
  };

  const handleSaveRevision = () => {
    if (!pendingSubmission || !isRevisionDraft) return;
    onSubmit(pendingSubmission, { omitStoredAttachment });
  };

  const applyAttachment = (file: File | undefined | null) => {
    setUploadNotice(null);
    if (!file) {
      setEmployeeAttachment(null);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadNotice('單檔不得超過 10MB');
      return;
    }
    setOmitStoredAttachment(false);
    setEmployeeAttachment(file);
  };

  const confirmSwitchToSafeSubmit = () => {
    setConfirmSwitchToSafeOpen(false);
    setSelectedNeedHelp(false);
    setEmployeeComment('');
    setEmployeeLocation('');
    setEmployeeAttachment(null);
    setUploadNotice(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    onSubmit('safe', { omitStoredAttachment: false });
  };

  const heroTime = selectedEvent ? new Date(selectedEvent.startAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

  return (
    <section className="employee-event-page">
      {selectedEvent ? (
        <>
          <header className="employee-event-hero">
            <button className="employee-event-back" type="button" onClick={requestBackNavigation} aria-label="返回事件列表">
              <ChevronLeft size={24} strokeWidth={2.25} aria-hidden />
            </button>
            <div className="employee-event-hero-art" aria-hidden />
            <div className="employee-event-hero-body">
              <div className="employee-event-icon-ring">
                <Activity size={36} strokeWidth={1.6} aria-hidden />
              </div>
              <h1 className="employee-event-headline">{selectedEvent.title}</h1>
              <p className="employee-event-subline">
                {hasReport && wantToUpdate ? '請更新並儲存你的回報。' : hasReport && !wantToUpdate ? '\u00a0' : `Hi ${userName}，請確認你的狀態是否平安。`}
              </p>
              <div className="employee-event-meta-pill">
                <span className="employee-event-meta-item">
                  <span className="employee-event-meta-ic" aria-hidden>
                    ●
                  </span>
                  {selectedEvent.type}
                </span>
                <span className="employee-event-meta-split" aria-hidden />
                <span className="employee-event-meta-item">{currentDepartment}</span>
                <span className="employee-event-meta-split" aria-hidden />
                <span className="employee-event-meta-item">{heroTime}</span>
              </div>
            </div>
          </header>

          <div className="employee-event-body">
            <div className={`employee-event-shell${isRevisionDraft ? ' employee-event-shell--revision' : ''}`}>
              {!showReportingControls && latestResponse ? (
                <>
                  <div className="employee-submit-success-banner">
                    <CheckCircle2 className="employee-submit-success-ic" size={40} strokeWidth={2} aria-hidden />
                    <div className="employee-submit-success-copy">
                      <strong>Report Submitted</strong>
                      <p>Your status has been shared with your emergency response team.</p>
                    </div>
                  </div>

                  <article className="event-detail-card employee-status-overview-card">
                    <h3 className="employee-section-title">
                      <Users size={22} strokeWidth={1.75} className="employee-section-title-icon" aria-hidden />
                      Your current status
                    </h3>
                    <div className="employee-status-overview-grid">
                      <div
                        className={`employee-status-slot ${latestResponse.status === 'safe' ? 'employee-status-slot--active-safe' : 'employee-status-slot--muted'}`}
                      >
                        {latestResponse.status === 'safe' ? (
                          <span className="employee-status-slot-check" aria-hidden>
                            <CheckCircle2 size={22} strokeWidth={2} />
                          </span>
                        ) : null}
                        <ShieldCheck size={28} strokeWidth={1.5} aria-hidden />
                        <div>
                          <div className="employee-status-slot-title">I&apos;m Safe</div>
                          <div className="employee-status-slot-hint">{latestResponse.status === 'safe' ? 'This is the status you submitted.' : 'Not selected.'}</div>
                        </div>
                      </div>
                      <div
                        className={`employee-status-slot ${latestResponse.status === 'need_help' ? 'employee-status-slot--active-help' : 'employee-status-slot--muted'}`}
                      >
                        {latestResponse.status === 'need_help' ? (
                          <span className="employee-status-slot-check employee-status-slot-check--help" aria-hidden>
                            <CheckCircle2 size={22} strokeWidth={2} />
                          </span>
                        ) : null}
                        <LifeBuoy size={28} strokeWidth={1.5} aria-hidden />
                        <div>
                          <div className="employee-status-slot-title">I need help</div>
                          <div className="employee-status-slot-hint">{latestResponse.status === 'need_help' ? 'This is the status you submitted.' : 'Not selected.'}</div>
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="event-detail-card employee-summary-card">
                    <h3 className="employee-section-title">
                      <ClipboardList size={22} strokeWidth={1.75} className="employee-section-title-icon" aria-hidden />
                      Submitted summary
                    </h3>
                    <dl className="employee-summary-rows">
                      <div className="employee-summary-row">
                        <dt>Status</dt>
                        <dd>
                          <span className={latestResponse.status === 'safe' ? 'employee-pill-safe' : 'employee-pill-help'}>
                            {latestResponse.status === 'safe' ? "I'm Safe" : 'I need help'}
                          </span>
                        </dd>
                      </div>
                      <div className="employee-summary-row">
                        <dt>Submitted at</dt>
                        <dd>
                          {(() => {
                            const t = new Date(latestResponse.updatedAt);
                            return `${t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} (${t.toLocaleTimeString('zh-TW', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: true,
                            })})`;
                          })()}
                        </dd>
                      </div>
                      <div className="employee-summary-row">
                        <dt>Location</dt>
                        <dd>{latestResponse.location?.trim() || '—'}</dd>
                      </div>
                      <div className="employee-summary-row">
                        <dt>Comment</dt>
                        <dd>{latestResponse.comment?.trim() || '—'}</dd>
                      </div>
                      <div className="employee-summary-row employee-summary-row--files">
                        <dt>Attached files</dt>
                        <dd>
                          {latestResponse.attachmentName ? (
                            <span className="employee-file-chip">
                              <FileImage size={18} strokeWidth={1.75} aria-hidden />
                              <span>
                                <strong>{latestResponse.attachmentName}</strong>
                                <span className="employee-file-chip-meta">{formatFileSize(latestResponse.attachmentSizeBytes)}</span>
                              </span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </dd>
                      </div>
                    </dl>

                    <div className="employee-summary-actions">
                      <button type="button" className="btn btn-navy-solid" onClick={enterRevisionMode}>
                        <Pencil size={18} strokeWidth={2} aria-hidden /> Edit Report
                      </button>
                      <button type="button" className="btn employee-btn-outline" onClick={onBackToEvents}>
                        Done
                      </button>
                    </div>
                  </article>
                </>
              ) : (
                <>
                  {isRevisionDraft ? (
                    <aside className="employee-edit-alert" role="status">
                      <Info size={22} strokeWidth={2} className="employee-edit-alert-icon" aria-hidden />
                      <div>
                        <strong>Editing submitted report</strong>
                        <p>You can update your information and save your changes.</p>
                      </div>
                    </aside>
                  ) : null}

                  <article className="event-detail-card">
                    <div className="event-detail-card-head">
                      <span className="event-detail-card-icon">
                        <Users size={22} strokeWidth={1.75} aria-hidden />
                      </span>
                      <h3>Report your status</h3>
                    </div>
                    <div className={`employee-status-row${isRevisionDraft ? ' employee-status-row--revision' : ''}`}>
                      <button
                        type="button"
                        className={
                          isRevisionDraft
                            ? `employee-status-revision-btn employee-status-revision-btn--safe${pendingSubmission === 'safe' ? ' is-selected' : ''}`
                            : `employee-status-wide safe ${safeButtonDimmed ? 'is-dimmed' : ''}`
                        }
                        onClick={handleSubmitSafeTap}
                      >
                        {isRevisionDraft && pendingSubmission === 'safe' ? (
                          <span className="employee-revision-corner-badge employee-revision-corner-badge--safe" aria-hidden>
                            <CheckCircle2 size={22} strokeWidth={2.25} />
                          </span>
                        ) : null}
                        <span className="employee-status-inner">
                          <span className="employee-status-ic" aria-hidden>
                            <ShieldCheck size={28} strokeWidth={1.65} />
                          </span>
                          <span className="employee-status-label">I&apos;m Safe</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={
                          isRevisionDraft
                            ? `employee-status-revision-btn employee-status-revision-btn--need${pendingSubmission === 'need_help' ? ' is-selected' : ''}`
                            : `employee-status-wide need ${needFlowActive ? 'is-need-selected' : ''}`
                        }
                        onClick={handleNeedHelp}
                      >
                        {!isRevisionDraft && needFlowActive ? (
                          <span className="employee-choice-check" aria-hidden>
                            ✓
                          </span>
                        ) : null}
                        {isRevisionDraft && pendingSubmission === 'need_help' ? (
                          <span className="employee-revision-corner-badge employee-revision-corner-badge--need" aria-hidden>
                            <CheckCircle2 size={22} strokeWidth={2.25} />
                          </span>
                        ) : null}
                        <span className="employee-status-inner">
                          <span className="employee-status-ic" aria-hidden>
                            <LifeBuoy size={28} strokeWidth={1.65} />
                          </span>
                          <span className="employee-status-label">I need help</span>
                        </span>
                      </button>
                    </div>
                  </article>

                  {showHelpDetailsPanel ? (
                    <div ref={helpDetailsRef} className="employee-help-details-panel">
                    <article className="event-detail-card">
                      <div className="event-detail-card-head">
                        <span className="event-detail-card-icon">
                          <ClipboardList size={22} strokeWidth={1.75} aria-hidden />
                        </span>
                        <h3>{isRevisionDraft ? 'Additional details' : 'Additional details (Optional)'}</h3>
                      </div>
                      <div className="employee-fields">
                        <label className="employee-field-label" htmlFor="emp-loc-input">
                          Location
                        </label>
                        <div className="input-with-leading-icon">
                          <span className="input-leading-ic" aria-hidden>
                            <MapPin size={19} strokeWidth={2} color="#3d5f85" />
                          </span>
                          <input
                            id="emp-loc-input"
                            placeholder="例如：Building A, 3F, Lab 2"
                            value={employeeLocation}
                            onChange={(e) => setEmployeeLocation(e.target.value)}
                          />
                        </div>

                        <label className="employee-field-label" htmlFor="emp-comment-area">
                          Comment
                        </label>
                        <div className="textarea-with-leading-icon">
                          <span className="input-leading-ic textarea-leading" aria-hidden>
                            <MessageSquare size={19} strokeWidth={2} color="#3d5f85" />
                          </span>
                          <textarea
                            id="emp-comment-area"
                            placeholder="Tell us more about your situation…"
                            value={employeeComment}
                            maxLength={MAX_COMMENT_LEN}
                            onChange={(e) => setEmployeeComment(e.target.value.slice(0, MAX_COMMENT_LEN))}
                          />
                          <span className="employee-char-count">{employeeComment.length}/{MAX_COMMENT_LEN}</span>
                        </div>

                        {!isRevisionDraft && selectedNeedHelp ? (
                          <button className="btn danger employee-confirm-help" type="button" onClick={handleSubmitNeedHelpConfirm}>
                            {isRevisionDraft ? '確認「需要協助」（暫存）' : '確認需要協助並送出'}
                          </button>
                        ) : null}
                      </div>
                    </article>

                    <article className="event-detail-card">
                      <div className="event-detail-card-head">
                        <span className="event-detail-card-icon">
                          <Paperclip size={22} strokeWidth={1.75} aria-hidden />
                        </span>
                        <h3>Attach files</h3>
                      </div>
                      {isRevisionDraft && latestResponse?.attachmentName && !employeeAttachment && !omitStoredAttachment ? (
                        <div className="employee-attached-existing">
                          <span className="employee-attached-thumb" aria-hidden />
                          <div className="employee-attached-meta">
                            <strong>{latestResponse.attachmentName}</strong>
                            <span>{formatFileSize(latestResponse.attachmentSizeBytes)}</span>
                          </div>
                          <div className="employee-attached-actions">
                            <button type="button" className="btn ghost btn-compact" onClick={() => attachmentInputRef.current?.click()}>
                              Replace
                            </button>
                            <button
                              type="button"
                              className="btn ghost btn-icon-danger"
                              aria-label="Remove attachment"
                              onClick={() => setOmitStoredAttachment(true)}
                            >
                              <Trash2 size={18} strokeWidth={2} aria-hidden />
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <input ref={attachmentInputRef} id="emp-file-input" type="file" className="visually-hidden-input" onChange={(e) => applyAttachment(e.target.files?.[0])} />
                      <label
                        htmlFor="emp-file-input"
                        className={`employee-drop-zone${dropActive ? ' is-dragging' : ''}${employeeAttachment ? ' has-file' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDropActive(true);
                        }}
                        onDragLeave={() => setDropActive(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDropActive(false);
                          applyAttachment(e.dataTransfer.files?.[0]);
                        }}
                      >
                        <span className="employee-drop-ic" aria-hidden>
                          <CloudUpload size={46} strokeWidth={1.45} color="#1e5494" />
                        </span>
                        <span className="employee-drop-title">拖曳檔案到此，或點此瀏覽</span>
                        <span className="employee-drop-hint">支援圖片、影片與文件（各自最大 10MB）</span>
                        {employeeAttachment ? <span className="employee-drop-file">{employeeAttachment.name}</span> : null}
                        {uploadNotice ? <span className="employee-drop-error">{uploadNotice}</span> : null}
                      </label>
                      {employeeAttachment ? (
                        <button
                          type="button"
                          className="btn ghost btn-remove-att"
                          onClick={() => {
                            if (attachmentInputRef.current) attachmentInputRef.current.value = '';
                            applyAttachment(null);
                          }}
                        >
                          移除附件
                        </button>
                      ) : null}
                    </article>
                  </div>
                  ) : null}
                </>
              )}

              <article className="event-detail-card event-detail-card--emergency">
                <div className="event-detail-card-head">
                  <span className="event-detail-card-icon">
                    <Phone size={22} strokeWidth={1.8} aria-hidden />
                  </span>
                  <h3>Emergency contact</h3>
                </div>
                <div className="emergency-inline emergency-inline--desktop">
                  <a className="emergency-slot" href="tel:+886212345678">
                    <span className="emergency-slot-ic emergency-slot-ic--headset" aria-hidden>
                      <Headphones size={20} strokeWidth={2} />
                    </span>
                    <div>
                      <div className="emergency-slot-title">Emergency Hotline</div>
                      <div className="emergency-slot-num">+886 (2) 1234-5678</div>
                    </div>
                  </a>
                  <span className="emergency-vrule" aria-hidden />
                  <a className="emergency-slot" href="tel:+886298765432">
                    <span className="emergency-slot-ic emergency-slot-ic--people" aria-hidden>
                      <Users size={20} strokeWidth={2} />
                    </span>
                    <div>
                      <div className="emergency-slot-title">HR Duty Line</div>
                      <div className="emergency-slot-num">+886 (2) 9876-5432</div>
                    </div>
                  </a>
                </div>
                <div className="emergency-list emergency-list--narrow">
                  <a className="emergency-row" href="tel:+886212345678">
                    <span className="emergency-row-ic" aria-hidden>
                      <Headphones size={20} strokeWidth={2} />
                    </span>
                    <div className="emergency-row-text">
                      <div className="emergency-slot-title">Emergency Hotline</div>
                      <div className="emergency-slot-num">+886 (2) 1234-5678</div>
                    </div>
                    <span className="emergency-row-chevron" aria-hidden>
                      <ChevronRight size={20} strokeWidth={2} />
                    </span>
                  </a>
                  <a className="emergency-row" href="tel:+886298765432">
                    <span className="emergency-row-ic" aria-hidden>
                      <Users size={20} strokeWidth={2} />
                    </span>
                    <div className="emergency-row-text">
                      <div className="emergency-slot-title">HR Duty Line</div>
                      <div className="emergency-slot-num">+886 (2) 9876-5432</div>
                    </div>
                    <span className="emergency-row-chevron" aria-hidden>
                      <ChevronRight size={20} strokeWidth={2} />
                    </span>
                  </a>
                </div>
              </article>

              <footer className={`employee-event-tagline${isRevisionDraft ? ' employee-event-tagline--revision' : ''}`}>
                Stay safe. Stay connected. ♡
              </footer>
            </div>
          </div>

          {isRevisionDraft ? (
            <footer className="employee-edit-sticky-bar">
              <div className="employee-edit-sticky-inner">
                <p className="employee-edit-sticky-meta">
                  Last updated{' '}
                  {latestResponse ? new Date(latestResponse.updatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—'}
                </p>
                <div className="employee-edit-sticky-actions">
                  <button type="button" className="btn employee-btn-outline-strong" onClick={requestCancelRevision}>
                    Discard changes
                  </button>
                  <button type="button" className="btn btn-navy-solid" disabled={!isDraftDirty} onClick={handleSaveRevision}>
                    Save changes
                  </button>
                </div>
                <p className="employee-edit-sticky-tagline">Stay safe. Stay connected. ♡</p>
              </div>
            </footer>
          ) : null}

          <ConfirmModal
            open={discardPromptAfter !== null}
            title="Discard unsaved changes?"
            description="You have unsaved changes to your report draft. If you leave now, those changes will be lost."
            cancelText="Continue editing"
            confirmText="Discard changes"
            onCancel={() => setDiscardPromptAfter(null)}
            onConfirm={confirmDiscardDraft}
          />
          <ConfirmModal
            open={confirmSwitchToSafeOpen}
            title="改為「I'm Safe」？"
            description="你目前選擇了需要協助。若改為平安，將關閉詳細欄位並以「平安」送出回報。"
            cancelText="取消"
            confirmText="改為 I'm Safe 並送出"
            confirmTone="primary"
            onCancel={() => setConfirmSwitchToSafeOpen(false)}
            onConfirm={confirmSwitchToSafeSubmit}
          />
        </>
      ) : (
        <div className="employee-event-empty">
          <p>目前沒有選取的事件</p>
        </div>
      )}
    </section>
  );
}

function EmployeeHistoryPage({
  responses,
  events,
  filter,
  setFilter,
}: {
  responses: SafetyResponse[];
  events: EventItem[];
  filter: 'all' | 'safe' | 'need_help';
  setFilter: (value: 'all' | 'safe' | 'need_help') => void;
}) {
  const filtered = responses.filter((response) => (filter === 'all' ? true : response.status === filter));
  return (
    <section className="page-section">
      <h2>My Reporting History</h2>
      <div className="tabs">
        {(['all', 'safe', 'need_help'] as const).map((item) => (
          <button key={item} className={filter === item ? 'pill active' : 'pill'} onClick={() => setFilter(item)} type="button">
            {item}
          </button>
        ))}
      </div>
      <div className="list">
        {filtered.map((response) => {
          const event = events.find((item) => item.id === response.eventId);
          return (
            <article className="list-item" key={response.id}>
              <div>
                <strong>{event?.title ?? 'Unknown Event'}</strong>
                <p>{new Date(response.updatedAt).toLocaleString()}</p>
              </div>
              <StatusBadge status={response.status} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SupervisorDashboardPage({
  stats,
  rows,
  filter,
  setFilter,
  searchText,
  setSearchText,
  onSendReminder,
  onExport,
  onBackToEvents,
}: {
  stats: { total: number; safe: number; needHelp: number; pending: number; responseRate: number };
  rows: Array<{ id: string; name: string; department: string; status: 'safe' | 'need_help' | 'pending'; updatedAt?: string; note?: string }>;
  filter: 'all' | 'safe' | 'need_help' | 'pending';
  setFilter: (value: 'all' | 'safe' | 'need_help' | 'pending') => void;
  searchText: string;
  setSearchText: (value: string) => void;
  onSendReminder: () => void;
  onExport: () => void;
  onBackToEvents: () => void;
}) {
  const filtered = rows
    .filter((row) => (filter === 'all' ? true : row.status === filter))
    .filter((row) => row.name.toLowerCase().includes(searchText.toLowerCase()))
    .sort((a, b) => (a.status === 'need_help' ? -1 : 1) - (b.status === 'need_help' ? -1 : 1));
  const urgentRows = rows.filter((row) => row.status === 'need_help');
  const pendingRows = rows.filter((row) => row.status === 'pending');
  return (
    <section className="page-section">
      <button className="btn ghost" onClick={onBackToEvents} type="button">
        ← Back to Events
      </button>
      <h2>Supervisor Dashboard</h2>
      <div className="panel supervisor-overview">
        <h3 className="section-title">Response Snapshot</h3>
        <div className="dashboard-top">
          <div className="stat-grid">
            <StatCard label="Total Employees" value={stats.total} />
            <StatCard label="Safe" value={stats.safe} tone="safe" />
            <StatCard label="Need Help" value={stats.needHelp} tone="danger" />
            <StatCard label="No Response" value={stats.pending} tone="warning" />
            <StatCard label="Response Rate" value={`${stats.responseRate}%`} tone="primary" />
          </div>
          <div className="dashboard-visual">
            <div className="pie-chart" style={{ background: `conic-gradient(#2ba95a 0 ${stats.safe / Math.max(stats.total, 1) * 100}%, #d53d3f ${stats.safe / Math.max(stats.total, 1) * 100}% ${(stats.safe + stats.needHelp) / Math.max(stats.total, 1) * 100}%, #f2c04a ${(stats.safe + stats.needHelp) / Math.max(stats.total, 1) * 100}% 100%)` }} />
            <div className="pie-legend">
              <span><i className="dot safe" /> Safe: {stats.safe}</span>
              <span><i className="dot danger" /> Need Help: {stats.needHelp}</span>
              <span><i className="dot pending" /> No Response: {stats.pending}</span>
            </div>
          </div>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${stats.responseRate}%` }} /></div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h3 className="section-title">Immediate Attention</h3>
          {urgentRows.length === 0 ? <p className="empty">No employees marked Need Help.</p> : urgentRows.map((row) => (
            <article key={row.id} className="list-item">
              <div>
                <strong>{row.name}</strong>
                <p>{row.department} {row.note ? `| ${row.note}` : ''}</p>
              </div>
              <StatusBadge status="need_help" />
            </article>
          ))}
        </section>
        <section className="panel">
          <h3 className="section-title">Pending Follow-up</h3>
          {pendingRows.length === 0 ? <p className="empty">All employees responded.</p> : pendingRows.map((row) => (
            <article key={row.id} className="list-item">
              <div>
                <strong>{row.name}</strong>
                <p>{row.department}</p>
              </div>
              <StatusBadge status="pending" />
            </article>
          ))}
          <div className="row-actions">
            <button className="btn warning" onClick={onSendReminder} type="button">Send Reminder</button>
            <button className="btn ghost" onClick={onExport} type="button">Export / Email</button>
          </div>
        </section>
      </div>

      <div className="toolbar">
        <div className="tabs">
          {(['all', 'need_help', 'pending', 'safe'] as const).map((item) => (
            <button key={item} className={filter === item ? 'pill active' : 'pill'} onClick={() => setFilter(item)} type="button">
              {item}
            </button>
          ))}
        </div>
        <input placeholder="Search employee" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
      </div>
      <h3 className="section-title">Detailed Employee List</h3>
      <EmployeeTable rows={filtered} />
    </section>
  );
}

function AdminDashboardPage({
  stats,
  rows,
  departments: deptList,
  onBackToEvents,
}: {
  stats: { total: number; safe: number; needHelp: number; pending: number; responseRate: number };
  rows: Array<{ id: string; name: string; department: string; status: 'safe' | 'need_help' | 'pending'; note?: string }>;
  departments: Department[];
  onBackToEvents: () => void;
}) {
  const critical = rows.filter((row) => row.status === 'need_help');
  const pending = rows.filter((row) => row.status === 'pending');
  return (
    <section className="page-section">
      <button className="btn ghost" onClick={onBackToEvents} type="button">
        ← Back to Events
      </button>
      <h2>Admin Dashboard</h2>
      <section className="panel">
        <h3 className="section-title">Global Status Overview</h3>
        <div className="stat-grid">
          <StatCard label="Global Safe" value={stats.safe} tone="safe" />
          <StatCard label="Global Need Help" value={stats.needHelp} tone="danger" />
          <StatCard label="Global No Response" value={stats.pending} tone="warning" />
          <StatCard label="Response Rate" value={`${stats.responseRate}%`} tone="primary" />
        </div>
      </section>
      <div className="grid-2">
        <section className="panel">
          <h3 className="section-title">Department Response Ranking</h3>
          <div className="list">
            {deptList.map((dept) => {
              const deptRows = rows.filter((row) => row.department === dept.name);
              const responded = deptRows.filter((row) => row.status !== 'pending').length;
              const rate = deptRows.length ? Math.round((responded / deptRows.length) * 100) : 0;
              return <div className="list-item" key={dept.id}><span>{dept.name}</span><strong>{rate}%</strong></div>;
            })}
          </div>
        </section>
        <section className="panel">
          <h3 className="section-title">Critical Alerts</h3>
          {critical.length === 0 ? <p className="empty">No employees currently marked Need Help.</p> : critical.map((row) => (
            <div className="list-item" key={row.id}>
              <div>
                <strong>{row.name}</strong>
                <p>{row.department}</p>
              </div>
              <StatusBadge status="need_help" />
            </div>
          ))}
        </section>
      </div>
      <div className="grid-2">
        <section className="panel">
          <h3 className="section-title">No Response Queue</h3>
          {pending.length === 0 ? <p className="empty">No pending responders.</p> : pending.map((row) => (
            <div className="list-item" key={`pending-${row.id}`}>
              <div>
                <strong>{row.name}</strong>
                <p>{row.department}</p>
              </div>
              <StatusBadge status="pending" />
            </div>
          ))}
        </section>
        <section className="map-placeholder">Map / Location Overview (Prototype Placeholder)</section>
      </div>
    </section>
  );
}

function EventManagementPage({
  events,
  eventForm,
  setEventForm,
  onCreateEvent,
  onActivate,
  onClose,
}: {
  events: EventItem[];
  eventForm: { title: string; type: EventItem['type']; customType: string; description: string; startAt: string };
  setEventForm: (value: { title: string; type: EventItem['type']; customType: string; description: string; startAt: string }) => void;
  onCreateEvent: () => void;
  onActivate: (eventId: string) => void;
  onClose: (eventId: string) => void;
}) {
  return (
    <section className="page-section">
      <h2>Event Management</h2>
      <p className="muted-text">These are reusable event templates and scheduled incidents. Admin creates details manually each time and activates only when an actual incident happens.</p>
      <div className="panel event-form">
        <input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} placeholder="Event title" />
        <select value={eventForm.type} onChange={(e) => setEventForm({ ...eventForm, type: e.target.value as EventItem['type'] })}>
          <option>Earthquake</option>
          <option>Typhoon</option>
          <option>Fire</option>
          <option>Other</option>
        </select>
        {eventForm.type === 'Other' ? (
          <input value={eventForm.customType} onChange={(e) => setEventForm({ ...eventForm, customType: e.target.value })} placeholder="Custom event type (e.g. Chemical Leak)" />
        ) : null}
        <textarea value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} placeholder="Description" />
        <input type="datetime-local" value={eventForm.startAt} onChange={(e) => setEventForm({ ...eventForm, startAt: e.target.value })} />
        <button className="btn primary" onClick={onCreateEvent} type="button">Create Event</button>
      </div>
      <div className="list">
        {events.map((event) => (
          <div key={event.id} className="panel">
            <EventCard event={event} />
            <div className="row-actions">
              <button className="btn warning" onClick={() => onActivate(event.id)} type="button">Activate</button>
              <button className="btn ghost" onClick={() => onClose(event.id)} type="button">Close</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function UserManagementPage({ users: userList, departments: deptList }: { users: User[]; departments: Department[] }) {
  const subordinateRows = userList.filter((user) => user.managerId);
  const childMap = deptList.reduce<Record<string, string[]>>((acc, department) => {
    const parent = department.parentId ?? 'root';
    acc[parent] = [...(acc[parent] ?? []), department.id];
    return acc;
  }, {});
  const renderDepartmentTree = (parentId: string | null, depth = 0): JSX.Element[] =>
    (childMap[parentId ?? 'root'] ?? []).flatMap((deptId) => {
      const department = deptList.find((item) => item.id === deptId);
      if (!department) return [];
      return [
        <div className="list-item" key={`${deptId}-${depth}`}>
          <span>{`${'— '.repeat(depth)}${department.name}`}</span>
          <span>Dept ID: {department.id}</span>
        </div>,
        ...renderDepartmentTree(department.id, depth + 1),
      ];
    });
  return (
    <section className="page-section">
      <h2>User & Department Management</h2>
      <div className="grid-2">
        <section className="panel">
          <h3>Employees</h3>
          {userList.map((user) => (
            <div className="list-item" key={user.id}>
              <div>
                <strong>{user.name}</strong>
                <p>{user.email}</p>
              </div>
              <span>{user.pushEnabled ? 'Push Enabled' : 'Not Enabled'}</span>
            </div>
          ))}
        </section>
        <section className="panel">
          <h3>Department Hierarchy</h3>
          {renderDepartmentTree(null)}
          <h4>Manager → Direct Subordinates</h4>
          {subordinateRows.map((user) => (
            <div className="list-item" key={`sub-${user.id}`}>
              <span>{userList.find((manager) => manager.id === user.managerId)?.name ?? 'Unknown Manager'}</span>
              <span>{user.name}</span>
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}

function NotificationPage({
  selectedEventStats,
  summary,
  onSendReminder,
  onBackToEvents,
}: {
  selectedEventStats: { pushSent: number; pushFailed: number; smsFallbackSent: number };
  summary: { pushSent: number; pushFailed: number; smsFallbackSent: number; reminderHistory: Array<{ id: string; sentAt: string; note: string }> };
  onSendReminder: () => void;
  onBackToEvents: () => void;
}) {
  return (
    <section className="page-section">
      <button className="btn ghost" onClick={onBackToEvents} type="button">
        ← Back to Events
      </button>
      <h2>Notification & Reminder Center</h2>
      <section className="panel">
        <h3 className="section-title">Delivery Summary</h3>
        <div className="stat-grid three">
          <StatCard label="Push Sent" value={selectedEventStats.pushSent} tone="primary" />
          <StatCard label="Push Failed" value={selectedEventStats.pushFailed} tone="danger" />
          <StatCard label="SMS Fallback" value={selectedEventStats.smsFallbackSent} tone="warning" />
        </div>
      </section>
      <div className="grid-2">
        <section className="panel">
          <h3 className="section-title">Reminder Actions</h3>
          <p className="muted-text">Trigger follow-up notifications for employees with no response.</p>
          <button className="btn warning" onClick={onSendReminder} type="button">Send Reminder to Non-Responders</button>
        </section>
        <section className="panel">
          <h3 className="section-title">Reminder History</h3>
          <div className="list">
            {summary.reminderHistory.map((item) => (
              <article className="list-item" key={item.id}>
                <div>
                  <strong>{item.note}</strong>
                  <p>{new Date(item.sentAt).toLocaleString()}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export default App;