import { EventCard } from '../../components/EventCard';
import { StatCard } from '../../components/StatCard';
import { useLocale } from '../../locale/LocaleContext';
import { getStrings } from '../../locale/strings';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { FailedNotificationRow } from '../../api';
import { adminCreateUserApi, type PortalNotificationRow } from '../../api';
import type { Department, EventItem, NotificationSummary, User } from '../../types';

type EventFormState = {
  title: string;
  type: string;
  customType: string;
  description: string;
  startAt: string;
  location: string;
  targetDepartmentIds: string[];
};
import { Plus } from 'lucide-react';

function typeLabel(ev: string, p: ReturnType<typeof getStrings>['portal']) {
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
  if (status === 'active') return p.eventChipActive;
  return p.eventChipClosed;
}

const BUILTIN_TYPE_ORDER = ['Earthquake', 'Typhoon', 'Fire', 'Other'] as const;

function flattenDepts(depts: Department[]): { dept: Department; depth: number }[] {
  const childMap: Record<string, Department[]> = {};
  for (const d of depts) {
    const parent = d.parentId ?? '__root__';
    (childMap[parent] ??= []).push(d);
  }
  const result: { dept: Department; depth: number }[] = [];
  function walk(parentId: string, depth: number) {
    for (const d of childMap[parentId] ?? []) {
      result.push({ dept: d, depth });
      walk(d.id, depth + 1);
    }
  }
  walk('__root__', 0);
  return result;
}

