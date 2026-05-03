import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from './components/ConfirmModal';
import { Layout } from './components/Layout';
import { Toast } from './components/Toast';
import { DirectReportEventHistoryPage } from './profile/DirectReportEventHistoryPage';
import { DirectReportsListPage } from './profile/DirectReportsListPage';
import { ProfileSettingsPage } from './profile/ProfileSettingsPage';
import { LoginPage, RegisterPage, RoleSelectionPage } from './features/auth/AuthScreens';
import { SupervisorDashboardPage, AdminDashboardPage } from './features/dashboard/DashboardPages';
import { EventManagementPage, EventSelectionPage, NotificationPage, UserManagementPage } from './features/events/EventAndAdminPages';
import { EmployeeHistoryPage, EmployeeHomePage, MemberEventListPage } from './features/member/memberScreens';
import {
  activateEventApi,
  clearAccessToken,
  closeEventApi,
  createEventApi,
  demoAccountsFallbackSeeded,
  getAdminDashboardApi,
  getDemoAccounts,
  getDepartments,
  getEvents,
  getMyNotificationsApi,
  getReports,
  getSupervisorDashboardApi,
  getUsers,
  loginDemoUserApi,
  loginWithEmailApi,
  submitReportApi,
  sendEventRemindersApi,
  type AdminDashboardApi,
  type DemoAccount,
  type PortalNotificationRow,
  type SupervisorDashboardApi,
} from './api';
import {
  appendReminderAudit,
  buildNotificationPageSummary,
  loadContactedMap,
  reminderHistoryForEvent,
  saveContactedMap,
} from './lib/eventLocalPersist';
import { clearEmployeeReportDraft } from './lib/employeeReportDraft';
import type {
  Department,
  EventItem,
  NavKey,
  Role,
  SafetyResponse,
  ToastState,
  User,
} from './types';

type AuthMode = 'login' | 'register';

interface SessionState {
  isLoggedIn: boolean;
  user: User | null;
  availableRoles: Role[];
  currentRole: Role | null;
}

const roleDefaultNav: Record<Role, NavKey> = {
  employee: 'member-home',
  supervisor: 'member-home',
  admin: 'admin-dashboard',
};

