import { EventCard } from '../../components/EventCard';
import { StatCard } from '../../components/StatCard';
import type { ReactElement } from 'react';
import type { Department, EventItem, NotificationSummary, User } from '../../types';

export function EventSelectionPage({
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
export function EventManagementPage({
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
export function UserManagementPage({ users: userList, departments: deptList }: { users: User[]; departments: Department[] }) {
  const subordinateRows = userList.filter((user) => user.managerId);
  const childMap = deptList.reduce<Record<string, string[]>>((acc, department) => {
    const parent = department.parentId ?? 'root';
    acc[parent] = [...(acc[parent] ?? []), department.id];
    return acc;
  }, {});
  const renderDepartmentTree = (parentId: string | null, depth = 0): ReactElement[] =>
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
export function NotificationPage({
  summary,
  canSendReminder,
  onSendReminder,
  onBackToEvents,
}: {
  summary: NotificationSummary;
  canSendReminder: boolean;
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
        <p className="muted-text">
          以下為此事件之推播／提醒相關摘要（含本機紀錄之提醒批次與目前帳號可見之通知列）。
        </p>
        <div className="stat-grid three">
          <StatCard label="Push Sent" value={summary.pushSent} tone="primary" />
          <StatCard label="Push Failed" value={summary.pushFailed} tone="danger" />
          <StatCard label="SMS Fallback" value={summary.smsFallbackSent} tone="warning" />
        </div>
      </section>
      <div className="grid-2">
        <section className="panel">
          <h3 className="section-title">Reminder Actions</h3>
          <p className="muted-text">對尚未回報的直屬員工發送後端提醒（僅 supervisor 可用）。</p>
          <button
            className="btn warning"
            onClick={onSendReminder}
            type="button"
            disabled={!canSendReminder}
            title={canSendReminder ? undefined : '僅主管角色可送出提醒'}
          >
            Send Reminder to Non-Responders
          </button>
        </section>
        <section className="panel">
          <h3 className="section-title">Reminder History</h3>
          <div className="list">
            {summary.reminderHistory.length === 0 ? (
              <p className="empty">尚無提醒紀錄</p>
            ) : (
              summary.reminderHistory.map((item) => (
                <article className="list-item" key={item.id}>
                  <div>
                    <strong>{item.note}</strong>
                    <p>{new Date(item.sentAt).toLocaleString()}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
