import { useMemo, useState } from 'react';
import { ConfirmModal } from './components/ConfirmModal';
import { EmployeeTable } from './components/EmployeeTable';
import { EventCard } from './components/EventCard';
import { Layout } from './components/Layout';
import { StatCard } from './components/StatCard';
import { StatusBadge } from './components/StatusBadge';
import { Toast } from './components/Toast';
import { demoRoleAccounts, departments, events as seedEvents, notificationSummary, responses as seedResponses, users } from './mockData';
import type { EventItem, NavKey, Role, SafetyResponse, ToastState, User } from './types';

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
  const [events, setEvents] = useState<EventItem[]>(seedEvents);
  const [responses, setResponses] = useState<SafetyResponse[]>(seedResponses);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [eventToActivate, setEventToActivate] = useState<string | null>(null);
  const [selectedEmployeeEventId, setSelectedEmployeeEventId] = useState(seedEvents.find((event) => event.status === 'active')?.id ?? seedEvents[0].id);
  const [selectedSupervisorEventId, setSelectedSupervisorEventId] = useState(seedEvents.find((event) => event.status === 'active')?.id ?? seedEvents[0].id);
  const [selectedAdminEventId, setSelectedAdminEventId] = useState(seedEvents.find((event) => event.status === 'active')?.id ?? seedEvents[0].id);
  const [selectedNotificationEventId, setSelectedNotificationEventId] = useState(seedEvents[0].id);
  const [employeeEventFilter, setEmployeeEventFilter] = useState<'ongoing' | 'closed'>('ongoing');
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

  const employeeEventCards = useMemo(
    () => events.filter((event) => (employeeEventFilter === 'ongoing' ? event.status === 'active' : event.status === 'closed')),
    [events, employeeEventFilter],
  );
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
    const account = demoRoleAccounts.find((item) => item.id === demoId);
    if (!account) return;
    const selectedUser = users.find((u) => u.id === account.userId);
    if (!selectedUser) return;
    const initialRole = account.roles[0];
    setSession({
      isLoggedIn: true,
      user: selectedUser,
      availableRoles: account.roles,
      currentRole: account.roles.length === 1 ? initialRole : null,
    });
    setNavKey(roleDefaultNav[initialRole]);
  };

  const pickRole = (role: Role) => {
    setSession((prev) => ({ ...prev, currentRole: role }));
    setNavKey(roleDefaultNav[role]);
  };

  const logout = () => {
    setSession({ isLoggedIn: false, user: null, availableRoles: [], currentRole: null });
    showToast({ tone: 'info', message: 'Logged out.' });
  };

  const submitEmployeeStatus = (status: 'safe' | 'need_help') => {
    if (!selectedEmployeeEvent || !session.user) return;
    const nextResponse: SafetyResponse = {
      id: `r-${Date.now()}`,
      eventId: selectedEmployeeEvent.id,
      userId: session.user.id,
      status,
      comment: employeeComment || (employeeAttachment ? `Attachment: ${employeeAttachment.name}` : undefined),
      location: employeeLocation || undefined,
      updatedAt: new Date().toISOString(),
    };
    setResponses((prev) => [
      ...prev.filter((r) => !(r.eventId === nextResponse.eventId && r.userId === nextResponse.userId)),
      nextResponse,
    ]);
    showToast({ tone: 'success', message: `Report received at ${new Date(nextResponse.updatedAt).toLocaleTimeString()}` });
  };

  const createEvent = () => {
    const type = eventForm.type === 'Other' && eventForm.customType.trim() ? ('Other' as EventItem['type']) : eventForm.type;
    const newEvent: EventItem = {
      id: `e-${Date.now()}`,
      title: eventForm.title || 'Untitled Event',
      type,
      description: eventForm.description,
      targetDepartmentIds: departments.map((d) => d.id),
      status: 'draft',
      startAt: new Date(eventForm.startAt).toISOString(),
    };
    setEvents((prev) => [newEvent, ...prev]);
    showToast({ tone: 'success', message: 'Event template saved. You can activate it when an incident starts.' });
  };

  const requestActivateEvent = (eventId: string) => {
    setEventToActivate(eventId);
    setShowActivateModal(true);
  };

  const activateEvent = () => {
    if (!eventToActivate) return;
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventToActivate
          ? { ...event, status: 'active' }
          : event.status === 'active'
            ? { ...event, status: 'closed' }
            : event,
      ),
    );
    setShowActivateModal(false);
    setEventToActivate(null);
    showToast({ tone: 'warning', message: 'Event activated. Notifications will be sent to target users.' });
  };

  const closeEvent = (eventId: string) => {
    setEvents((prev) => prev.map((event) => (event.id === eventId ? { ...event, status: 'closed' } : event)));
    showToast({ tone: 'info', message: 'Event closed.' });
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
    return <LoginPage onLogin={handleLogin} />;
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
                  : navKey
        }
        onSwitchRole={pickRole}
        onSwitchNav={setNavKey}
        onLogout={logout}
      >
        {navKey === 'employee-home' && (
          <EmployeeEventListPage
            eventCards={employeeEventCards}
            selectedEvent={selectedEmployeeEvent}
            onSelectEvent={(eventId) => {
              setSelectedEmployeeEventId(eventId);
              setNavKey('employee-event-detail');
            }}
            employeeEventFilter={employeeEventFilter}
            setEmployeeEventFilter={setEmployeeEventFilter}
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
        {navKey === 'user-management' && <UserManagementPage />}
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
        {navKey === 'profile' && <ProfilePage user={session.user!} departmentName={currentDepartment} />}
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

function LoginPage({ onLogin }: { onLogin: (demoId: string) => void }) {
  const [demoId, setDemoId] = useState('employee');
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Employee Safety & Response</h1>
        <p>Emergency safety reporting and command dashboard.</p>
        <input placeholder="Email" defaultValue="demo@company.com" />
        <input placeholder="Password" type="password" defaultValue="password" />
        <label>
          Prototype Role Selector
          <select value={demoId} onChange={(e) => setDemoId(e.target.value)}>
            {demoRoleAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn primary" onClick={() => onLogin(demoId)} type="button">
          Login
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

function EmployeeEventListPage({
  eventCards,
  selectedEvent,
  onSelectEvent,
  employeeEventFilter,
  setEmployeeEventFilter,
}: {
  eventCards: EventItem[];
  selectedEvent: EventItem | null;
  onSelectEvent: (eventId: string) => void;
  employeeEventFilter: 'ongoing' | 'closed';
  setEmployeeEventFilter: (value: 'ongoing' | 'closed') => void;
}) {
  return (
    <section className="page-section">
      <h2>Emergency Events</h2>
      <div className="tabs">
        <button className={employeeEventFilter === 'ongoing' ? 'pill active' : 'pill'} onClick={() => setEmployeeEventFilter('ongoing')} type="button">
          Ongoing Events
        </button>
        <button className={employeeEventFilter === 'closed' ? 'pill active' : 'pill'} onClick={() => setEmployeeEventFilter('closed')} type="button">
          Closed Events
        </button>
      </div>
      <div className="event-card-row single-column">
        {eventCards.map((event) => (
          <button key={event.id} className={selectedEvent?.id === event.id ? 'event-mini-card active' : 'event-mini-card'} onClick={() => onSelectEvent(event.id)} type="button">
            <strong>{event.title}</strong>
            <span>{event.type}</span>
            <small>{event.status}</small>
          </button>
        ))}
      </div>
      {eventCards.length === 0 ? <div className="empty">No events found for this filter.</div> : null}
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

function EmployeeHomePage({
  userName,
  selectedEvent,
  currentDepartment,
  latestResponse,
  employeeComment,
  setEmployeeComment,
  employeeLocation,
  setEmployeeLocation,
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
  setEmployeeAttachment: (file: File | null) => void;
  onSubmit: (status: 'safe' | 'need_help') => void;
  onBackToEvents: () => void;
}) {
  const [showOptional, setShowOptional] = useState(false);
  const [selectedNeedHelp, setSelectedNeedHelp] = useState(false);
  const handleNeedHelp = () => {
    setShowOptional(true);
    setSelectedNeedHelp(true);
  };
  return (
    <section className="page-section">
      <button className="btn ghost" onClick={onBackToEvents} type="button">
        ← Back to Events
      </button>
      {selectedEvent ? (
        <>
          <div className="urgent-banner">
            <strong>{selectedEvent.title}</strong>
            <span>{selectedEvent.type} | {currentDepartment} | {new Date(selectedEvent.startAt).toLocaleTimeString()}</span>
          </div>
          <h2>Are you safe, {userName}?</h2>
          <div className="kahoot-buttons">
            <button className="kahoot-btn safe" onClick={() => onSubmit('safe')} type="button">I&apos;m Safe</button>
            <button className="kahoot-btn help" onClick={handleNeedHelp} type="button">I Need Help</button>
          </div>
          <button className="btn ghost" onClick={() => setShowOptional((prev) => !prev)} type="button">
            {showOptional ? 'Hide Optional Details' : 'Add Optional Location / Comment'}
          </button>
          {showOptional ? (
            <div className="optional-box">
              <input placeholder="Current location (optional)" value={employeeLocation} onChange={(e) => setEmployeeLocation(e.target.value)} />
              <textarea placeholder="Comment (optional)" value={employeeComment} onChange={(e) => setEmployeeComment(e.target.value)} />
              <input type="file" onChange={(e) => setEmployeeAttachment(e.target.files?.[0] ?? null)} />
              {selectedNeedHelp ? (
                <button className="btn danger" onClick={() => onSubmit('need_help')} type="button">
                  Confirm Need Help + Submit
                </button>
              ) : null}
            </div>
          ) : null}
          {latestResponse ? (
            <div className="confirm-box">
              <p>Report received at {new Date(latestResponse.updatedAt).toLocaleTimeString()}</p>
              <StatusBadge status={latestResponse.status} />
            </div>
          ) : null}
          <div className="help-box">
            <h4>Emergency Contact</h4>
            <p>Security Control Room: +886-2-1234-5678</p>
          </div>
        </>
      ) : (
        <div className="empty">No active event. Standby mode.</div>
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
  onBackToEvents,
}: {
  stats: { total: number; safe: number; needHelp: number; pending: number; responseRate: number };
  rows: Array<{ id: string; name: string; department: string; status: 'safe' | 'need_help' | 'pending'; note?: string }>;
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
            {departments.map((dept) => {
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

function UserManagementPage() {
  const subordinateRows = users.filter((user) => user.managerId);
  const childMap = departments.reduce<Record<string, string[]>>((acc, department) => {
    const parent = department.parentId ?? 'root';
    acc[parent] = [...(acc[parent] ?? []), department.id];
    return acc;
  }, {});
  const renderDepartmentTree = (parentId: string | null, depth = 0): JSX.Element[] =>
    (childMap[parentId ?? 'root'] ?? []).flatMap((deptId) => {
      const department = departments.find((item) => item.id === deptId);
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
          {users.map((user) => (
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
              <span>{users.find((manager) => manager.id === user.managerId)?.name ?? 'Unknown Manager'}</span>
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

function ProfilePage({ user, departmentName }: { user: User; departmentName: string }) {
  return (
    <section className="page-section">
      <h2>Profile & Settings</h2>
      <div className="panel">
        <p><strong>Name:</strong> {user.name}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Department:</strong> {departmentName}</p>
        <p><strong>Roles:</strong> {user.roles.join(', ')}</p>
        <p><strong>Notification:</strong> {user.pushEnabled ? 'Push Enabled' : 'Push Not Enabled'}</p>
        <button className="btn primary" type="button">Enable Push Notifications</button>
      </div>
    </section>
  );
}

export default App;