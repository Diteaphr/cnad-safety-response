import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Layout } from './components/Layout';
import {
  ReportSubmissionOverlay,
  type ReportSubmissionSummary,
} from './components/ReportSubmissionOverlay';
import { Toast } from './components/Toast';
import { DirectReportEventHistoryPage } from './profile/DirectReportEventHistoryPage';
import { DirectReportsListPage } from './profile/DirectReportsListPage';
import { FirstLoginWizard } from './profile/SetupGuideWizard';
import { ProfileSettingsPage } from './profile/ProfileSettingsPage';
import { LoginPage } from './features/auth/AuthScreens';
import { SupervisorDashboardPage, type DashboardStatusFilter } from './features/dashboard/DashboardPages';
import {
  GlobalNotificationInboxPage,
  UserManagementPage,
  createInitialEventForm,
} from './features/events/EventAndAdminPages';
import { AdminEventCenterPage } from './features/events/AdminEventCenterPage';
import {
  MemberPriorityHomePage,
  MemberReportHistoryPage,
  type EmployeeReportFields,
  type MemberHomeRow,
  type MemberMode,
} from './features/member/memberScreens';
import {
  clearAccessToken,
  closeEventApi,
  createEventApi,
  getAdminDashboardApi,
  getDepartments,
  getEventTypesApi,
  getEvents,
  getMyNotificationsApi,
  getMyProfileApi,
  getReports,
  getSupervisorDashboardApi,
  getUsers,
  loginWithEmailApi,
  submitReportApi,
  type AdminDashboardApi,
  type PortalNotificationRow,
  type SupervisorDashboardApi,
} from './api';
import { deriveUserCapabilities, initialSurfaceFromRoles } from './lib/portalSessionRoles';
import {
  applySupervisorNudgeAfterSubmit,
  buildLocalSafetyResponse,
  countTeamStatusForEvent,
  clearStoredPortalNav,
  enrichApiSafetyResponse,
  latestResponseFor,
  mergeReportsWithOptimistic,
  mergeUserResponseList,
  navKeyAfterSurfaceGuard,
  newLocalId,
  readPortalAccessToken,
  readStoredPortalNav,
  readStoredPortalSurface,
  resolveDetailEventId,
  resolveMemberHomeMode,
  resolveRestoredEventSelection,
  resolveRestoredNavKey,
  resolveSupervisorTeamRowStatus,
  shouldOpenSubmissionOverlay,
  showForegroundPushNotification,
  submissionSummaryFromResponse,
  trimmedDashboardEventId,
  writePortalNav,
  writePortalSurface,
} from './app/portalAppLib';
import { loadContactedMap, saveContactedMap } from './lib/eventLocalPersist';
import { clearEmployeeReportDraft } from './lib/employeeReportDraft';
import { datetimeLocalToUtcIso, formatLocaleTime, nowMs, nowUtcIso } from './lib/localTime';
import { stripRedundantStatusFromTitle } from './lib/adminEventDisplay';
import { useLocale } from './locale/LocaleContext';
import { getStrings } from './locale/strings';
import type {
  AdminEventListRow,
  AppSurface,
  Department,
  EventItem,
  NavKey,
  SafetyResponse,
  ToastState,
  User,
  UserCapabilities,
} from './types';
import { compareEventsByStartThenCreatedDesc } from './types';
import { scrollPortalMainToTop } from './lib/scrollPortalMain';

const emptyCaps: UserCapabilities = {
  canManage: false,
  canViewTeam: false,
  hasStaffPortal: false,
};

interface SessionState {
  isLoggedIn: boolean;
  user: User | null;
  surface: AppSurface;
  caps: UserCapabilities;
}

