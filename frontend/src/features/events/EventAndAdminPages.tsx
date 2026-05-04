import { EventCard } from '../../components/EventCard';
import { StatCard } from '../../components/StatCard';
import { useLocale } from '../../locale/LocaleContext';
import { getStrings } from '../../locale/strings';
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { FailedNotificationRow } from '../../api';
import type { Department, EventItem, NotificationSummary, User } from '../../types';

function typeLabel(ev: EventItem['type'], p: ReturnType<typeof getStrings>['portal']) {
  switch (ev) {
    case 'Earthquake':
      return p.eventTypeEarthquake;
    case 'Typhoon':
      return p.eventTypeTyphoon;
    case 'Fire':
      return p.eventTypeFire;
    case 'Other':
      return p.eventTypeOther;
    default:
      return ev;
  }
}

function statusChip(status: EventItem['status'], p: ReturnType<typeof getStrings>['portal']) {
  if (status === 'draft') return p.eventChipDraft;
  if (status === 'active') return p.eventChipActive;
  return p.eventChipClosed;
}

export function EventSelectionPage({
  variant,
  events,
  selectedEventId,
  onSelectEvent,
}: {
  variant: 'admin' | 'notification';
  events: EventItem[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
}) {
  const { locale } = useLocale();
  const p = getStrings(locale).portal;
  const title = variant === 'admin' ? p.adminGlobalEventCenter : p.notificationEventCenter;
  const [statusFilter, setStatusFilter] = useState<'all' | EventItem['status']>('all');
  const filteredEvents = useMemo(
    () => (statusFilter === 'all' ? events : events.filter((ev) => ev.status === statusFilter)),
    [events, statusFilter],
  );

  return (
    <section className="page-section portal-event-picker">
      <h2>{title}</h2>
      <div className="event-filter-chips" role="tablist" aria-label={p.eventFilterLabel}>
        {([
          ['all', p.filterAll],
          ['active', p.filterActive],
          ['draft', p.filterDraft],
          ['closed', p.filterClosed],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`event-filter-chip${statusFilter === key ? ' is-active' : ''}`}
            onClick={() => setStatusFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="event-card-row single-column">
        {filteredEvents.map((event) => (
          <button
            key={event.id}
            className={selectedEventId === event.id ? 'event-mini-card active' : 'event-mini-card'}
            onClick={() => onSelectEvent(event.id)}
            type="button"
          >
            <strong>{event.title}</strong>
            <span>{typeLabel(event.type, p)}</span>
            <span className="event-mini-card-status">{statusChip(event.status, p)}</span>
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
  setEventForm: (value: {
    title: string;
    type: EventItem['type'];
    customType: string;
    description: string;
    startAt: string;
  }) => void;
  onCreateEvent: () => void;
  onActivate: (eventId: string) => void;
  onClose: (eventId: string) => void;
}) {
  const { locale } = useLocale();
  const p = getStrings(locale).portal;

  return (
    <section className="page-section portal-event-mgmt">
      <h2>{p.eventManagement}</h2>
      <p className="muted-text">{p.eventManagementIntro}</p>
      <div className="panel event-form">
        <label className="event-form-field">
          <span className="event-form-field-label">{p.placeholderEventTitle}</span>
          <input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} placeholder={p.placeholderEventTitle} />
        </label>
        <label className="event-form-field">
          <span className="event-form-field-label">{p.formLabelEventType}</span>
          <select value={eventForm.type} onChange={(e) => setEventForm({ ...eventForm, type: e.target.value as EventItem['type'] })}>
            <option value="Earthquake">{p.eventTypeEarthquake}</option>
            <option value="Typhoon">{p.eventTypeTyphoon}</option>
            <option value="Fire">{p.eventTypeFire}</option>
            <option value="Other">{p.eventTypeOther}</option>
          </select>
        </label>
        {eventForm.type === 'Other' ? (
          <label className="event-form-field">
            <span className="event-form-field-label muted-text">{p.formLabelCustomTypeDetail}</span>
            <input
              value={eventForm.customType}
              onChange={(e) => setEventForm({ ...eventForm, customType: e.target.value })}
              placeholder={p.placeholderCustomType}
            />
          </label>
        ) : null}
        <label className="event-form-field">
          <span className="event-form-field-label">{p.placeholderDescription}</span>
          <textarea value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} placeholder={p.placeholderDescription} />
        </label>
        <label className="event-form-field">
          <span className="event-form-field-label">{p.datetimeLabel}</span>
          <input type="datetime-local" value={eventForm.startAt} onChange={(e) => setEventForm({ ...eventForm, startAt: e.target.value })} />
        </label>
        <button className="btn primary" onClick={onCreateEvent} type="button">
          {p.createEventButton}
        </button>
      </div>
      <div className="list event-mgmt-list">
        {events.map((event) => (
          <div key={event.id} className="panel event-mgmt-card">
            <EventCard event={event} />
            <div className="row-actions">
              <button className="btn warning" onClick={() => onActivate(event.id)} type="button">
                {p.activateButton}
              </button>
              <button className="btn ghost" onClick={() => onClose(event.id)} type="button">
                {p.closeEventButton}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UserManagementPage({ users: userList, departments: deptList }: { users: User[]; departments: Department[] }) {
  const { locale } = useLocale();
  const p = getStrings(locale).portal;
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
          <span>{p.deptIdLabel(department.id)}</span>
        </div>,
        ...renderDepartmentTree(department.id, depth + 1),
      ];
    });
  return (
    <section className="page-section portal-user-mgmt">
      <h2>{p.userDeptManagement}</h2>
      <div className="grid-2">
        <section className="panel">
          <h3>{p.employees}</h3>
          {userList.map((user) => (
            <div className="list-item" key={user.id}>
              <div>
                <strong>{user.name}</strong>
                <p>{user.email}</p>
              </div>
              <span>{user.pushEnabled ? p.pushEnabled : p.pushNotEnabled}</span>
            </div>
          ))}
        </section>
        <section className="panel">
          <h3>{p.departmentHierarchy}</h3>
          {renderDepartmentTree(null)}
          <h4>{p.managerSubordinatesHeading}</h4>
          {subordinateRows.map((user) => (
            <div className="list-item" key={`sub-${user.id}`}>
              <span>{userList.find((manager) => manager.id === user.managerId)?.name ?? p.unknownManager}</span>
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
  failedRows,
  loadingFailed,
  canSendReminder,
  canManageFailed,
  onSendReminder,
  onRetryFailed,
  onRefreshFailed,
  onBackToEvents,
}: {
  summary: NotificationSummary;
  failedRows: FailedNotificationRow[];
  loadingFailed?: boolean;
  canSendReminder: boolean;
  canManageFailed?: boolean;
  onSendReminder: () => void;
  onRetryFailed: (notificationId: string) => void;
  onRefreshFailed: () => void;
  onBackToEvents: () => void;
}) {
  const { locale } = useLocale();
  const p = getStrings(locale).portal;

  return (
    <section className="page-section portal-notifications">
      <button className="btn ghost" onClick={onBackToEvents} type="button">
        {p.backToEventList}
      </button>
      <h2>{p.notificationReminderCenter}</h2>
      <section className="panel">
        <h3 className="section-title">{p.deliverySummary}</h3>
        <p className="muted-text">{p.deliverySummaryIntro}</p>
        <div className="stat-grid three">
          <StatCard label={p.pushSent} value={summary.pushSent} tone="primary" />
          <StatCard label={p.pushFailed} value={summary.pushFailed} tone="danger" />
          <StatCard label={p.smsFallback} value={summary.smsFallbackSent} tone="warning" />
        </div>
      </section>
      <div className="grid-2">
        <section className="panel">
          <h3 className="section-title">{p.reminderActions}</h3>
          <p className="muted-text">{p.reminderActionsIntro}</p>
          <button
            className="btn warning"
            onClick={onSendReminder}
            type="button"
            disabled={!canSendReminder}
            title={canSendReminder ? undefined : p.supervisorOnlyReminderTitle}
          >
            {p.sendReminderToNonResponders}
          </button>
        </section>
        <section className="panel">
          <h3 className="section-title">{p.failedDeliveries}</h3>
          <p className="muted-text">{p.failedDeliveriesHint}</p>
          <div className="row-actions">
            <button type="button" className="btn ghost btn-sm" onClick={onRefreshFailed}>
              {p.refreshFailedList}
            </button>
          </div>
          <div className="list">
            {loadingFailed ? (
              <p className="muted-text">{p.loading}</p>
            ) : failedRows.length === 0 ? (
              <p className="empty">{p.noFailedDeliveries}</p>
            ) : (
              failedRows.map((row) => {
                const localeTag = locale === 'en' ? 'en-US' : 'zh-TW';
                return (
                  <article className="list-item" key={row.id}>
                    <div>
                      <strong>{row.userName}</strong>
                      <p>
                        {(row.department ?? p.na)} · {row.channel}
                      </p>
                      <p>{row.sentAt ? new Date(row.sentAt).toLocaleString(localeTag) : p.notSentYet}</p>
                    </div>
                    {canManageFailed ? (
                      <button type="button" className="btn warning btn-sm" onClick={() => onRetryFailed(row.id)}>
                        {p.retryDelivery}
                      </button>
                    ) : (
                      <span className="muted-text">{p.adminOnlyManageFailed}</span>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
      <div className="grid-2">
        <section className="panel">
          <h3 className="section-title">{p.reminderHistory}</h3>
          <div className="list">
            {summary.reminderHistory.length === 0 ? (
              <p className="empty">{p.noReminderRecords}</p>
            ) : (
              summary.reminderHistory.map((item) => {
                const localeTag = locale === 'en' ? 'en-US' : 'zh-TW';
                return (
                  <article className="list-item" key={item.id}>
                    <div>
                      <strong>{item.note}</strong>
                      <p>{new Date(item.sentAt).toLocaleString(localeTag)}</p>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
