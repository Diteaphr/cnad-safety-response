import { StatCard } from '../../components/StatCard';
import { PageBackButton } from '../../components/PageBackButton';
import { PageHeader } from '../../components/PageHeader';
import { useLocale, type AppLocale } from '../../locale/LocaleContext';
import { getStrings } from '../../locale/strings';
import { useEffect, useMemo, useRef, useState } from 'react';
import { adminCreateEventTypeApi, adminCreateUserApi, type PortalNotificationRow, type FailedNotificationRow } from '../../api';
import { formatLocaleDateTime, localDateTimeLocalInputValue, nowMs } from '../../lib/localTime';
import type { Department, EventItem, NotificationSummary, User } from '../../types';

export type EventFormState = {
  title: string;
  type: string;
  customType: string;
  description: string;
  startAt: string;
  location: string;
  targetDepartmentIds: string[];
};

export function createInitialEventForm(): EventFormState {
  return {
    title: '',
    type: '',
    customType: '',
    description: '',
    startAt: localDateTimeLocalInputValue(),
    location: '',
    targetDepartmentIds: [],
  };
}

import { ChevronRight, Plus } from 'lucide-react';

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

const BUILTIN_TYPE_ORDER = ['Earthquake', 'Typhoon', 'Fire'] as const;

function isOtherEventType(name: string) {
  return name.trim().toLowerCase() === 'other';
}

function unassignedDeptLabel(locale: string) {
  return locale === 'zh-Hant' ? '未分配部門' : 'Unassigned';
}

function getRosterTitle(
  selectedDeptId: string | null,
  locale: string,
  deptList: Department[],
): string {
  if (selectedDeptId === '__none__') return unassignedDeptLabel(locale);
  if (!selectedDeptId) return '';
  return deptList.find((d) => d.id === selectedDeptId)?.name ?? '';
}

function getRosterEmployees(
  selectedDeptId: string | null,
  employeesByDept: Map<string, User[]>,
): User[] {
  if (selectedDeptId === '__none__') return employeesByDept.get('__none__') ?? [];
  if (!selectedDeptId) return [];
  return employeesByDept.get(selectedDeptId) ?? [];
}