function App() {
  const { locale } = useLocale();

  const [session, setSession] = useState<SessionState>({
    isLoggedIn: false,
    user: null,
    surface: 'member',
    caps: emptyCaps,
  });
  const [sessionBootstrapping, setSessionBootstrapping] = useState(() => Boolean(readPortalAccessToken()));
  const [navKey, setNavKey] = useState<NavKey>('member-home');
  const [supervisorTeamNudge, setSupervisorTeamNudge] = useState<null | { pendingPct: number; eventTitle: string }>(null);
  const [supervisorOpenedDetailFrom, setSupervisorOpenedDetailFrom] = useState<'member-home' | 'team-dashboard-home'>(
    'member-home',
  );
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const useMockOfflineCatalog = false;
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [responses, setResponses] = useState<SafetyResponse[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [submissionOverlay, setSubmissionOverlay] = useState<{
    variant: 'safe' | 'need_help';
    mode: 'initial' | 'revision';
    eventTitle: string;
    submittedSummary?: ReportSubmissionSummary;
  } | null>(null);
  const [profileSubordinateUserId, setProfileSubordinateUserId] = useState<string | null>(null);

  const [submittingReportEventId, setSubmittingReportEventId] = useState<string | null>(null);
  const [reportSubmitError, setReportSubmitError] = useState<string | null>(null);
  const [reportSubmitErrorEventId, setReportSubmitErrorEventId] = useState<string | null>(null);
  const lastSubmitMetaRef = useRef<{
    eventId: string;
    status: 'safe' | 'need_help';
    fields: EmployeeReportFields;
    meta?: { omitStoredAttachment?: boolean; showOverlay?: boolean };
  } | null>(null);

  const [supervisorDashboard, setSupervisorDashboard] = useState<SupervisorDashboardApi | null>(null);
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboardApi | null>(null);
  const [myNotifications, setMyNotifications] = useState<PortalNotificationRow[]>([]);
  const [dashboardUpdatedAt, setDashboardUpdatedAt] = useState<number | null>(null);
  const [contactedByEvent, setContactedByEvent] = useState<Record<string, Record<string, boolean>>>({});
  const [selectedSupervisorEventId, setSelectedSupervisorEventId] = useState('');
  const [selectedAdminEventId, setSelectedAdminEventId] = useState('');
  const eventsSelectionInitialized = useRef(false);
  const supervisorDashEventIdRef = useRef('');
  const adminDashEventIdRef = useRef('');
  const optimisticResponsesRef = useRef<Map<string, SafetyResponse>>(new Map());
  const [adminDepartmentFilter, setAdminDepartmentFilter] = useState('all');
  const [closingAdminEventId, setClosingAdminEventId] = useState<string | null>(null);
  const [userMgmtSelectedDeptId, setUserMgmtSelectedDeptId] = useState<string | null>(null);
  const [userMgmtAddModalOpen, setUserMgmtAddModalOpen] = useState(false);
  const [eventTypeCatalog, setEventTypeCatalog] = useState<{ name: string }[] | null>(null);

  const loadCatalogFromApi = useCallback(async () => {
    setCatalogError(null);
    try {
      const [deptRows, userRows, evRows, respRows, typeRows] = await Promise.all([
        getDepartments(),
        getUsers(),
        getEvents(),
        getReports(),
        getEventTypesApi().catch(() => []),
      ]);
      setDepartments(deptRows);
      setUsers(userRows);
      setEvents(evRows);
      setResponses(respRows);
      setEventTypeCatalog(typeRows.length > 0 ? typeRows.map((r) => ({ name: r.name })) : null);
    } catch (e) {
      const raw = e instanceof Error ? e.message : '無法載入資料';
      const friendly =
        raw === 'Not Found' || raw.includes('404')
          ? '後端 API 無回應（請確認 CNAD 後端已啟動，且非 8000 上其他專案）。登入仍可嘗試。'
          : raw;
      setCatalogError(friendly);
    } finally {
      setCatalogLoaded(true);
    }
  }, []);

  const refreshEventTypes = useCallback(async () => {
    try {
      const typeRows = await getEventTypesApi();
      setEventTypeCatalog(typeRows.length > 0 ? typeRows.map((r) => ({ name: r.name })) : null);
    } catch {
      /* keep cached catalog */
    }
  }, []);

  const mergeUserIntoList = useCallback((user: User) => {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === user.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = user;
        return next;
      }
      return [...prev, user];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadCatalogFromApi();
        if (cancelled) return;
        const token = readPortalAccessToken();
        if (!token) return;
        const user = await getMyProfileApi();
        if (cancelled) return;
        mergeUserIntoList(user);
        const capsNext = deriveUserCapabilities(user.roles);
        let surfaceNext = initialSurfaceFromRoles(user.roles);
        const storedSurface = readStoredPortalSurface();
        if (storedSurface === 'adminCenter' && capsNext.canManage) surfaceNext = 'adminCenter';
        const storedNav = readStoredPortalNav();
        setSession({
          isLoggedIn: true,
          user,
          surface: surfaceNext,
          caps: capsNext,
        });
        setNavKey(resolveRestoredNavKey(surfaceNext, capsNext, storedNav));
        if (storedNav?.supervisorOpenedDetailFrom) {
          setSupervisorOpenedDetailFrom(storedNav.supervisorOpenedDetailFrom);
        }
        if (storedNav?.profileSubordinateUserId) {
          setProfileSubordinateUserId(storedNav.profileSubordinateUserId);
        }
      } catch {
        if (!cancelled) clearAccessToken();
      } finally {
        if (!cancelled) setSessionBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCatalogFromApi, mergeUserIntoList]);

  useEffect(() => {
    if (!session.isLoggedIn || useMockOfflineCatalog) return;
    writePortalSurface(session.surface);
  }, [session.isLoggedIn, session.surface, useMockOfflineCatalog]);

  useEffect(() => {
    if (!session.isLoggedIn) return;
    writePortalNav({
      navKey,
      supervisorOpenedDetailFrom,
      selectedSupervisorEventId: selectedSupervisorEventId || undefined,
      selectedAdminEventId: selectedAdminEventId || undefined,
      profileSubordinateUserId,
    });
  }, [
    session.isLoggedIn,
    navKey,
    supervisorOpenedDetailFrom,
    selectedSupervisorEventId,
    selectedAdminEventId,
    profileSubordinateUserId,
  ]);

  useEffect(() => {
    if (events.length === 0) return;
    if (eventsSelectionInitialized.current) return;
    eventsSelectionInitialized.current = true;
    const restored = resolveRestoredEventSelection(events, readStoredPortalNav());
    setSelectedSupervisorEventId(restored.supervisorEventId);
    setSelectedAdminEventId(restored.adminEventId);
  }, [events]);

  useEffect(() => {
    supervisorDashEventIdRef.current = selectedSupervisorEventId;
  }, [selectedSupervisorEventId]);
  useEffect(() => {
    adminDashEventIdRef.current = selectedAdminEventId;
  }, [selectedAdminEventId]);

  // Show notifications when the app is in the foreground (onMessage fires instead of SW).
  useEffect(() => {
    if (!session.isLoggedIn) return;
    let unsub: (() => void) | undefined;
    void import('./lib/firebase').then(({ isFirebaseConfigured, onForegroundMessage }) => {
      if (!isFirebaseConfigured()) return;
      unsub = onForegroundMessage((payload: unknown) => {
        const p = payload as { notification?: { title?: string; body?: string } };
        const title = p.notification?.title ?? '安全確認';
        const body = p.notification?.body ?? '';
        showForegroundPushNotification(title, body);
      });
    });
    return () => unsub?.();
  }, [session.isLoggedIn]);

  // Listen for SW_PUSH_RECEIVED to confirm the service worker got the push event.
  useEffect(() => {
    if (!session.isLoggedIn) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'SW_PUSH_RECEIVED') {
        console.log('[App] SW received push, hasData:', e.data.hasData);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [session.isLoggedIn]);

  const [supervisorFilter, setSupervisorFilter] = useState<'all' | 'safe' | 'need_help'>('all');
  const [adminFilter, setAdminFilter] = useState<DashboardStatusFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [eventForm, setEventForm] = useState(createInitialEventForm);
  const [supervisorDeptFilter, setSupervisorDeptFilter] = useState<string>('all');

  const employeeDeptId = session.user?.departmentId;

  const employeeAccessibleEvents = useMemo(() => {
    return events.filter((event) => {
      if (event.status !== 'active' && event.status !== 'closed') return false;
      const tids = event.targetDepartmentIds;
      if (tids.length === 0) return true; // company-wide: visible to everyone
      return !!employeeDeptId && tids.includes(employeeDeptId);
    });
  }, [events, employeeDeptId]);

  const subordinateUserIds = useMemo(
    () => users.filter((user) => user.managerId === session.user?.id).map((user) => user.id),
    [users, session.user?.id],
  );

  const hasDirectReports = subordinateUserIds.length > 0;
  const hasManager = Boolean(session.user?.managerId);

  /** @see MemberMode in memberTypes.ts */
  const memberHomeMode: MemberMode = resolveMemberHomeMode(hasDirectReports, hasManager);

  const memberListRowsOngoing: MemberHomeRow[] = useMemo(() => {
    const uid = session.user?.id;
    if (!uid || !employeeDeptId) return [];
    const list = employeeAccessibleEvents.filter((e) => e.status === 'active');
    const enriched = list.map((event) => {
      const latest = latestResponseFor(responses, event.id, uid);

      const teamCounts =
        subordinateUserIds.length > 0
          ? (() => {
              const t = countTeamStatusForEvent(responses, event.id, subordinateUserIds);
              return { total: t.total, safe: t.safe, needHelp: t.needHelp, pending: t.pending };
            })()
          : undefined;

      return { event, latest, teamCounts };
    });

    if (memberHomeMode === 3) {
      enriched.sort((a, b) => {
        const pendA = a.teamCounts?.pending ?? 0;
        const pendB = b.teamCounts?.pending ?? 0;
        if (pendA !== pendB) return pendB - pendA;
        return compareEventsByStartThenCreatedDesc(a.event, b.event);
      });
    } else {
      enriched.sort((a, b) => {
        const ap = a.latest ? 1 : 0;
        const bp = b.latest ? 1 : 0;
        if (ap !== bp) return ap - bp;
        return compareEventsByStartThenCreatedDesc(a.event, b.event);
      });
    }

    return enriched;
  }, [
    employeeAccessibleEvents,
    employeeDeptId,
    memberHomeMode,
    responses,
    session.user?.id,
    subordinateUserIds,
  ]);

  const memberPriorityView = useMemo((): { kind: 'personal_stack' | 'idle'; rows: MemberHomeRow[] } => {
    const pend = memberListRowsOngoing.filter((r) => !r.latest);
    return pend.length ? { kind: 'personal_stack', rows: pend } : { kind: 'idle', rows: [] };
  }, [memberListRowsOngoing]);

  const hasPendingPersonalReports =
    session.surface === 'member' && memberPriorityView.kind === 'personal_stack';

  const idlePersonalHistory = useMemo(() => {
    const uid = session.user?.id;
    if (!uid || !employeeDeptId) return { ongoing: [] as MemberHomeRow[], closed: [] as MemberHomeRow[] };
    const ongoing: MemberHomeRow[] = [];
    const closed: MemberHomeRow[] = [];
    for (const event of employeeAccessibleEvents) {
      const latest = responses
        .filter((r) => r.eventId === event.id && r.userId === uid)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
      if (!latest) continue;
      const row: MemberHomeRow = { event, latest };
      if (event.status === 'active') ongoing.push(row);
      else if (event.status === 'closed') closed.push(row);
    }
    const sorter = (a: MemberHomeRow, b: MemberHomeRow) =>
      new Date((b.latest as SafetyResponse).updatedAt).getTime() -
      new Date((a.latest as SafetyResponse).updatedAt).getTime();
    ongoing.sort(sorter);
    closed.sort(sorter);
    return { ongoing, closed };
  }, [employeeAccessibleEvents, responses, session.user?.id, employeeDeptId]);

  const supervisorEventListRows = useMemo((): AdminEventListRow[] => {
    if (!hasDirectReports) return [];
    return employeeAccessibleEvents
      .map((event) => {
        const { safe, needHelp, pending, total } = countTeamStatusForEvent(
          responses,
          event.id,
          subordinateUserIds,
        );
        const reported = safe + needHelp;
        const responseRate = total ? Math.round((reported / total) * 100) : 0;
        let lastTs = new Date(event.startAt ?? event.createdAt).getTime();
        for (const sid of subordinateUserIds) {
          const lr = latestResponseFor(responses, event.id, sid);
          if (lr?.updatedAt) {
            const t = new Date(lr.updatedAt).getTime();
            if (t > lastTs) lastTs = t;
          }
        }
        return {
          event,
          total,
          safe,
          needHelp,
          pending,
          responseRate,
          reported,
          lastActivityAt: lastTs,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => compareEventsByStartThenCreatedDesc(a.event, b.event));
  }, [hasDirectReports, employeeAccessibleEvents, subordinateUserIds, responses]);

  const layoutNavKey = useMemo((): NavKey => {
    if (navKey === 'member-report-history') return 'member-home';
    if (navKey === 'supervisor-event-detail') {
      if (supervisorOpenedDetailFrom === 'team-dashboard-home') {
        return 'team-dashboard-home';
      }
      return 'member-home';
    }
    if (navKey === 'admin-event-detail') return 'admin-dashboard';
    if (navKey === 'profile-direct-reports-list' || navKey === 'profile-direct-report-history') return 'profile';
    return navKey;
  }, [navKey, supervisorOpenedDetailFrom]);

  useLayoutEffect(() => {
    scrollPortalMainToTop();
  }, [navKey]);
  const selectedSupervisorEvent = useMemo(
    () => events.find((event) => event.id === selectedSupervisorEventId) ?? null,
    [events, selectedSupervisorEventId],
  );
  const selectedAdminEvent = useMemo(
    () => events.find((event) => event.id === selectedAdminEventId) ?? null,
    [events, selectedAdminEventId],
  );

  const supervisorDashMismatchHint = useMemo(() => {
    const dash = getStrings(locale).dash;
    if (
      !supervisorDashboard?.event?.id ||
      !selectedSupervisorEvent?.id ||
      supervisorDashboard.event.id === selectedSupervisorEvent.id
    ) {
      return null;
    }
    return dash.snapshotMismatchDetail(supervisorDashboard.event.title, selectedSupervisorEvent.title);
  }, [
    locale,
    supervisorDashboard?.event?.id,
    supervisorDashboard?.event?.title,
    selectedSupervisorEvent?.id,
    selectedSupervisorEvent?.title,
  ]);

  const adminDashMismatchHint = useMemo(() => {
    const dash = getStrings(locale).dash;
    if (
      !adminDashboard?.event?.id ||
      !selectedAdminEvent?.id ||
      adminDashboard.event.id === selectedAdminEvent.id
    ) {
      return null;
    }
    return dash.snapshotMismatchDetail(adminDashboard.event.title, selectedAdminEvent.title);
  }, [
    locale,
    adminDashboard?.event?.id,
    adminDashboard?.event?.title,
    selectedAdminEvent?.id,
    selectedAdminEvent?.title,
  ]);

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

  const mobileShell = useMemo((): { title: string; onBack?: () => void } => {
    const { layoutNav: LN, layoutChrome: LC, profilePage: PP } = getStrings(locale);
    switch (navKey) {
      case 'member-home':
        return { title: LC.mobileAppTitle };
      case 'member-report-history':
        return {
          title: LN.reportHistory,
          onBack: () => setNavKey('member-home'),
        };
      case 'team-dashboard-home':
        return { title: LN.teamReports };
      case 'notifications':
        return { title: LN.notifications };
      case 'profile':
        return {
          title:
            session.surface === 'adminCenter' && !session.caps.hasStaffPortal
              ? LN.adminSystemSettings
              : LN.accountSettings,
        };
      case 'admin-dashboard':
        return { title: LC.adminSidebarTitle };
      case 'user-management': {
        const { portal: PP } = getStrings(locale);
        if (userMgmtAddModalOpen) {
          return {
            title: PP.userMgmtAddAccount,
            onBack: () => setUserMgmtAddModalOpen(false),
          };
        }
        if (userMgmtSelectedDeptId) {
          return {
            title: PP.userMgmtEmployeeRosterNavTitle,
            onBack: () => setUserMgmtSelectedDeptId(null),
          };
        }
        return { title: LN.adminUsers };
      }
      case 'supervisor-event-detail': {
        const { dash } = getStrings(locale);
        return {
          title: dash.supervisorEventDetailTitle,
          onBack: () =>
            setNavKey(supervisorOpenedDetailFrom === 'team-dashboard-home' ? 'team-dashboard-home' : 'member-home'),
        };
      }
      case 'admin-event-detail': {
        const { dash } = getStrings(locale);
        return {
          title: dash.adminEventDetailTitle,
          onBack: () => setNavKey('admin-dashboard'),
        };
      }
      case 'profile-direct-reports-list':
        return {
          title: PP.directReports,
          onBack: () => setNavKey('profile'),
        };
      case 'profile-direct-report-history':
        return {
          title: profileHistorySubordinate?.name ?? PP.directReports,
          onBack: () =>
            setNavKey(profileDirectReports.length > 1 ? 'profile-direct-reports-list' : 'profile'),
        };
      default:
        return { title: LC.mobileAppTitle };
    }
  }, [
    locale,
    navKey,
    session.surface,
    session.caps.hasStaffPortal,
    selectedSupervisorEvent?.title,
    selectedAdminEvent?.title,
    supervisorOpenedDetailFrom,
    profileHistorySubordinate?.name,
    profileDirectReports.length,
    userMgmtSelectedDeptId,
    userMgmtAddModalOpen,
    departments,
  ]);

  useEffect(() => {
    if (navKey !== 'user-management') {
      setUserMgmtSelectedDeptId(null);
      setUserMgmtAddModalOpen(false);
    }
  }, [navKey]);

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

  const supervisorUi = session.surface === 'member' && session.caps.canViewTeam;
  const adminUi = session.surface === 'adminCenter';

  useEffect(() => {
    if (!session.isLoggedIn || !session.user) return;
    const redirect = navKeyAfterSurfaceGuard(session.surface, session.caps, navKey);
    if (redirect) setNavKey(redirect);
  }, [session.isLoggedIn, session.user, session.surface, session.caps.canViewTeam, session.caps.hasStaffPortal, navKey]);

  useEffect(() => {
    if (!hasPendingPersonalReports) return;
    if (navKey === 'member-home') return;
    setNavKey('member-home');
  }, [hasPendingPersonalReports, navKey]);

  useEffect(() => {
    if (!session.isLoggedIn || !hasPendingPersonalReports) return undefined;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setNavKey((nk) => (nk === 'member-home' ? nk : 'member-home'));
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [session.isLoggedIn, hasPendingPersonalReports]);

  const supervisorViewAligned =
    supervisorUi &&
    !!supervisorDashboard?.event?.id &&
    supervisorDashboard.event.id === selectedSupervisorEventId;

  /** 不依後端快照、僅以前端快照彙總（事件或角色與 dashboard 對齊失敗時使用） */
  const scopedClientRows = useMemo(() => {
    if (!selectedSupervisorEvent && !selectedAdminEvent) return [];
    const eventId = resolveDetailEventId(
      adminUi,
      supervisorUi,
      selectedAdminEvent?.id,
      selectedSupervisorEvent?.id,
    );
    const myId = session.user?.id;
    if (!eventId || !myId) return [];

    /** 與後端 `list_line_reports` / API `managerId`（derived line manager）一致 */
    const lineReportIds = new Set(
      users.filter((user) => user.managerId === myId).map((user) => user.id),
    );

    const sourceUsers = users.filter((u) => {
      if (adminUi) {
        if (!u.roles.includes('employee')) return false;
        const tids = selectedAdminEvent?.targetDepartmentIds ?? [];
        return tids.length === 0 ? true : tids.includes(u.departmentId);
      }
      return lineReportIds.has(u.id);
    });

    return sourceUsers.map((u) => {
      const latest = latestResponseFor(responses, eventId, u.id);
      const locLine = latest?.location;
      const status: 'safe' | 'need_help' | 'pending' = latest?.status ?? 'pending';
      return {
        id: u.id,
        name: u.name,
        department: departments.find((d) => d.id === u.departmentId)?.name ?? '-',
        status,
        updatedAt: latest?.updatedAt,
        note: latest?.comment,
        phone: u.phone,
        email: u.email,
        locationLine: locLine,
      };
    });
  }, [
    selectedSupervisorEvent,
    selectedAdminEvent,
    responses,
    adminUi,
    supervisorUi,
    session.user?.id,
    departments,
    users,
  ]);

  const adminEventListRows = useMemo((): AdminEventListRow[] => {
    return events.map((event) => {
      const tids = event.targetDepartmentIds ?? [];
      const sourceUsers = users.filter((u) => {
        if (!u.roles.includes('employee')) return false;
        return tids.length === 0 ? true : tids.includes(u.departmentId);
      });
      let safe = 0;
      let needHelp = 0;
      let pending = 0;
      let lastTs = new Date(event.startAt ?? event.createdAt).getTime();
      for (const u of sourceUsers) {
        const latest = responses
          .filter((r) => r.eventId === event.id && r.userId === u.id)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        const st = latest?.status ?? 'pending';
        if (st === 'safe') safe++;
        else if (st === 'need_help') needHelp++;
        else pending++;
        if (latest?.updatedAt) {
          const t = new Date(latest.updatedAt).getTime();
          if (t > lastTs) lastTs = t;
        }
      }
      const total = sourceUsers.length;
      const reported = safe + needHelp;
      const responseRate = total ? Math.round((reported / total) * 100) : 0;
      return {
        event,
        total,
        safe,
        needHelp,
        pending,
        responseRate,
        reported,
        lastActivityAt: lastTs,
      };
    })
    .sort((a, b) => compareEventsByStartThenCreatedDesc(a.event, b.event));
  }, [events, users, responses]);

  const employeeRows = useMemo(() => {
    const dash = supervisorDashboard;
    if (
      supervisorUi &&
      supervisorViewAligned &&
      dash?.event &&
      dash.event.id === selectedSupervisorEvent?.id
    ) {
      const eventId = dash.event.id;
      return dash.team.map((t) => {
        const uid = t.user_id;
        const latest = latestResponseFor(responses, eventId, uid);
        const st = resolveSupervisorTeamRowStatus(
          t.status ?? undefined,
          latest,
          t.sub_team_summary,
          t.needs_follow_up,
        );
        const uMeta = users.find((x) => x.id === uid);
        const noteMerge = latest ? [latest.location, latest.comment].filter(Boolean).join(' · ') : undefined;
        const portal = getStrings(locale).portal;
        const subNote =
          t.sub_team_summary == null
            ? undefined
            : portal.supervisorSubTeamNote(
                t.sub_team_summary.safe,
                t.sub_team_summary.need_help,
                t.sub_team_summary.pending,
                t.sub_team_summary.total ?? 0,
              );
        return {
          id: uid,
          name: t.is_supervisor ? `${t.name}（${portal.supervisorSubTeamLead}）` : t.name,
          department: t.department,
          status: st,
          updatedAt: t.reported_at ?? latest?.updatedAt,
          note: subNote ?? noteMerge ?? latest?.comment,
          phone: t.phone ?? uMeta?.phone,
          email: uMeta?.email,
          locationLine: latest?.location,
          isSubTeamLead: Boolean(t.is_supervisor && t.sub_team_summary),
        };
      });
    }
    return scopedClientRows;
  }, [
    supervisorUi,
    supervisorViewAligned,
    supervisorDashboard,
    selectedSupervisorEvent?.id,
    responses,
    users,
    scopedClientRows,
    locale,
  ]);

  const adminDepartmentOptions = useMemo(() => {
    const names = new Set(
      employeeRows.map((r) => r.department).filter((d) => d && d !== '-' && d.trim() !== ''),
    );
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [employeeRows]);

  const adminShowDeptTabs = adminDepartmentOptions.length > 1;

  const adminFilteredRows = useMemo(() => {
    if (!adminShowDeptTabs || adminDepartmentFilter === 'all') return employeeRows;
    return employeeRows.filter((r) => r.department === adminDepartmentFilter);
  }, [employeeRows, adminDepartmentFilter, adminShowDeptTabs]);

  const supervisorDepartmentOptions = useMemo(() => {
    const names = new Set(
      employeeRows.map((r) => r.department).filter((d) => d && d !== '-' && d.trim() !== ''),
    );
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [employeeRows]);

  const supervisorShowDeptTabs = supervisorDepartmentOptions.length > 1;

  const supervisorFilteredRows = useMemo(() => {
    if (!supervisorShowDeptTabs || supervisorDeptFilter === 'all') return employeeRows;
    return employeeRows.filter((r) => r.department === supervisorDeptFilter);
  }, [employeeRows, supervisorDeptFilter, supervisorShowDeptTabs]);

  const stats = useMemo(() => {
    if (supervisorUi && supervisorViewAligned && supervisorDashboard) {
      /** 與下方員工表同源：`team` 僅直屬部屬列；勿用 `kpis`（為整棵組織樹匯總）以免總人數與清單不一致 */
      const scope = supervisorFilteredRows;
      const total = scope.length;
      const safe = scope.filter((r) => r.status === 'safe').length;
      const needHelp = scope.filter((r) => r.status === 'need_help').length;
      const pending = scope.filter((r) => r.status === 'pending').length;
      const responseRate = total ? Math.min(100, Math.round(((safe + needHelp) / total) * 100)) : 0;
      return { total, safe, needHelp, pending, responseRate };
    }
    if (adminUi && selectedAdminEvent) {
      /** Admin KPI 固定為全事件視角；部門篩選僅影響下方名單 */
      const scope = employeeRows;
      const total = scope.length;
      const safe = scope.filter((r) => r.status === 'safe').length;
      const needHelp = scope.filter((r) => r.status === 'need_help').length;
      const pending = scope.filter((r) => r.status === 'pending').length;
      const responseRate = total ? Math.round(((safe + needHelp) / total) * 100) : 0;
      return { total, safe, needHelp, pending, responseRate };
    }
    const total = scopedClientRows.length;
    const safe = scopedClientRows.filter((row) => row.status === 'safe').length;
    const needHelp = scopedClientRows.filter((row) => row.status === 'need_help').length;
    const pending = total - safe - needHelp;
    const responseRate = total ? Math.round(((safe + needHelp) / total) * 100) : 0;
    return { total, safe, needHelp, pending, responseRate };
  }, [
    supervisorUi,
    adminUi,
    supervisorViewAligned,
    supervisorDashboard,
    selectedAdminEvent,
    employeeRows,
    supervisorFilteredRows,
    scopedClientRows,
  ]);

  const showToast = useCallback((next: ToastState) => {
    setToast(next);
    globalThis.setTimeout(() => setToast(null), 2200);
  }, []);

  const handleBlockedNav = useCallback(
    (_target: NavKey) => {
      showToast({ tone: 'warning', message: getStrings(locale).employee.navBlockedPending });
    },
    [locale, showToast],
  );

  const refreshOperationalData = useCallback(async () => {
    if (!session.isLoggedIn) return;
    if (useMockOfflineCatalog) {
      setDashboardUpdatedAt(nowMs());
      return;
    }
    try {
      const [repFresh, evtFresh] = await Promise.all([getReports(), getEvents()]);
      // Merge any pending optimistic responses — the DB write is async (Pub/Sub),
      // so fresh GET data may not yet include a recently submitted report.
      const merged = mergeReportsWithOptimistic(repFresh, optimisticResponsesRef.current);
      setResponses(merged);
      setEvents(evtFresh);
    } catch {
      /* retain cache */
    }
    try {
      if (session.surface === 'member' && session.caps.canViewTeam) {
        const sd = await getSupervisorDashboardApi(
          trimmedDashboardEventId(supervisorDashEventIdRef.current),
        );
        setSupervisorDashboard(sd);
      }
      if (session.surface === 'adminCenter') {
        const ad = await getAdminDashboardApi(trimmedDashboardEventId(adminDashEventIdRef.current));
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
    setDashboardUpdatedAt(nowMs());
  }, [session.isLoggedIn, session.surface, session.caps.canViewTeam, useMockOfflineCatalog]);

  useEffect(() => {
    if (!session.isLoggedIn) return;
    void refreshOperationalData();
  }, [session.isLoggedIn, session.surface, session.caps.canViewTeam, refreshOperationalData]);

  useEffect(() => {
    if (!session.isLoggedIn) return undefined;
    const bump = () => {
      if (document.visibilityState === 'visible') void refreshOperationalData();
    };
    const onFocus = () => void refreshOperationalData();
    document.addEventListener('visibilitychange', bump);
    globalThis.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', bump);
      globalThis.removeEventListener('focus', onFocus);
    };
  }, [session.isLoggedIn, refreshOperationalData]);

  useEffect(() => {
    setAdminDepartmentFilter('all');
  }, [selectedAdminEventId]);

  useEffect(() => {
    if (navKey !== 'admin-event-detail') {
      setAdminDepartmentFilter('all');
      setAdminFilter('all');
      return;
    }
    if (adminFilter === 'pending') setAdminFilter('all');
  }, [navKey, adminFilter]);

  useEffect(() => {
    if (!session.isLoggedIn || useMockOfflineCatalog) return;
    if (!supervisorUi || !selectedSupervisorEventId) return;
    setSupervisorDashboard(null);
    let cancelled = false;
    void (async () => {
      try {
        const sd = await getSupervisorDashboardApi(selectedSupervisorEventId);
        if (!cancelled) setSupervisorDashboard(sd);
      } catch {
        /* keep prior snapshot */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.isLoggedIn, supervisorUi, selectedSupervisorEventId, useMockOfflineCatalog]);

  useEffect(() => {
    if (!session.isLoggedIn || useMockOfflineCatalog) return;
    if (!adminUi || !selectedAdminEventId) return;
    setAdminDashboard(null);
    let cancelled = false;
    void (async () => {
      try {
        const ad = await getAdminDashboardApi(selectedAdminEventId);
        if (!cancelled) setAdminDashboard(ad);
      } catch {
        /* keep prior snapshot */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.isLoggedIn, adminUi, selectedAdminEventId, useMockOfflineCatalog]);

  useEffect(() => {
    if (!session.isLoggedIn) return undefined;
    const supervisorPaths =
      session.surface === 'member' &&
      session.caps.canViewTeam &&
      (navKey === 'supervisor-event-detail' || navKey === 'team-dashboard-home');
    const adminPaths = session.surface === 'adminCenter' && navKey === 'admin-event-detail';
    const watchNav = supervisorPaths || adminPaths || navKey === 'notifications';
    if (!watchNav) return undefined;
    const tid = globalThis.setInterval(() => void refreshOperationalData(), 28_000);
    return () => globalThis.clearInterval(tid);
  }, [session.isLoggedIn, session.surface, session.caps.canViewTeam, navKey, refreshOperationalData]);

  useEffect(() => {
    if (!selectedSupervisorEventId || !supervisorUi) return;
    setContactedByEvent((prev) => ({
      ...prev,
      [selectedSupervisorEventId]: loadContactedMap(selectedSupervisorEventId),
    }));
  }, [selectedSupervisorEventId, supervisorUi]);

  useEffect(() => {
    if (!selectedAdminEventId || !adminUi) return;
    setContactedByEvent((prev) => ({
      ...prev,
      [selectedAdminEventId]: loadContactedMap(selectedAdminEventId),
    }));
  }, [selectedAdminEventId, adminUi]);

  const toggleNeedHelpContact = useCallback(
    (userId: string) => {
      const eid = adminUi ? selectedAdminEventId : selectedSupervisorEventId;
      if (!eid || (!supervisorUi && !adminUi)) return;
      const base = contactedByEvent[eid] ?? loadContactedMap(eid);
      const nextMap = { ...base, [userId]: !(base[userId] ?? false) };
      saveContactedMap(eid, nextMap);
      setContactedByEvent((prev) => ({ ...prev, [eid]: nextMap }));
    },
    [contactedByEvent, selectedSupervisorEventId, selectedAdminEventId, supervisorUi, adminUi],
  );

  const handleEmailLogin = async (email: string, password: string) => {
    const { user } = await loginWithEmailApi({ email, password });
    await loadCatalogFromApi();
    mergeUserIntoList(user);
    const capsNext = deriveUserCapabilities(user.roles);
    const surfaceNext = initialSurfaceFromRoles(user.roles);
    setSession({
      isLoggedIn: true,
      user,
      surface: surfaceNext,
      caps: capsNext,
    });
    setNavKey(surfaceNext === 'adminCenter' ? 'admin-dashboard' : 'member-home');
  };

  const enterAdminCenter = () => {
    setSession((prev) => ({ ...prev, surface: 'adminCenter' }));
    setNavKey('admin-dashboard');
    setSupervisorOpenedDetailFrom('member-home');
    setSupervisorTeamNudge(null);
  };

  const exitAdminCenter = () => {
    setSession((prev) => ({ ...prev, surface: 'member' }));
    setNavKey('member-home');
    setSupervisorOpenedDetailFrom('member-home');
    setSupervisorTeamNudge(null);
  };

  const logout = () => {
    clearAccessToken();
    clearStoredPortalNav();
    setSession({ isLoggedIn: false, user: null, surface: 'member', caps: emptyCaps });
    void loadCatalogFromApi();
    showToast({ tone: 'info', message: 'Logged out.' });
  };

  const submitEmployeeStatus = async (
    eventId: string,
    status: 'safe' | 'need_help',
    fields: EmployeeReportFields,
    meta?: { omitStoredAttachment?: boolean; showOverlay?: boolean },
  ) => {
    if (!session.user) return;
    const uid = session.user.id;
    const eventRow = events.find((e) => e.id === eventId);
    if (!eventRow) return;
    lastSubmitMetaRef.current = { eventId, status, fields, meta };
    setReportSubmitError(null);
    setReportSubmitErrorEventId(null);
    setSubmittingReportEventId(eventId);
    const prior = latestResponseFor(responses, eventId, uid);
    const keepPriorAttach = meta?.omitStoredAttachment !== true;

    const finishSuccessfulSubmit = (nextResponse: SafetyResponse, demoSuffix: string) => {
      const mergedResponses = mergeUserResponseList(responses, nextResponse);
      setSupervisorTeamNudge(
        applySupervisorNudgeAfterSubmit({
          supervisorUi,
          subordinateUserIds,
          mergedResponses,
          eventId,
          eventTitle: eventRow.title,
        }),
      );
      clearEmployeeReportDraft(uid, eventId);
      setResponses(mergedResponses);
      lastSubmitMetaRef.current = null;
      if (shouldOpenSubmissionOverlay(prior, meta)) {
        setSubmissionOverlay({
          variant: status,
          mode: prior ? 'revision' : 'initial',
          eventTitle: stripRedundantStatusFromTitle(eventRow.title),
          submittedSummary: submissionSummaryFromResponse(status, nextResponse),
        });
      }
      if (prior && !meta?.showOverlay) {
        showToast({
          tone: 'success',
          message: `Report received at ${formatLocaleTime(nextResponse.updatedAt, locale)}${demoSuffix}`,
        });
      }
    };

    if (useMockOfflineCatalog) {
      try {
        const nextResponse = buildLocalSafetyResponse({
          eventId,
          userId: uid,
          status,
          fields,
          prior,
          keepPriorAttach,
        });
        finishSuccessfulSubmit(nextResponse, '（Demo 本地）');
      } finally {
        setSubmittingReportEventId(null);
      }
      return;
    }
    try {
      const out = await submitReportApi({
        eventId,
        userId: uid,
        status,
        comment: fields.comment.trim() || undefined,
        location: fields.location.trim() || undefined,
      });
      const nextResponse = enrichApiSafetyResponse(out.data, fields, prior, keepPriorAttach);
      optimisticResponsesRef.current.set(`${nextResponse.eventId}:${nextResponse.userId}`, nextResponse);
      finishSuccessfulSubmit(nextResponse, '');
      void refreshOperationalData();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : '送出失敗，請檢查網路或稍後重試。（系統將在弱網下自動重試數次）';
      setReportSubmitError(msg);
      setReportSubmitErrorEventId(eventId);
      showToast({ tone: 'danger', message: msg });
    } finally {
      setSubmittingReportEventId(null);
    }
  };

  const createEvent = async (): Promise<boolean> => {
    if (!session.user) return false;
    if (!eventForm.title.trim()) {
      showToast({ tone: 'danger', message: '請填寫事件標題。' });
      return false;
    }
    if (!eventForm.type.trim()) {
      showToast({ tone: 'danger', message: getStrings(locale).portal.formLabelEventTypePlaceholder });
      return false;
    }
    if (useMockOfflineCatalog) {
      const eid = newLocalId('e-local');
      const newEvent: EventItem = {
        id: eid,
        title: eventForm.title || 'Untitled Event',
        type: eventForm.type,
        description: eventForm.description,
        targetDepartmentIds: [],
        status: 'active',
        startAt: datetimeLocalToUtcIso(eventForm.startAt),
        createdAt: nowUtcIso(),
        cardDepartment: undefined,
        venue: undefined,
      };
      setEvents((prev) => [newEvent, ...prev]);
      showToast({ tone: 'success', message: 'Demo：事件已加入本機清單（未寫入後端）。' });
      return true;
    }
    try {
      const out = await createEventApi(session.user.id, {
        title: eventForm.title || 'Untitled Event',
        type: eventForm.type,
        description: eventForm.description,
        startAt: datetimeLocalToUtcIso(eventForm.startAt),
        targetDepartmentIds: eventForm.targetDepartmentIds,
        ...(eventForm.location.trim() ? { location: eventForm.location.trim() } : {}),
      });
      setEvents((prev) => [out.event, ...prev]);
      showToast({
        tone: 'success',
        message: 'Event is live. Activation notifications were sent to all employees.',
      });
      try {
        const typeRows = await getEventTypesApi();
        setEventTypeCatalog(typeRows.length > 0 ? typeRows.map((r) => ({ name: r.name })) : null);
      } catch {
        /* ignore */
      }
      await refreshOperationalData();
      setEventForm(createInitialEventForm());
      return true;
    } catch (e) {
      showToast({ tone: 'danger', message: e instanceof Error ? e.message : '建立失敗' });
      return false;
    }
  };

  const closeEvent = async (eventId: string) => {
    if (!session.user) return;
    if (useMockOfflineCatalog) {
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, status: 'closed' as const } : e)));
      showToast({ tone: 'info', message: 'Demo：事件已標記為已結束（本機）。' });
      return;
    }
    try {
      await closeEventApi(session.user.id, eventId);
      await refreshOperationalData();
      showToast({ tone: 'info', message: 'Event closed.' });
    } catch (e) {
      showToast({ tone: 'danger', message: e instanceof Error ? e.message : '關閉失敗' });
    }
  };

  const closeEventFromList = async (eventId: string) => {
    setClosingAdminEventId(eventId);
    try {
      await closeEvent(eventId);
    } finally {
      setClosingAdminEventId(null);
    }
  };

  const contactedForSupervisorRow = contactedByEvent[selectedSupervisorEventId] ?? {};
  const contactedForAdminRow = contactedByEvent[selectedAdminEventId] ?? {};

  const pendingRatioHigh =
    (supervisorUi || adminUi) && stats.total > 0 ? stats.pending / stats.total >= 0.3 : false;
  if (!session.isLoggedIn) {
    return (
      <LoginPage
        loading={sessionBootstrapping || !catalogLoaded}
        error={catalogError}
        onEmailLogin={handleEmailLogin}
      />
    );
  }

  if (
    session.user &&
    (session.user.mustChangePassword || !session.user.setupGuideCompleted)
  ) {
    return (
      <>
        <FirstLoginWizard
          user={session.user}
          mustChangePassword={Boolean(session.user.mustChangePassword)}
          showToast={showToast}
          onUserUpdated={(me) => {
            mergeUserIntoList(me);
            setSession((prev) => ({
              ...prev,
              user: me,
              caps: deriveUserCapabilities(me.roles),
            }));
          }}
          onCompleted={(me) => {
            mergeUserIntoList(me);
            setSession((prev) => ({
              ...prev,
              user: me,
              caps: deriveUserCapabilities(me.roles),
            }));
          }}
        />
        <Toast toast={toast} />
      </>
    );
  }

  return (
    <>
      <Layout
        surface={session.surface}
        caps={session.caps}
        currentNav={layoutNavKey}
        navLocked={hasPendingPersonalReports}
        onBlockedNav={handleBlockedNav}
        onNavigate={(key) => {
          if (hasPendingPersonalReports && key !== 'member-home') {
            handleBlockedNav(key);
            return;
          }
          if (key === 'member-home') setSupervisorOpenedDetailFrom('member-home');
          setNavKey(key);
        }}
        onEnterAdminCenter={enterAdminCenter}
        onExitAdminCenter={exitAdminCenter}
        onLogout={logout}
        mobileHeaderTitle={mobileShell.title}
        onMobileBack={mobileShell.onBack}
      >
        {navKey === 'member-home' && session.surface === 'member' && (
          <MemberPriorityHomePage
            priorityView={memberPriorityView}
            draftUserId={session.user?.id ?? null}
            userName={session.user?.name ?? ''}
            currentDepartment={currentDepartment}
            responses={responses}
            userId={session.user?.id ?? null}
            onSubmitReport={submitEmployeeStatus}
            onRetryReport={() => {
              const p = lastSubmitMetaRef.current;
              if (!p) return;
              void submitEmployeeStatus(p.eventId, p.status, p.fields, p.meta);
            }}
            submittingEventId={submittingReportEventId}
            submitErrorMessage={reportSubmitError}
            submitErrorEventId={reportSubmitErrorEventId}
            onDismissSubmitError={() => {
              setReportSubmitError(null);
              setReportSubmitErrorEventId(null);
            }}
            idleHistoryOngoing={idlePersonalHistory.ongoing}
            idleHistoryClosed={idlePersonalHistory.closed}
            departments={departments}
            onNavigateHistory={() => setNavKey('member-report-history')}
            supervisorTeamNudge={supervisorUi ? supervisorTeamNudge : null}
            onDismissSupervisorNudge={() => setSupervisorTeamNudge(null)}
            onGoTeamDashboardFromNudge={() => {
              setSupervisorTeamNudge(null);
              setNavKey('team-dashboard-home');
            }}
          />
        )}
        {navKey === 'member-report-history' && session.surface === 'member' && (
          <MemberReportHistoryPage
            idleHistoryOngoing={idlePersonalHistory.ongoing}
            idleHistoryClosed={idlePersonalHistory.closed}
            departments={departments}
            onSubmitReport={submitEmployeeStatus}
            onRetryReport={() => {
              const p = lastSubmitMetaRef.current;
              if (!p) return;
              void submitEmployeeStatus(p.eventId, p.status, p.fields, p.meta);
            }}
            submittingEventId={submittingReportEventId}
            submitErrorMessage={reportSubmitError}
            submitErrorEventId={reportSubmitErrorEventId}
            onDismissSubmitError={() => {
              setReportSubmitError(null);
              setReportSubmitErrorEventId(null);
            }}
            onBack={() => setNavKey('member-home')}
          />
        )}
        {navKey === 'team-dashboard-home' && supervisorUi && (
          <AdminEventCenterPage
            variant="supervisor"
            rows={supervisorEventListRows}
            departments={departments}
            onSelectEvent={(eventId) => {
              setSelectedSupervisorEventId(eventId);
              setSupervisorDeptFilter('all');
              setSupervisorOpenedDetailFrom('team-dashboard-home');
              setNavKey('supervisor-event-detail');
            }}
          />
        )}
        {navKey === 'supervisor-event-detail' && supervisorUi && (
          <SupervisorDashboardPage
            event={selectedSupervisorEvent}
            stats={stats}
            rows={supervisorFilteredRows}
            departments={departments}
            showDepartmentTabs={supervisorShowDeptTabs}
            departmentFilter={supervisorDeptFilter}
            setDepartmentFilter={setSupervisorDeptFilter}
            departmentOptions={supervisorDepartmentOptions}
            supervisorOwnDepartment={currentDepartment}
            filter={supervisorFilter}
            setFilter={(value) => {
              if (value !== 'pending') setSupervisorFilter(value);
            }}
            searchText={searchText}
            setSearchText={setSearchText}
            contactedMap={contactedForSupervisorRow}
            onToggleContacted={toggleNeedHelpContact}
            pendingRatioHigh={pendingRatioHigh}
            dashMismatchHint={supervisorDashMismatchHint}
            dashboardFreshAt={dashboardUpdatedAt}
            onBackToEvents={() =>
              setNavKey(supervisorOpenedDetailFrom === 'team-dashboard-home' ? 'team-dashboard-home' : 'member-home')
            }
            showToast={showToast}
          />
        )}
        {navKey === 'admin-dashboard' && adminUi && (
          <AdminEventCenterPage
            rows={adminEventListRows}
            departments={departments}
            onSelectEvent={(eventId) => {
              setSelectedAdminEventId(eventId);
              setAdminDepartmentFilter('all');
              setNavKey('admin-event-detail');
            }}
            adminQuickCreate={{
              eventForm,
              setEventForm,
              eventTypeCatalog,
              departments,
              onPrepareCreate: () => setEventForm(createInitialEventForm()),
              onEventTypesChanged: refreshEventTypes,
              showToast,
              onSubmitCreate: async () => {
                const ok = await createEvent();
                if (ok) setNavKey('admin-dashboard');
                return ok;
              },
            }}
          />
        )}
        {navKey === 'admin-event-detail' && adminUi && (
          <SupervisorDashboardPage
            variant="admin"
            event={selectedAdminEvent}
            stats={stats}
            rows={adminFilteredRows}
            allRowsForDeptChart={employeeRows}
            departments={departments}
            showDepartmentTabs={adminShowDeptTabs}
            departmentFilter={adminDepartmentFilter}
            setDepartmentFilter={setAdminDepartmentFilter}
            departmentOptions={adminDepartmentOptions}
            filter={adminFilter}
            setFilter={setAdminFilter}
            searchText={searchText}
            setSearchText={setSearchText}
            contactedMap={contactedForAdminRow}
            onToggleContacted={toggleNeedHelpContact}
            pendingRatioHigh={pendingRatioHigh}
            dashMismatchHint={adminDashMismatchHint}
            dashboardFreshAt={dashboardUpdatedAt}
            onBackToEvents={() => setNavKey('admin-dashboard')}
            showToast={showToast}
            onCloseEvent={closeEventFromList}
            closingEventId={closingAdminEventId}
          />
        )}
        {navKey === 'user-management' && adminUi && (
          <UserManagementPage
            users={users}
            departments={departments}
            showToast={showToast}
            offlineMockMode={useMockOfflineCatalog}
            onUserCreated={(u) => mergeUserIntoList(u)}
            selectedDeptId={userMgmtSelectedDeptId}
            onSelectedDeptIdChange={setUserMgmtSelectedDeptId}
            onAddModalOpenChange={setUserMgmtAddModalOpen}
          />
        )}
        {navKey === 'notifications' && <GlobalNotificationInboxPage rows={myNotifications} />}
        {navKey === 'profile' && (
          <ProfileSettingsPage
            user={session.user!}
            departmentName={currentDepartment}
            allUsers={users}
            departments={departments}
            showToast={showToast}
            onLogout={logout}
            onProfileUpdated={(nextUser) => {
              mergeUserIntoList(nextUser);
              const capsNext = deriveUserCapabilities(nextUser.roles);
              setSession((prev) =>
                prev.user ? { ...prev, user: nextUser, caps: capsNext } : prev,
              );
            }}
            onNavigateToDirectReportsList={() => setNavKey('profile-direct-reports-list')}
            onNavigateToSubordinateHistory={(userId) => {
              setProfileSubordinateUserId(userId);
              setNavKey('profile-direct-report-history');
            }}
            offlineMockSession={useMockOfflineCatalog}
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
              setNavKey(
                profileDirectReports.length > 1 ? 'profile-direct-reports-list' : 'profile',
              );
            }}
          />
        ) : null}
      </Layout>

      <Toast toast={toast} />
      {submissionOverlay ? (
        <ReportSubmissionOverlay
          variant={submissionOverlay.variant}
          mode={submissionOverlay.mode}
          eventTitle={submissionOverlay.eventTitle}
          submittedSummary={submissionOverlay.submittedSummary}
          onDismiss={() => setSubmissionOverlay(null)}
        />
      ) : null}
    </>
  );
}


export default App;