function AdminQuickCreateFormFields({
  p,
  eventForm,
  setEventForm,
  eventTypeCatalog,
  departments,
}: {
  p: ReturnType<typeof getStrings>['portal'];
  eventForm: EventFormState;
  setEventForm: (value: EventFormState) => void;
  eventTypeCatalog: { name: string }[] | null;
  departments: Department[];
}) {
  const flatDepts = useMemo(() => flattenDepts(departments), [departments]);
  const limitToDept = eventForm.targetDepartmentIds.length > 0;
  const typeSelectRows = useMemo(() => {
    if (!eventTypeCatalog?.length) {
      return BUILTIN_TYPE_ORDER.map((name) => ({ name }));
    }
    const rank = (name: string) => {
      const i = BUILTIN_TYPE_ORDER.indexOf(name as (typeof BUILTIN_TYPE_ORDER)[number]);
      return i === -1 ? 100 : i;
    };
    return [...eventTypeCatalog].sort((a, b) => {
      const d = rank(a.name) - rank(b.name);
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });
  }, [eventTypeCatalog]);

  return (
    <div className="event-form admin-quick-create-form">
      <label className="event-form-field">
        <span className="event-form-field-label">{p.placeholderEventTitle}</span>
        <input
          value={eventForm.title}
          onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
          placeholder={p.placeholderEventTitle}
        />
      </label>
      <label className="event-form-field">
        <span className="event-form-field-label">{p.formLabelEventType}</span>
        <select value={eventForm.type} onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}>
          {typeSelectRows.map((row) => (
            <option key={row.name} value={row.name}>
              {typeLabel(row.name, p)}
            </option>
          ))}
        </select>
      </label>
      {eventForm.type.trim().toLowerCase() === 'other' ? (
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
        <textarea
          value={eventForm.description}
          onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
          placeholder={p.placeholderDescription}
        />
      </label>
      <label className="event-form-field">
        <span className="event-form-field-label">{p.datetimeLabel}</span>
        <input
          type="datetime-local"
          value={eventForm.startAt}
          onChange={(e) => setEventForm({ ...eventForm, startAt: e.target.value })}
        />
      </label>
      <label className="event-form-field">
        <span className="event-form-field-label">地點（選填）</span>
        <input
          value={eventForm.location}
          onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
          placeholder="例：台北總部 3F 會議室"
        />
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="event-form-field-label">通知對象</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setEventForm({ ...eventForm, targetDepartmentIds: [] })}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 8,
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer',
              background: !limitToDept ? '#1a6fc4' : '#eef3fa',
              color: !limitToDept ? '#fff' : '#17385b',
              transition: 'background 0.15s',
            }}
          >
            全體員工
          </button>
          <button
            type="button"
            onClick={() => {
              if (!limitToDept) {
                setEventForm({ ...eventForm, targetDepartmentIds: flatDepts.length > 0 ? [flatDepts[0].dept.id] : [] });
              }
            }}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 8,
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer',
              background: limitToDept ? '#1a6fc4' : '#eef3fa',
              color: limitToDept ? '#fff' : '#17385b',
              transition: 'background 0.15s',
            }}
          >
            限定部門
          </button>
        </div>
        {limitToDept && flatDepts.length > 0 && (
          <div style={{ border: '1px solid #d4e0ef', borderRadius: 8, padding: '8px 12px', maxHeight: 220, overflowY: 'auto' }}>
            {flatDepts.map(({ dept, depth }) => (
              <label key={dept.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', paddingLeft: depth * 16, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={eventForm.targetDepartmentIds.includes(dept.id)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...eventForm.targetDepartmentIds, dept.id]
                      : eventForm.targetDepartmentIds.filter((id) => id !== dept.id);
                    setEventForm({ ...eventForm, targetDepartmentIds: next.length > 0 ? next : [dept.id] });
                  }}
                />
                {dept.name}
              </label>
            ))}
            <p className="muted-text small" style={{ marginTop: 6, marginBottom: 0 }}>子部門會自動包含</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function EventSelectionPage({
  variant,
  events,
  selectedEventId,
  onSelectEvent,
  adminQuickCreate,
}: {
  variant: 'admin' | 'notification';
  events: EventItem[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
  /** Admin FAB: full create form in modal; on success navigates to event list (no form on that page). */
  adminQuickCreate?: {
    eventForm: EventFormState;
    setEventForm: (value: EventFormState) => void;
    eventTypeCatalog: { name: string }[] | null;
    departments: Department[];
    onSubmitCreate: () => Promise<boolean>;
  };
}) {
  const { locale } = useLocale();
  const p = getStrings(locale).portal;
  const title = variant === 'admin' ? p.adminGlobalEventCenter : p.notificationEventCenter;
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const filteredEvents = useMemo(
    () => (statusFilter === 'all' ? events : events.filter((ev) => ev.status === statusFilter)),
    [events, statusFilter],
  );

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const createSubmittingRef = useRef(false);
  useEffect(() => {
    createSubmittingRef.current = createSubmitting;
  }, [createSubmitting]);

  useEffect(() => {
    if (!createModalOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !createSubmittingRef.current) setCreateModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [createModalOpen]);

  const submitQuickCreate = async () => {
    if (!adminQuickCreate) return;
    setCreateSubmitting(true);
    try {
      const ok = await adminQuickCreate.onSubmitCreate();
      if (ok) setCreateModalOpen(false);
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <section className="page-section portal-event-picker">
      {variant === 'admin' && adminQuickCreate && createModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => !createSubmitting && setCreateModalOpen(false)}
        >
          <div
            className="modal admin-create-event-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-create-event-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="admin-create-event-title">{p.adminOverviewCreateTitle}</h3>
            <p className="muted-text small">{p.adminOverviewCreateBody}</p>
            <AdminQuickCreateFormFields
              p={p}
              eventForm={adminQuickCreate.eventForm}
              setEventForm={adminQuickCreate.setEventForm}
              eventTypeCatalog={adminQuickCreate.eventTypeCatalog}
              departments={adminQuickCreate.departments}
            />
            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                disabled={createSubmitting}
                onClick={() => setCreateModalOpen(false)}
              >
                {p.adminCreateModalCancel}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={createSubmitting}
                onClick={() => void submitQuickCreate()}
              >
                {createSubmitting ? '…' : p.createEventButton}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <h2>{title}</h2>
      <div className="event-filter-chips" role="tablist" aria-label={p.eventFilterLabel}>
        {(
          [
            ['all', p.filterAll],
            ['active', p.filterActive],
            ['closed', p.filterClosed],
          ] as const
        ).map(([key, label]) => (
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
      {variant === 'admin' && adminQuickCreate ? (
        <button
          type="button"
          className="portal-admin-fab"
          onClick={() => setCreateModalOpen(true)}
          aria-label={p.fabCreateEventAria}
          aria-haspopup="dialog"
        >
          <Plus size={26} strokeWidth={2.4} aria-hidden />
        </button>
      ) : null}
    </section>
  );
}

export function EventManagementPage({
  events,
  onClose,
}: {
  events: EventItem[];
  onClose: (eventId: string) => void;
}) {
  const { locale } = useLocale();
  const p = getStrings(locale).portal;

  return (
    <section className="page-section portal-event-mgmt">
      <h2>{p.eventManagement}</h2>
      <p className="muted-text">{p.eventManagementIntro}</p>
      <div className="list event-mgmt-list">
        {events.map((event) => (
          <div key={event.id} className="panel event-mgmt-card">
            <EventCard
              event={event}
              managementClose={
                event.status === 'active' ? { onClose: () => onClose(event.id), label: p.closeEventButton } : undefined
              }
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export function UserManagementPage({
  users: userList,
  departments: deptList,
  showToast,
  onUserCreated,
  offlineMockMode = false,
}: {
  users: User[];
  departments: Department[];
  showToast: (t: { tone: 'success' | 'warning' | 'danger' | 'info'; message: string }) => void;
  onUserCreated: (user: User) => void;
  /** Demo 靜態模式：建立使用者僅寫入前端 state。 */
  offlineMockMode?: boolean;
}) {
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

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDeptId, setNewDeptId] = useState(deptList[0]?.id ?? '');
  const [creating, setCreating] = useState(false);

  const submitNewUser = async () => {
    const name = newName.trim();
    const email = newEmail.trim();
    if (!name || !email) {
      showToast({ tone: 'danger', message: 'Name and email are required.' });
      return;
    }
    if (!newDeptId) {
      showToast({ tone: 'danger', message: 'Select a department.' });
      return;
    }
    setCreating(true);
    try {
      if (offlineMockMode) {
        const uid =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `u-mock-${Date.now()}`;
        const newUser: User = {
          id: uid,
          name,
          email,
          departmentId: newDeptId,
          roles: ['employee'],
          pushEnabled: true,
        };
        onUserCreated(newUser);
        setNewName('');
        setNewEmail('');
        showToast({ tone: 'success', message: 'Demo：已加入本機使用者清單。' });
        return;
      }
      const out = await adminCreateUserApi({ name, email, departmentId: newDeptId });
      onUserCreated(out.user);
      setNewName('');
      setNewEmail('');
      if (out.temporaryPassword) {
        showToast({ tone: 'success', message: p.userMgmtTempPassword(out.temporaryPassword) });
      } else {
        showToast({ tone: 'success', message: out.message });
      }
    } catch (e) {
      showToast({ tone: 'danger', message: e instanceof Error ? e.message : 'Create failed' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="page-section portal-user-mgmt">
      <h2>{p.userDeptManagement}</h2>
      <div className="grid-2">
        <section className="panel">
          <h3>{p.userMgmtAddAccount}</h3>
          <div className="event-form" style={{ marginTop: 12 }}>
            <label className="event-form-field">
              <span className="event-form-field-label">{p.userMgmtNamePlaceholder}</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={p.userMgmtNamePlaceholder} disabled={creating} />
            </label>
            <label className="event-form-field">
              <span className="event-form-field-label">{p.userMgmtEmailPlaceholder}</span>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={p.userMgmtEmailPlaceholder}
                disabled={creating}
                autoComplete="off"
              />
            </label>
            <label className="event-form-field">
              <span className="event-form-field-label">{p.userMgmtDeptLabel}</span>
              <select value={newDeptId} onChange={(e) => setNewDeptId(e.target.value)} disabled={creating || deptList.length === 0}>
                {deptList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn primary" disabled={creating || deptList.length === 0} onClick={() => void submitNewUser()}>
              {creating ? '…' : p.userMgmtCreateSubmit}
            </button>
          </div>
          <h3 style={{ marginTop: 24 }}>{p.employees}</h3>
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

export function GlobalNotificationInboxPage({ rows }: { rows: PortalNotificationRow[] }) {
  const { locale } = useLocale();
  const p = getStrings(locale).portal;
  const localeTag = locale === 'en' ? 'en-US' : 'zh-TW';
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const ta = a.sentAt ? new Date(a.sentAt).getTime() : 0;
        const tb = b.sentAt ? new Date(b.sentAt).getTime() : 0;
        return tb - ta;
      }),
    [rows],
  );

  return (
    <section className="page-section portal-notifications-inbox">
      <h2>{p.notificationInboxTitle}</h2>
      <p className="muted-text">{p.notificationInboxIntro}</p>
      <div className="list" style={{ marginTop: 16 }}>
        {sorted.length === 0 ? (
          <p className="empty">{p.notificationInboxEmpty}</p>
        ) : (
          sorted.map((row) => (
            <article className="list-item" key={row.id}>
              <div>
                <strong>{row.eventTitle?.trim() ? row.eventTitle : row.eventId}</strong>
                <p>
                  {p.notificationInboxChannelLabel}: {row.channel} · {p.notificationInboxStatusLabel}: {row.status}
                </p>
                <p className="muted-text">
                  {row.sentAt ? new Date(row.sentAt).toLocaleString(localeTag) : p.notSentYet}
                </p>
              </div>
            </article>
          ))
        )}
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