function App() {
  const [session, setSession] = useState<SessionState>({ isLoggedIn: false, user: null, availableRoles: [], currentRole: null });
  const [navKey, setNavKey] = useState<NavKey>('member-home');
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

  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitError, setReportSubmitError] = useState<string | null>(null);
  const lastSubmitMetaRef = useRef<{ status: 'safe' | 'need_help'; meta?: { omitStoredAttachment?: boolean } } | null>(null);

  const [supervisorDashboard, setSupervisorDashboard] = useState<SupervisorDashboardApi | null>(null);
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboardApi | null>(null);
  const [myNotifications, setMyNotifications] = useState<PortalNotificationRow[]>([]);
  const [dashboardUpdatedAt, setDashboardUpdatedAt] = useState<number | null>(null);
  const [contactedByEvent, setContactedByEvent] = useState<Record<string, Record<string, boolean>>>({});
  const [auditEpoch, setAuditEpoch] = useState(0);
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

  const subordinateUserIds = useMemo(
    () => users.filter((user) => user.managerId === session.user?.id).map((user) => user.id),
    [users, session.user?.id],
  );

  const hasDirectReports = subordinateUserIds.length > 0;
  const hasManager = Boolean(session.user?.managerId);

  /** 1:僅個人回報 2:回報＋團隊 3:僅團隊 */
  const memberHomeMode: 1 | 2 | 3 = !hasDirectReports ? 1 : hasManager ? 2 : 3;

  const memberListRows = useMemo(() => {
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
    let enriched = list.map((event) => {
      const latest = responses
        .filter((r) => r.eventId === event.id && r.userId === uid)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

      let teamCounts:
        | { total: number; safe: number; needHelp: number; pending: number }
        | undefined;

      if (subordinateUserIds.length > 0) {
        let safe = 0;
        let needHelp = 0;
        let pending = 0;
        for (const sid of subordinateUserIds) {
          const lr = responses
            .filter((r) => r.eventId === event.id && r.userId === sid)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
          if (!lr) pending += 1;
          else if (lr.status === 'safe') safe += 1;
          else needHelp += 1;
        }
        teamCounts = {
          total: subordinateUserIds.length,
          safe,
          needHelp,
          pending,
        };
      }

      return { event, latest, teamCounts };
    });

    if (employeeEventFilter === 'ongoing') {
      if (memberHomeMode === 3) {
        enriched.sort((a, b) => {
          const pendA = a.teamCounts?.pending ?? 0;
          const pendB = b.teamCounts?.pending ?? 0;
          if (pendA !== pendB) return pendB - pendA;
          return new Date(b.event.startAt).getTime() - new Date(a.event.startAt).getTime();
        });
      } else {
        enriched.sort((a, b) => {
          const ap = a.latest ? 1 : 0;
          const bp = b.latest ? 1 : 0;
          if (ap !== bp) return ap - bp;
          return new Date(b.event.startAt).getTime() - new Date(a.event.startAt).getTime();
        });
      }
    } else {
      enriched.sort((a, b) => new Date(b.event.startAt).getTime() - new Date(a.event.startAt).getTime());
    }

    return enriched;
  }, [
    employeeAccessibleEvents,
    employeeDeptId,
    employeeEventFilter,
    employeeListSearch,
    memberHomeMode,
    responses,
    session.user?.id,
    subordinateUserIds,
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

  const supervisorViewAligned =
    session.currentRole === 'supervisor' &&
    !!supervisorDashboard?.event?.id &&
    supervisorDashboard!.event!.id === selectedSupervisorEventId;

  const adminViewAligned =
    session.currentRole === 'admin' && !!adminDashboard?.event?.id && adminDashboard!.event!.id === selectedAdminEventId;

  /** 不依後端快照、僅以前端快照彙總（事件或角色與 dashboard 對齊失敗時使用） */
  const scopedClientRows = useMemo(() => {
    if (!selectedSupervisorEvent && !selectedAdminEvent) return [];
    const eventId =
      session.currentRole === 'admin'
        ? selectedAdminEvent?.id
        : session.currentRole === 'supervisor'
          ? selectedSupervisorEvent?.id
          : '';
    const myId = session.user?.id;
    if (!eventId || !myId) return [];

    const supervisorIds = users
      .filter((user) => user.managerId === myId && user.roles.includes('employee'))
      .map((user) => user.id);

    const sourceUsers = users.filter((u) => {
      if (!u.roles.includes('employee')) return false;
      if (session.currentRole === 'admin') {
        const tids = selectedAdminEvent?.targetDepartmentIds ?? [];
        return tids.length === 0 ? true : tids.includes(u.departmentId);
      }
      return supervisorIds.includes(u.id);
    });

    return sourceUsers.map((u) => {
      const latest = responses
        .filter((r) => r.eventId === eventId && r.userId === u.id)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
      const locLine = latest?.location;
      return {
        id: u.id,
        name: u.name,
        department: departments.find((d) => d.id === u.departmentId)?.name ?? '-',
        status: (latest?.status ?? 'pending') as 'safe' | 'need_help' | 'pending',
        updatedAt: latest?.updatedAt,
        note: latest?.comment,
        phone: u.phone,
        locationLine: locLine,
      };
    });
  }, [
    selectedSupervisorEvent,
    selectedAdminEvent,
    responses,
    session.currentRole,
    session.user?.id,
    departments,
    users,
  ]);

  const employeeRows = useMemo(() => {
    if (session.currentRole === 'supervisor' && supervisorViewAligned && supervisorDashboard?.event?.id === selectedSupervisorEvent?.id) {
      const eventId = supervisorDashboard!.event!.id;
      return supervisorDashboard!.team.map((t) => {
        const uid = t.user_id;
        const latest = responses
          .filter((r) => r.eventId === eventId && r.userId === uid)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        const stRaw = String(t.status);
        const st: 'safe' | 'need_help' | 'pending' =
          stRaw === 'safe' ? 'safe' : stRaw === 'need_help' ? 'need_help' : 'pending';
        const uMeta = users.find((x) => x.id === uid);
        const noteMerge = latest ? [latest.location, latest.comment].filter(Boolean).join(' · ') : undefined;
        return {
          id: uid,
          name: t.name,
          department: t.department,
          status: st,
          updatedAt: t.reported_at ?? latest?.updatedAt,
          note: noteMerge || latest?.comment,
          phone: uMeta?.phone,
          locationLine: latest?.location,
        };
      });
    }
    return scopedClientRows;
  }, [
    session.currentRole,
    supervisorViewAligned,
    supervisorDashboard,
    selectedSupervisorEvent?.id,
    responses,
    users,
    scopedClientRows,
  ]);

  const stats = useMemo(() => {
    if (session.currentRole === 'supervisor' && supervisorViewAligned && supervisorDashboard) {
      const kpis = supervisorDashboard.kpis;
      const totalTeam = supervisorDashboard.team.length;
      const safe = kpis.safe;
      const needHelp = kpis.need_help;
      const pending = kpis.pending;
      const responseRate = totalTeam ? Math.round(((safe + needHelp) / totalTeam) * 100) : 0;
      return { total: totalTeam, safe, needHelp, pending, responseRate };
    }
    if (session.currentRole === 'admin' && adminViewAligned && adminDashboard) {
      const kpis = adminDashboard.kpis;
      const total = kpis.targeted;
      const safe = kpis.safe;
      const needHelp = kpis.need_help;
      const pending = kpis.pending;
      const responseRate = total ? Math.round(((safe + needHelp) / total) * 100) : 0;
      return { total, safe, needHelp, pending, responseRate };
    }
    const total = scopedClientRows.length;
    const safe = scopedClientRows.filter((row) => row.status === 'safe').length;
    const needHelp = scopedClientRows.filter((row) => row.status === 'need_help').length;
    const pending = total - safe - needHelp;
    const responseRate = total ? Math.round(((safe + needHelp) / total) * 100) : 0;
    return { total, safe, needHelp, pending, responseRate };
  }, [session.currentRole, supervisorViewAligned, supervisorDashboard, adminViewAligned, adminDashboard, scopedClientRows]);

  const showToast = useCallback((next: ToastState) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const refreshOperationalData = useCallback(async () => {
    if (!session.isLoggedIn) return;
    try {
      const [repFresh, evtFresh] = await Promise.all([getReports(), getEvents()]);
      setResponses(repFresh);
      setEvents(evtFresh);
    } catch {
      /* retain cache */
    }
    try {
      if (session.currentRole === 'supervisor') {
        const sd = await getSupervisorDashboardApi();
        setSupervisorDashboard(sd);
      }
      if (session.currentRole === 'admin') {
        const ad = await getAdminDashboardApi();
        setAdminDashboard(ad);
      }
    } catch {
      /* dashboards may reject role */
    }
    try {
      const { notifications } = await getMyNotificationsApi();
      setMyNotifications(notifications);
    } catch {
      /* optional */
    }
    setDashboardUpdatedAt(Date.now());
  }, [session.isLoggedIn, session.currentRole]);

  useEffect(() => {
    if (!session.isLoggedIn || session.currentRole === null) return;
    void refreshOperationalData();
  }, [session.isLoggedIn, session.currentRole, refreshOperationalData]);

  useEffect(() => {
    if (!session.isLoggedIn || session.currentRole === null) return undefined;
    const watchNav =
      navKey === 'supervisor-event-detail' ||
      navKey === 'admin-event-detail' ||
      navKey === 'notifications' ||
      navKey === 'notifications-event-detail';
    if (!watchNav) return undefined;
    const tid = window.setInterval(() => void refreshOperationalData(), 28_000);
    return () => window.clearInterval(tid);
  }, [session.isLoggedIn, session.currentRole, navKey, refreshOperationalData]);

  useEffect(() => {
    if (!session.isLoggedIn) return undefined;
    const bump = () => {
      if (document.visibilityState === 'visible') void refreshOperationalData();
    };
    const onFocus = () => void refreshOperationalData();
    document.addEventListener('visibilitychange', bump);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', bump);
      window.removeEventListener('focus', onFocus);
    };
  }, [session.isLoggedIn, refreshOperationalData]);

  useEffect(() => {
    if (navKey !== 'employee-event-detail') {
      setReportSubmitError(null);
    }
  }, [navKey]);

  useEffect(() => {
    if (!selectedSupervisorEventId || session.currentRole !== 'supervisor') return;
    setContactedByEvent((prev) => ({
      ...prev,
      [selectedSupervisorEventId]: loadContactedMap(selectedSupervisorEventId),
    }));
  }, [selectedSupervisorEventId, session.currentRole]);

  const toggleNeedHelpContact = useCallback(
    (userId: string) => {
      if (!selectedSupervisorEventId || session.currentRole !== 'supervisor') return;
      const eid = selectedSupervisorEventId;
      const base = contactedByEvent[eid] ?? loadContactedMap(eid);
      const nextMap = { ...base, [userId]: !(base[userId] ?? false) };
      saveContactedMap(eid, nextMap);
      setContactedByEvent((prev) => ({ ...prev, [eid]: nextMap }));
    },
    [contactedByEvent, selectedSupervisorEventId, session.currentRole],
  );

  const dispatchRemindersForEvent = useCallback(
    async (eventId: string) => {
      try {
        const out = await sendEventRemindersApi(eventId);
        const rid =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `rem-${Date.now()}`;
        appendReminderAudit({
          id: rid,
          eventId,
          sentAt: new Date().toISOString(),
          sent: out.sent,
          alreadySafe: out.already_safe,
          totalTeam: out.total_team,
        });
        setAuditEpoch((n) => n + 1);
        showToast({
          tone: 'success',
          message: `${out.message}: dispatched ${out.sent} · skipped safe ${out.already_safe}`,
        });
        await refreshOperationalData();
      } catch (e) {
        showToast({ tone: 'danger', message: e instanceof Error ? e.message : '無法發送提醒' });
      }
    },
    [refreshOperationalData, showToast],
  );

  const handleLogin = async (demoId: string) => {
    clearAccessToken();
    const account = demoAccountsForLogin.find((item) => item.id === demoId);
    if (!account) return;
    const cachedUser = users.find((u) => u.id === account.userId);
    if (!cachedUser) {
      showToast({
        tone: 'danger',
        message: '載入使用者清單後才能 Demo 登入。請確認 /api/users 可走通並重新整理頁面。',
      });
      return;
    }
    try {
      const { user: tokenUser } = await loginDemoUserApi(cachedUser.id);
      mergeUserIntoList(tokenUser);
      const initialRole = account.roles[0];
      setSession({
        isLoggedIn: true,
        user: tokenUser,
        availableRoles: account.roles,
        currentRole: account.roles.length === 1 ? initialRole : null,
      });
      setNavKey(roleDefaultNav[initialRole]);
    } catch (e) {
      showToast({
        tone: 'danger',
        message:
          e instanceof Error
            ? e.message
            : 'Demo 登入未取得 JWT（後端請升級並啟動 /api/auth/demo-login）；暫請改用 Email 登入。',
      });
    }
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
    lastSubmitMetaRef.current = { status, meta };
    setReportSubmitError(null);
    setReportSubmitting(true);
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
      clearEmployeeReportDraft(uid, eid);
      setResponses((prev) => [
        ...prev.filter((r) => !(r.eventId === nextResponse.eventId && r.userId === nextResponse.userId)),
        nextResponse,
      ]);
      lastSubmitMetaRef.current = null;
      showToast({ tone: 'success', message: `Report received at ${new Date(nextResponse.updatedAt).toLocaleTimeString()}` });
      void refreshOperationalData();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : '送出失敗，請檢查網路或稍後重試。（系統將在弱網下自動重試數次）';
      setReportSubmitError(msg);
      showToast({ tone: 'danger', message: msg });
    } finally {
      setReportSubmitting(false);
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
      await refreshOperationalData();
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
      await refreshOperationalData();
      const activatedId = out.event.id;
      setSelectedAdminEventId(activatedId);
      setSelectedSupervisorEventId(activatedId);
      setSelectedEmployeeEventId(activatedId);
      setSelectedNotificationEventId(activatedId);
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
      await refreshOperationalData();
      showToast({ tone: 'info', message: 'Event closed.' });
    } catch (e) {
      showToast({ tone: 'danger', message: e instanceof Error ? e.message : '關閉失敗' });
    }
  };

  const notificationLiveSummary = useMemo(() => {
    const eid = selectedNotificationEventId;
    const evt = events.find((x) => x.id === eid);
    const tids = evt?.targetDepartmentIds ?? [];
    const targeted = users.filter(
      (u) => u.roles.includes('employee') && (tids.length === 0 || tids.includes(u.departmentId)),
    ).length;
    const uniq = new Set(responses.filter((r) => r.eventId === eid).map((r) => r.userId));
    const hist = reminderHistoryForEvent(eid);
    const rowsMine = myNotifications.filter((n) => n.eventId === eid);
    return buildNotificationPageSummary({
      reminderHistory: hist,
      apiRowsSameUser: rowsMine.map((r) => ({ channel: r.channel, status: r.status })),
      targetedEmployeeCountForEvent: targeted,
      responsesCountForEvent: uniq.size,
    });
  }, [events, users, responses, selectedNotificationEventId, myNotifications, auditEpoch]);

  const contactedForSupervisorRow = contactedByEvent[selectedSupervisorEventId] ?? {};

  const pendingRatioHigh =
    session.currentRole === 'supervisor' && stats.total > 0 ? stats.pending / stats.total >= 0.3 : false;
  const allTeamResponded = session.currentRole === 'supervisor' && stats.total > 0 && stats.pending === 0;

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
          navKey === 'employee-event-detail' || navKey === 'supervisor-event-detail'
            ? 'member-home'
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
        {navKey === 'member-home' && session.currentRole !== 'admin' && (
          <MemberEventListPage
            mode={memberHomeMode}
            rows={memberListRows}
            selectedPersonalEventId={selectedEmployeeEventId}
            selectedTeamEventId={selectedSupervisorEventId}
            onOpenPersonal={(eventId) => {
              setSelectedEmployeeEventId(eventId);
              setNavKey('employee-event-detail');
            }}
            onOpenTeam={(eventId) => {
              setSelectedSupervisorEventId(eventId);
              setNavKey('supervisor-event-detail');
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
            draftUserId={session.user?.id ?? null}
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
            reportSubmitting={reportSubmitting}
            submitErrorMessage={reportSubmitError}
            onDismissSubmitError={() => setReportSubmitError(null)}
            onRetrySubmit={() => {
              const p = lastSubmitMetaRef.current;
              if (!p) return;
              void submitEmployeeStatus(p.status, p.meta);
            }}
            onSubmit={submitEmployeeStatus}
            onBackToEvents={() => setNavKey('member-home')}
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
        {navKey === 'supervisor-event-detail' && (
          <SupervisorDashboardPage
            stats={stats}
            rows={employeeRows}
            filter={supervisorFilter}
            setFilter={setSupervisorFilter}
            searchText={searchText}
            setSearchText={setSearchText}
            contactedMap={contactedForSupervisorRow}
            onToggleContacted={toggleNeedHelpContact}
            pendingRatioHigh={pendingRatioHigh}
            allRespondedBanner={allTeamResponded}
            dashMismatchHint={
              supervisorDashboard?.event?.id &&
              selectedSupervisorEvent?.id &&
              supervisorDashboard.event.id !== selectedSupervisorEvent.id
                ? `圖表中 KPI／圓餅為後端目前「進行中」主事件：${supervisorDashboard.event.title}；下方表格仍以您選取的事件為準。`
                : null
            }
            dashboardFreshAt={dashboardUpdatedAt}
            onSendReminder={() => {
              const eid = selectedSupervisorEvent?.id;
              if (eid) void dispatchRemindersForEvent(eid);
            }}
            onExport={() => showToast({ tone: 'info', message: 'Report exported and email queued.' })}
            onBackToEvents={() => setNavKey('member-home')}
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
            deptBreakdown={adminViewAligned && adminDashboard ? adminDashboard.departments : undefined}
            dashboardFreshAt={dashboardUpdatedAt}
            dashMismatchHint={
              adminDashboard?.event?.id &&
              selectedAdminEvent?.id &&
              adminDashboard.event.id !== selectedAdminEvent.id
                ? `區塊中 KPI／部門細項為後端目前「進行中」主事件：${adminDashboard.event.title}；詳列員工仍以您選取的事件為準。`
                : null
            }
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
            summary={notificationLiveSummary}
            canSendReminder={session.currentRole === 'supervisor'}
            onSendReminder={() => dispatchRemindersForEvent(selectedNotificationEventId)}
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


export default App;