function flattenDepts(depts: Department[]): { dept: Department; depth: number }[] {
  const childMap: Record<string, Department[]> = {};
  for (const d of depts) {
    const parent = d.parentId ?? '__root__';
    childMap[parent] ??= [];
    childMap[parent].push(d);
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

export function AdminDeptHierarchyList({
  flatDepts,
  mode,
  selectedId,
  selectedIds = [],
  onSelectId,
  onToggleId,
  hint,
  countLabel,
}: Readonly<{
  flatDepts: { dept: Department; depth: number }[];
  mode: 'single' | 'multiple';
  selectedId?: string;
  selectedIds?: string[];
  onSelectId?: (id: string) => void;
  onToggleId?: (id: string, checked: boolean) => void;
  hint?: string;
  countLabel?: string;
}>) {
  if (flatDepts.length === 0) return null;
  return (
    <div className="admin-notify-dept-picker">
      {hint || countLabel ? (
        <div className="admin-notify-dept-picker-head">
          {hint ? <p className="muted-text small admin-notify-dept-hint">{hint}</p> : <span />}
          {countLabel ? <span className="admin-notify-dept-count">{countLabel}</span> : null}
        </div>
      ) : null}
      <ul className="admin-notify-dept-checklist">
        {flatDepts.map(({ dept, depth }) => {
          const checked =
            mode === 'single' ? selectedId === dept.id : selectedIds.includes(dept.id);
          return (
            <li key={dept.id}>
              <label
                className={`admin-notify-dept-check-item${checked ? ' is-checked' : ''}`}
                style={{ paddingLeft: 12 + depth * 16 }}
              >
                <input
                  type={mode === 'single' ? 'radio' : 'checkbox'}
                  name={mode === 'single' ? 'admin-dept-pick' : undefined}
                  className="admin-notify-dept-check-input"
                  checked={checked}
                  onChange={(e) => {
                    if (mode === 'single') {
                      onSelectId?.(dept.id);
                    } else {
                      onToggleId?.(dept.id, e.target.checked);
                    }
                  }}
                />
                <span className="admin-notify-dept-check-label">{dept.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AdminQuickCreateFormFields({
  p,
  eventForm,
  setEventForm,
  eventTypeCatalog,
  departments,
  onEventTypesChanged,
  showToast,
}: Readonly<{
  p: ReturnType<typeof getStrings>['portal'];
  eventForm: EventFormState;
  setEventForm: (value: EventFormState) => void;
  eventTypeCatalog: { name: string }[] | null;
  departments: Department[];
  onEventTypesChanged?: () => void | Promise<void>;
  showToast?: (t: { tone: 'success' | 'warning' | 'danger' | 'info'; message: string }) => void;
}>) {
  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [addingType, setAddingType] = useState(false);
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
    return [...eventTypeCatalog]
      .filter((row) => !isOtherEventType(row.name))
      .sort((a, b) => {
        const d = rank(a.name) - rank(b.name);
        return d === 0 ? a.name.localeCompare(b.name) : d;
      });
  }, [eventTypeCatalog]);

  useEffect(() => {
    if (!isOtherEventType(eventForm.type)) return;
    const next = typeSelectRows[0]?.name;
    if (next) setEventForm({ ...eventForm, type: next, customType: '' });
  }, [eventForm.type, typeSelectRows]);

  const submitNewEventType = async () => {
    const name = newTypeName.trim();
    if (!name || addingType) return;
    setAddingType(true);
    try {
      const created = await adminCreateEventTypeApi(name);
      await onEventTypesChanged?.();
      setEventForm({ ...eventForm, type: created.name, customType: '' });
      setNewTypeName('');
      setAddTypeOpen(false);
      showToast?.({ tone: 'success', message: created.name });
    } catch (e) {
      showToast?.({
        tone: 'danger',
        message: e instanceof Error ? e.message : 'Failed to add event type',
      });
    } finally {
      setAddingType(false);
    }
  };

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
        <select
          value={eventForm.type}
          onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}
          required
        >
          <option value="">{p.formLabelEventTypePlaceholder}</option>
          {typeSelectRows.map((row) => (
            <option key={row.name} value={row.name}>
              {typeLabel(row.name, p)}
            </option>
          ))}
        </select>
        {addTypeOpen ? (
          <div className="event-form-add-type-panel">
            <input
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder={p.addEventTypePlaceholder}
              disabled={addingType}
            />
            <div className="event-form-add-type-actions">
              <button
                type="button"
                className="btn ghost btn-sm"
                disabled={addingType}
                onClick={() => {
                  setAddTypeOpen(false);
                  setNewTypeName('');
                }}
              >
                {p.addEventTypeCancel}
              </button>
              <button
                type="button"
                className="btn primary btn-sm"
                disabled={addingType || !newTypeName.trim()}
                onClick={() => void submitNewEventType()}
              >
                {addingType ? '…' : p.addEventTypeSubmit}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="auth-link event-form-add-type-link" onClick={() => setAddTypeOpen(true)}>
            {p.addEventTypeLink}
          </button>
        )}
      </label>
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
      <div className="event-form-field admin-notify-scope-field">
          <span className="event-form-field-label">{p.formLabelNotifyTarget}</span>
          <div className="admin-notify-scope-panel">
            <fieldset className="admin-scope-toggle-row admin-notify-scope-mode" aria-label={p.formLabelNotifyTarget}>
              <button
                type="button"
                className={`admin-scope-toggle${limitToDept ? '' : ' is-active'}`}
                onClick={() => setEventForm({ ...eventForm, targetDepartmentIds: [] })}
              >
                {p.notifyScopeAll}
              </button>
              <button
                type="button"
                className={`admin-scope-toggle${limitToDept ? ' is-active' : ''}`}
                onClick={() => {
                  if (!limitToDept) {
                    setEventForm({
                      ...eventForm,
                      targetDepartmentIds: flatDepts.length > 0 ? [flatDepts[0].dept.id] : [],
                    });
                  }
                }}
              >
                {p.notifyScopeDepartments}
              </button>
            </fieldset>
            {limitToDept && flatDepts.length > 0 ? (
              <AdminDeptHierarchyList
                mode="multiple"
                flatDepts={flatDepts}
                selectedIds={eventForm.targetDepartmentIds}
                hint={p.notifyScopeDeptHint}
                countLabel={
                  eventForm.targetDepartmentIds.length > 0
                    ? `${eventForm.targetDepartmentIds.length} / ${flatDepts.length}`
                    : undefined
                }
                onToggleId={(id, checked) => {
                  const next = checked
                    ? [...eventForm.targetDepartmentIds, id]
                    : eventForm.targetDepartmentIds.filter((d) => d !== id);
                  setEventForm({
                    ...eventForm,
                    targetDepartmentIds: next.length > 0 ? next : [id],
                  });
                }}
              />
            ) : null}
          </div>
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
}: Readonly<{
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
}>) {
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
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
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
          className="modal-backdrop admin-create-event-backdrop"
          aria-hidden="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !createSubmitting) {
              setCreateModalOpen(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
              if (!createSubmitting) setCreateModalOpen(false);
            }
          }}
        >
          <dialog
            open
            className="modal admin-create-event-modal"
            aria-modal="true"
            aria-labelledby="admin-create-event-title"
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
          </dialog>
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

export function UserManagementPage({
  users: userList,
  departments: deptList,
  showToast,
  onUserCreated,
  offlineMockMode = false,
  selectedDeptId,
  onSelectedDeptIdChange,
  onAddModalOpenChange,
}: Readonly<{
  users: User[];
  departments: Department[];
  showToast: (t: { tone: 'success' | 'warning' | 'danger' | 'info'; message: string }) => void;
  onUserCreated: (user: User) => void;
  /** Demo 靜態模式：建立使用者僅寫入前端 state。 */
  offlineMockMode?: boolean;
  selectedDeptId: string | null;
  onSelectedDeptIdChange: (deptId: string | null) => void;
  onAddModalOpenChange?: (open: boolean) => void;
}>) {
  const { locale } = useLocale();
  const p = getStrings(locale).portal;
  const flatDepts = useMemo(() => flattenDepts(deptList), [deptList]);
  const employees = useMemo(
    () => userList.filter((u) => u.roles.includes('employee')),
    [userList],
  );
  const employeesByDept = useMemo(() => {
    const map = new Map<string, User[]>();
    for (const emp of employees) {
      const key = emp.departmentId || '__none__';
      const bucket = map.get(key) ?? [];
      bucket.push(emp);
      map.set(key, bucket);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [employees]);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmployeeNo, setNewEmployeeNo] = useState('');
  const [newDeptId, setNewDeptId] = useState(deptList[0]?.id ?? '');
  const [creating, setCreating] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const creatingRef = useRef(false);

  useEffect(() => {
    creatingRef.current = creating;
  }, [creating]);

  const setAddModalOpenSynced = (open: boolean) => {
    setAddModalOpen(open);
    onAddModalOpenChange?.(open);
  };

  useEffect(() => {
    if (!addModalOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creatingRef.current) setAddModalOpenSynced(false);
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [addModalOpen]);

  const resetNewUserForm = () => {
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewEmployeeNo('');
  };

  const submitNewUser = async () => {
    const name = newName.trim();
    const email = newEmail.trim();
    const phone = newPhone.trim();
    const employeeNo = newEmployeeNo.trim();
    if (!name || !email) {
      showToast({ tone: 'danger', message: 'Name and email are required.' });
      return;
    }
    if (!phone) {
      showToast({ tone: 'danger', message: p.userMgmtPhoneRequired });
      return;
    }
    if (!employeeNo) {
      showToast({ tone: 'danger', message: p.userMgmtEmployeeNoRequired });
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
            : `u-mock-${nowMs()}`;
        const newUser: User = {
          id: uid,
          name,
          email,
          phone,
          employeeCode: employeeNo,
          departmentId: newDeptId,
          roles: ['employee'],
          pushEnabled: true,
        };
        onUserCreated(newUser);
        resetNewUserForm();
        setAddModalOpenSynced(false);
        showToast({ tone: 'success', message: 'Demo：已加入本機使用者清單。' });
        return;
      }
      const out = await adminCreateUserApi({ name, email, phone, employeeNo, departmentId: newDeptId });
      onUserCreated(out.user);
      resetNewUserForm();
      setAddModalOpenSynced(false);
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

  const addAccountFormProps = {
    p,
    flatDepts,
    creating,
    newName,
    setNewName,
    newEmail,
    setNewEmail,
    newPhone,
    setNewPhone,
    newEmployeeNo,
    setNewEmployeeNo,
    newDeptId,
    setNewDeptId,
  };

  const rosterTitle = getRosterTitle(selectedDeptId, locale, deptList);
  const rosterEmployees = getRosterEmployees(selectedDeptId, employeesByDept);

  return (
    <section className="page-section portal-user-mgmt">
      <PageHeader title={p.userDeptManagement} subtitle={p.userMgmtEmployeesByDeptDesc} />
      <div className="portal-user-mgmt-layout">
        <section className="panel portal-user-mgmt-add">
          <h3>{p.userMgmtAddAccount}</h3>
          <UserMgmtAddAccountForm {...addAccountFormProps} />
          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 12 }}
            disabled={creating || deptList.length === 0}
            onClick={() => void submitNewUser()}
          >
            {creating ? '…' : p.userMgmtCreateSubmit}
          </button>
        </section>
        <UserMgmtRosterPanel
          p={p}
          locale={locale}
          selectedDeptId={selectedDeptId}
          rosterTitle={rosterTitle}
          rosterEmployees={rosterEmployees}
          flatDepts={flatDepts}
          employeesByDept={employeesByDept}
          onSelectedDeptIdChange={onSelectedDeptIdChange}
          onOpenAddModal={() => setAddModalOpenSynced(true)}
        />
      </div>
      {addModalOpen ? (
        <div
          className="modal-backdrop user-mgmt-add-backdrop"
          aria-hidden="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !creating) setAddModalOpenSynced(false);
          }}
          onKeyDown={(e) => {
            if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
              if (!creating) setAddModalOpenSynced(false);
            }
          }}
        >
          <dialog
            open
            className="modal user-mgmt-add-modal"
            aria-modal="true"
            aria-labelledby="user-mgmt-add-title"
          >
            <h3 id="user-mgmt-add-title">{p.userMgmtAddAccount}</h3>
            <UserMgmtAddAccountForm {...addAccountFormProps} />
            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                disabled={creating}
                onClick={() => setAddModalOpenSynced(false)}
              >
                {p.adminCreateModalCancel}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={creating || deptList.length === 0}
                onClick={() => void submitNewUser()}
              >
                {creating ? '…' : p.userMgmtCreateSubmit}
              </button>
            </div>
          </dialog>
        </div>
      ) : null}
    </section>
  );
}

function UserMgmtRosterPanel({
  p,
  locale,
  selectedDeptId,
  rosterTitle,
  rosterEmployees,
  flatDepts,
  employeesByDept,
  onSelectedDeptIdChange,
  onOpenAddModal,
}: Readonly<{
  p: ReturnType<typeof getStrings>['portal'];
  locale: string;
  selectedDeptId: string | null;
  rosterTitle: string;
  rosterEmployees: User[];
  flatDepts: { dept: Department; depth: number }[];
  employeesByDept: Map<string, User[]>;
  onSelectedDeptIdChange: (deptId: string | null) => void;
  onOpenAddModal: () => void;
}>) {
  if (selectedDeptId) {
    return (
      <section className="panel portal-user-mgmt-roster">
        <PageBackButton onClick={() => onSelectedDeptIdChange(null)} ariaLabel={p.userMgmtBackToDepts} />
        <h3>{rosterTitle}</h3>
        {rosterEmployees.length === 0 ? (
          <p className="muted-text empty">{p.userMgmtNoEmployeesInDept}</p>
        ) : (
          <div className="user-mgmt-roster-list">
            {rosterEmployees.map((user) => (
              <div className="list-item user-mgmt-roster-row" key={user.id}>
                <div>
                  <strong>{user.name}</strong>
                  <p>{user.email}</p>
                  {user.phone ? <p className="muted-text small">{user.phone}</p> : null}
                </div>
                <span className="muted-text small">{user.pushEnabled ? p.pushEnabled : p.pushNotEnabled}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  const unassignedCount = employeesByDept.get('__none__')?.length ?? 0;
  return (
    <section className="panel portal-user-mgmt-roster">
      <div className="user-mgmt-roster-head">
        <h3>{p.userMgmtEmployeesByDept}</h3>
        <button
          type="button"
          className="user-mgmt-add-trigger"
          onClick={onOpenAddModal}
          aria-label={p.userMgmtFabAddAccountAria}
          aria-haspopup="dialog"
        >
          <Plus size={18} strokeWidth={2.4} aria-hidden />
          <span>{p.userMgmtAddAccount}</span>
        </button>
      </div>
      <p className="muted-text small">{p.userMgmtEmployeesByDeptDesc}</p>
      <div className="user-mgmt-dept-list">
        {flatDepts.map(({ dept, depth }) => {
          const count = employeesByDept.get(dept.id)?.length ?? 0;
          return (
            <button
              type="button"
              key={dept.id}
              className="user-mgmt-dept-row"
              style={{ paddingLeft: 12 + depth * 14 }}
              onClick={() => onSelectedDeptIdChange(dept.id)}
            >
              <span className="user-mgmt-dept-name">{dept.name}</span>
              <span className="user-mgmt-dept-meta">
                <span className="muted-text">{p.userMgmtEmployeeCount(count)}</span>
                <ChevronRight size={18} aria-hidden />
              </span>
            </button>
          );
        })}
        {unassignedCount > 0 ? (
          <button type="button" className="user-mgmt-dept-row" onClick={() => onSelectedDeptIdChange('__none__')}>
            <span className="user-mgmt-dept-name">{unassignedDeptLabel(locale)}</span>
            <span className="user-mgmt-dept-meta">
              <span className="muted-text">{p.userMgmtEmployeeCount(unassignedCount)}</span>
              <ChevronRight size={18} aria-hidden />
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function UserMgmtAddAccountForm({
  p,
  flatDepts,
  creating,
  newName,
  setNewName,
  newEmail,
  setNewEmail,
  newPhone,
  setNewPhone,
  newEmployeeNo,
  setNewEmployeeNo,
  newDeptId,
  setNewDeptId,
}: Readonly<{
  p: ReturnType<typeof getStrings>['portal'];
  flatDepts: { dept: Department; depth: number }[];
  creating: boolean;
  newName: string;
  setNewName: (v: string) => void;
  newEmail: string;
  setNewEmail: (v: string) => void;
  newPhone: string;
  setNewPhone: (v: string) => void;
  newEmployeeNo: string;
  setNewEmployeeNo: (v: string) => void;
  newDeptId: string;
  setNewDeptId: (v: string) => void;
}>) {
  return (
    <div className="event-form user-mgmt-add-form" style={{ marginTop: 12 }}>
      <label className="event-form-field">
        <span className="event-form-field-label">{p.userMgmtNamePlaceholder}</span>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={p.userMgmtNamePlaceholder}
          disabled={creating}
        />
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
        <span className="event-form-field-label">{p.userMgmtPhoneLabel}</span>
        <input
          type="tel"
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          placeholder={p.userMgmtPhonePlaceholder}
          disabled={creating}
          autoComplete="off"
          inputMode="tel"
        />
      </label>
      <label className="event-form-field">
        <span className="event-form-field-label">{p.userMgmtEmployeeNoLabel}</span>
        <input
          value={newEmployeeNo}
          onChange={(e) => setNewEmployeeNo(e.target.value)}
          placeholder={p.userMgmtEmployeeNoPlaceholder}
          disabled={creating}
          autoComplete="off"
        />
      </label>
      <div className="event-form-field admin-notify-scope-field">
        <span className="event-form-field-label">{p.userMgmtDeptLabel}</span>
        <div className="admin-notify-scope-panel">
          <AdminDeptHierarchyList
            mode="single"
            flatDepts={flatDepts}
            selectedId={newDeptId}
            onSelectId={setNewDeptId}
            hint={p.userMgmtDeptPickHint}
          />
        </div>
      </div>
    </div>
  );
}

export function GlobalNotificationInboxPage({ rows }: Readonly<{ rows: PortalNotificationRow[] }>) {
  const { locale } = useLocale();
  const p = getStrings(locale).portal;
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
      <PageHeader title={p.notificationInboxTitle} subtitle={p.notificationInboxIntro} />
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
                  {row.sentAt ? formatLocaleDateTime(row.sentAt, locale) : p.notSentYet}
                </p>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function FailedDeliveriesList({
  p,
  locale,
  loadingFailed,
  failedRows,
  canManageFailed,
  onRetryFailed,
}: Readonly<{
  p: ReturnType<typeof getStrings>['portal'];
  locale: AppLocale;
  loadingFailed?: boolean;
  failedRows: FailedNotificationRow[];
  canManageFailed?: boolean;
  onRetryFailed: (notificationId: string) => void;
}>) {
  if (loadingFailed) {
    return <p className="muted-text">{p.loading}</p>;
  }
  if (failedRows.length === 0) {
    return <p className="empty">{p.noFailedDeliveries}</p>;
  }
  return (
    <>
      {failedRows.map((row) => (
        <article className="list-item" key={row.id}>
          <div>
            <strong>{row.userName}</strong>
            <p>
              {(row.department ?? p.na)} · {row.channel}
            </p>
            <p>{row.sentAt ? formatLocaleDateTime(row.sentAt, locale) : p.notSentYet}</p>
          </div>
          {canManageFailed ? (
            <button type="button" className="btn warning btn-sm" onClick={() => onRetryFailed(row.id)}>
              {p.retryDelivery}
            </button>
          ) : (
            <span className="muted-text">{p.adminOnlyManageFailed}</span>
          )}
        </article>
      ))}
    </>
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
}: Readonly<{
  summary: NotificationSummary;
  failedRows: FailedNotificationRow[];
  loadingFailed?: boolean;
  canSendReminder: boolean;
  canManageFailed?: boolean;
  onSendReminder: () => void;
  onRetryFailed: (notificationId: string) => void;
  onRefreshFailed: () => void;
  onBackToEvents: () => void;
}>) {
  const { locale } = useLocale();
  const p = getStrings(locale).portal;

  return (
    <section className="page-section portal-notifications">
      <PageBackButton onClick={onBackToEvents} ariaLabel={p.backToEventList} />
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
            <FailedDeliveriesList
              p={p}
              locale={locale}
              loadingFailed={loadingFailed}
              failedRows={failedRows}
              canManageFailed={canManageFailed}
              onRetryFailed={onRetryFailed}
            />
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
              summary.reminderHistory.map((item) => (
                  <article className="list-item" key={item.id}>
                    <div>
                      <strong>{item.note}</strong>
                      <p>{formatLocaleDateTime(item.sentAt, locale)}</p>
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
