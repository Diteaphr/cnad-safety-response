import { useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { AdminEventKpiPanel } from '../../components/dashboard/AdminEventKpiPanel';
import { DepartmentHistogram } from '../../components/dashboard/DepartmentHistogram';
import { DashboardShellHeader } from '../../components/dashboard/DashboardShellHeader';
import type { DashboardStrings } from '../../locale/strings';
import { getStrings } from '../../locale/strings';
import { useLocale } from '../../locale/LocaleContext';
import {
  formatAdminEventTypeLabel,
  formatEventImpactScope,
  stripRedundantStatusFromTitle,
} from '../../lib/adminEventDisplay';
import { formatEmployeeCardTime } from '../member/memberFormat';
import { SupervisorEmployeeCardList } from './SupervisorEmployeeCardList';
import { SupervisorReportInsightCard } from './SupervisorReportInsightCard';
import type { Department, EventItem, ToastState } from '../../types';

export type DashboardStatusFilter = 'all' | 'safe' | 'need_help' | 'pending';

function formatSynced(strings: DashboardStrings, ts: number | null, locale: string): string | null {
  if (ts === null) return null;
  const d = new Date(ts);
  return `${strings.lastSynced}: ${d.toLocaleString(locale === 'en' ? 'en-US' : 'zh-TW')}`;
}

type AdminPersonRow = {
  id: string;
  name: string;
  department: string;
  status: 'safe' | 'need_help' | 'pending';
  note?: string;
  phone?: string;
  email?: string;
  updatedAt?: string;
  locationLine?: string;
};

export function SupervisorDashboardPage({ // NOSONAR
  event,
  stats,
  rows,
  allRowsForDeptChart,
  departments: deptList,
  filter,
  setFilter,
  searchText,
  setSearchText,
  onBackToEvents,
  contactedMap,
  onToggleContacted,
  pendingRatioHigh,
  dashMismatchHint,
  dashboardFreshAt,
  showDepartmentTabs = false,
  departmentFilter = 'all',
  setDepartmentFilter,
  departmentOptions = [],
  supervisorOwnDepartment = '—',
  showToast,
  variant = 'supervisor',
  onCloseEvent,
  closingEventId,
}: Readonly<{
  event: EventItem | null;
  stats: { total: number; safe: number; needHelp: number; pending: number; responseRate: number };
  rows: AdminPersonRow[];
  /** Full event roster for department histogram (unscoped by department filter). */
  allRowsForDeptChart?: AdminPersonRow[];
  departments: Department[];
  filter: DashboardStatusFilter;
  setFilter: (value: DashboardStatusFilter) => void;
  searchText: string;
  setSearchText: (value: string) => void;
  onBackToEvents: () => void;
  contactedMap: Record<string, boolean>;
  onToggleContacted: (userId: string) => void;
  pendingRatioHigh: boolean;
  dashMismatchHint: string | null;
  dashboardFreshAt: number | null;
  showDepartmentTabs?: boolean;
  departmentFilter?: string;
  setDepartmentFilter?: (value: string) => void;
  departmentOptions?: string[];
  supervisorOwnDepartment?: string;
  showToast: (t: ToastState) => void;
  variant?: 'supervisor' | 'admin';
  onCloseEvent?: (eventId: string) => void | Promise<void>;
  closingEventId?: string | null;
}>) {
  const { locale } = useLocale();
  const { dash, portal: portalStrings, statusBadge } = getStrings(locale);
  const [pendingListOpen, setPendingListOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const rosterRef = useRef<HTMLElement>(null);
  const isAdmin = variant === 'admin';

  const filtered = rows
    .filter((row) => {
      if (filter === 'all') return row.status === 'safe' || row.status === 'need_help';
      return row.status === filter;
    })
    .filter((row) => row.name.toLowerCase().includes(searchText.toLowerCase()))
    .sort((a, b) => (a.status === 'need_help' ? -1 : 1) - (b.status === 'need_help' ? -1 : 1));
  const pendingRows = rows.filter((row) => row.status === 'pending');
  const tableRows = filtered;
  const rosterEmptyMessage = filter === 'all' ? dash.supervisorRosterNoReportedEmployees : undefined;

  const eventTitle = event ? stripRedundantStatusFromTitle(event.title) : '—';
  const typeDisplay = event ? formatAdminEventTypeLabel(event.type, portalStrings) : '—';
  const eventImpactScope = event ? formatEventImpactScope(event, deptList, portalStrings) : '—';
  const updatedLine = Array.isArray(dashboardFreshAt) || !dashboardFreshAt
    ? null
    : (() => {
        const freshDate = new Date(dashboardFreshAt);
        const locStr = locale === 'en' ? 'en-US' : 'zh-TW';
        return freshDate.toLocaleString(locStr);
      })();
  const createdSource = event?.startAt ?? event?.createdAt ?? null;
  const createdLine = formatEmployeeCardTime(createdSource, locale);
  const syncedLine = updatedLine ?? '—';
  const scopedDepartment = departmentFilter === 'all' ? null : departmentFilter;
  const outstandingClose = stats.needHelp > 0 || stats.pending > 0;
  const deptChartRows = allRowsForDeptChart ?? rows;
  const uncontactedNeedHelp = deptChartRows.filter(
    (row) => row.status === 'need_help' && !(contactedMap[row.id] ?? false),
  ).length;

  const supervisorFilterTabs: Array<{ key: DashboardStatusFilter; label: string }> = [
    { key: 'all', label: dash.filterAll },
    { key: 'need_help', label: dash.filterNeedHelp },
    { key: 'safe', label: dash.filterSafe },
  ];

  const adminFilterTabs: Array<{ key: DashboardStatusFilter; label: string }> = [
    { key: 'all', label: dash.filterAll },
    { key: 'need_help', label: dash.filterNeedHelp },
    { key: 'safe', label: dash.filterSafe },
  ];

  const filterTabs = isAdmin ? adminFilterTabs : supervisorFilterTabs;

  const scrollToRoster = () => {
    rosterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openCloseModal = () => setCloseModalOpen(true);

  const handleConfirmClose = async () => {
    if (!event?.id || !onCloseEvent) return;
    setCloseSubmitting(true);
    try {
      await onCloseEvent(event.id);
      setCloseModalOpen(false);
    } finally {
      setCloseSubmitting(false);
    }
  };

  const rosterToolbar = (
    <>
      <div className="sv-roster-toolbar">
        <div className="sv-roster-filters tabs">
          {filterTabs.map(({ key, label }) => (
            <button key={key} className={filter === key ? 'pill active' : 'pill'} onClick={() => setFilter(key)} type="button">
              {label}
            </button>
          ))}
        </div>
        <label className="sv-roster-search sv-roster-search--desktop">
          <Search className="sv-roster-search-icon" size={18} aria-hidden />
          <input
            type="search"
            placeholder={dash.searchPlaceholder}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label={dash.searchPlaceholder}
          />
        </label>
        <button
          type="button"
          className="sv-roster-search-toggle sv-roster-search--mobile"
          aria-label={dash.supervisorSearchToggleLabel}
          aria-expanded={searchExpanded}
          onClick={() => setSearchExpanded((open) => !open)}
        >
          <Search size={20} aria-hidden />
        </button>
      </div>
      {searchExpanded ? (
        <label className="sv-roster-search sv-roster-search--mobile-expanded">
          <Search className="sv-roster-search-icon" size={18} aria-hidden />
          <input
            type="search"
            placeholder={dash.searchPlaceholder}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label={dash.searchPlaceholder}
            autoFocus
          />
        </label>
      ) : null}
    </>
  );

  const statsReportSummary = (
    <SupervisorReportInsightCard
      stats={stats}
      dash={dash}
      pendingRatioHigh={pendingRatioHigh}
      onOpenPendingList={() => setPendingListOpen(true)}
    />
  );

  const rosterBlock = (
    <section ref={rosterRef} className="dash-panel-elevated sv-roster-panel admin-event-roster-panel">
      {isAdmin ? <h3 className="admin-roster-section-title">{dash.adminRosterSectionTitle}</h3> : null}
      {isAdmin && scopedDepartment ? (
        <div className="admin-roster-scope-bar">
          <span className="admin-roster-scope-label">{dash.adminRosterDeptScope(scopedDepartment)}</span>
          <button type="button" className="admin-roster-scope-clear" onClick={() => setDepartmentFilter?.('all')}>
            {dash.adminDeptClearFilter}
          </button>
        </div>
      ) : null}
      {rosterToolbar}
      <p className="sv-roster-footnote">
        {isAdmin && filter === 'all'
          ? dash.adminRosterPriorityNote(tableRows.length, rows.length)
          : dash.supervisorRosterFootnote(tableRows.length, rows.length)}
      </p>
      <SupervisorEmployeeCardList
        rows={tableRows}
        dash={dash}
        showToast={showToast}
        contactedMap={contactedMap}
        onToggleContacted={onToggleContacted}
        emptyMessage={rosterEmptyMessage}
        showNeedHelpDivider={isAdmin && filter === 'all'}
      />
      {isAdmin && pendingRows.length > 0 ? (
        <div className="admin-roster-pending-cta-wrap">
          <button type="button" className="admin-roster-pending-cta" onClick={() => setPendingListOpen(true)}>
            {dash.adminViewPendingEmployees(pendingRows.length)}
          </button>
        </div>
      ) : null}
    </section>
  );

  const pendingModal = pendingListOpen ? (
    <div className="modal-backdrop">
      <button 
        type="button" 
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', border: 'none', background: 'none', width: '100%', height: '100%', zIndex: 0 }}
        onClick={() => setPendingListOpen(false)}
        aria-label="Close"
      />
      <dialog open className="modal sv-pending-list-modal" aria-labelledby="sv-pending-list-title" style={{ position: 'relative', zIndex: 1 }}>
        <h3 id="sv-pending-list-title">{dash.supervisorPendingListTitle}</h3>
        <p className="muted-text small sv-pending-list-note">{dash.supervisorPendingListNote}</p>
        {pendingRows.length === 0 ? (
          <p className="empty">{dash.noRows}</p>
        ) : (
          <SupervisorEmployeeCardList
            rows={pendingRows}
            dash={dash}
            showToast={showToast}
            contactedMap={contactedMap}
            onToggleContacted={onToggleContacted}
          />
        )}
        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={() => setPendingListOpen(false)}>
            {dash.supervisorContactClose}
          </button>
        </div>
      </dialog>
    </div>
  ) : null;

  let confirmButtonLabel = dash.adminCloseEventConfirmOk;
  if (closingEventId === event?.id) {
    confirmButtonLabel = '…';
  } else if (outstandingClose) {
    confirmButtonLabel = dash.adminCloseEventConfirmAnyway;
  }

  const closeEventModal =
    isAdmin && closeModalOpen ? (
      <div className="modal-backdrop">
        <button 
          type="button" 
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', border: 'none', background: 'none', width: '100%', height: '100%', zIndex: 0 }}
          onClick={() => setCloseModalOpen(false)}
          aria-label="Close"
        />
        <dialog open className="modal admin-close-event-modal" aria-labelledby="admin-close-event-title" style={{ position: 'relative', zIndex: 1 }}>
          <h3 id="admin-close-event-title">{dash.adminCloseEventTitle}</h3>
          {outstandingClose ? (
            <>
              <p className="admin-close-summary">{dash.adminCloseEventOutstandingSummary(stats.needHelp, stats.pending)}</p>
              <p className="muted-text">{dash.adminCloseEventNote}</p>
            </>
          ) : (
            <p className="muted-text">{dash.adminCloseEventAllDoneNote}</p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setCloseModalOpen(false)}
              disabled={closeSubmitting || closingEventId === event?.id}
            >
              {dash.adminCloseEventCancel}
            </button>
            <button
              type="button"
              className="btn admin-btn-end-event-outline"
              onClick={() => void handleConfirmClose()}
              disabled={closeSubmitting || closingEventId === event?.id}
            >
              {confirmButtonLabel}
            </button>
          </div>
        </dialog>
      </div>
    ) : null;

  if (!event) {
    return (
      <section className="page-section dash-board-surface supervisor-dash-page">
        <DashboardShellHeader
          brandName={dash.brand}
          backLabel={dash.backToEvents}
          onBack={onBackToEvents}
          lastSyncedFormatted={formatSynced(dash, dashboardFreshAt, locale)}
          syncOk
        />
        <p className="empty">{dash.noRows}</p>
      </section>
    );
  }

  if (isAdmin) {
    const adminMetaLine = `${typeDisplay} · ${eventImpactScope} · ${createdLine}`;

    return (
      <section className="page-section dash-board-surface supervisor-dash-page supervisor-event-detail-root admin-dash-page">
        <DashboardShellHeader
          brandName={dash.brand}
          backLabel={dash.backToEvents}
          onBack={onBackToEvents}
          lastSyncedFormatted={formatSynced(dash, dashboardFreshAt, locale)}
          syncOk
        />

        <article className="dash-panel-elevated admin-event-info-card">
          <div className="admin-event-info-head">
            <div className="admin-event-info-text">
              <div className="admin-event-info-title-row">
                <h1 className="admin-event-info-title">{eventTitle}</h1>
                <span
                  className={`admin-event-center-status-pill admin-event-center-status-pill--${event.status === 'closed' ? 'closed' : 'active'}`}
                >
                  {event.status === 'closed' ? dash.closed : dash.ongoing}
                </span>
              </div>
              <p className="admin-event-info-meta muted-text">{adminMetaLine}</p>
            </div>
            {event.status === 'active' && onCloseEvent ? (
              <button
                type="button"
                className="btn admin-btn-end-event-outline admin-event-info-close-btn"
                onClick={openCloseModal}
                disabled={closingEventId === event.id}
              >
                {dash.adminCloseEventOutlineLabel}
              </button>
            ) : null}
          </div>
        </article>

        {dashMismatchHint ? <p className="dash-scope-hint muted-text">{dashMismatchHint}</p> : null}

        <div className="supervisor-event-detail-body admin-event-detail-body">
          <AdminEventKpiPanel
            stats={stats}
            dash={dash}
            safeLabel={statusBadge.safe}
            uncontactedNeedHelp={uncontactedNeedHelp}
            syncedLine={syncedLine}
            reportedOfTotal={portalStrings.adminEventCenterReportedOfTotal}
          />

          {showDepartmentTabs && departmentOptions.length > 1 ? (
            <DepartmentHistogram
              rows={deptChartRows}
              dash={dash}
              selectedDept={scopedDepartment}
              onSelectDept={(name) => {
                setDepartmentFilter?.(name);
                scrollToRoster();
              }}
              onClearDept={() => setDepartmentFilter?.('all')}
              onScrollToRoster={scrollToRoster}
            />
          ) : null}

          {rosterBlock}
        </div>

        {pendingModal}
        {closeEventModal}
      </section>
    );
  }

  return (
    <section className="page-section dash-board-surface supervisor-dash-page supervisor-event-detail-root">
      <DashboardShellHeader
        brandName={dash.brand}
        backLabel={dash.backToEvents}
        onBack={onBackToEvents}
        lastSyncedFormatted={formatSynced(dash, dashboardFreshAt, locale)}
        syncOk
      />

      <article className="dash-panel-elevated sv-event-hero">
        <div className="sv-event-hero-head">
          <h1 className="sv-event-hero-title">{eventTitle}</h1>
          <span
            className={`admin-event-center-status-pill sv-event-hero-pill admin-event-center-status-pill--${event.status === 'closed' ? 'closed' : 'active'}`}
          >
            {event.status === 'closed' ? dash.closed : dash.ongoing}
          </span>
        </div>
        <p className="sv-event-hero-lead">
          {typeDisplay}
          <span className="sv-event-hero-dot" aria-hidden>
            {' '}
            ·{' '}
          </span>
          {dash.supervisorEventScopeLabel}：{eventImpactScope}
        </p>
        <p className="sv-event-hero-context">
          {dash.supervisorYourDeptLabel}：{supervisorOwnDepartment}
        </p>
        <p className="sv-event-hero-meta">
          {createdLine}
          <span className="sv-event-hero-dot" aria-hidden>
            {' '}
            ·{' '}
          </span>
          {dash.lastSynced} {syncedLine}
        </p>
      </article>

      {dashMismatchHint ? <p className="dash-scope-hint muted-text">{dashMismatchHint}</p> : null}

      {showDepartmentTabs && departmentOptions.length > 1 ? (
        <div className="dash-panel-elevated admin-event-detail-scope-bar supervisor-event-detail-scope-bar">
          <div className="admin-event-detail-scope-bar-inner">
            <p className="admin-event-detail-scope-heading">{dash.adminScopeCurrentRangeHeading}</p>
            <div className="admin-event-detail-scope-row">
              <select
                className={`admin-scope-select admin-event-detail-scope-select supervisor-event-detail-scope-select${scopedDepartment ? ' admin-event-detail-scope-select--filled' : ' admin-event-detail-scope-select--idle'}`}
                aria-label={dash.adminScopeCurrentRangeHeading}
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter?.(e.target.value)}
              >
                <option value="all">{portalStrings.supervisorDeptFilterAll}</option>
                {[...departmentOptions]
                  .sort((a, b) => a.localeCompare(b))
                  .map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          {scopedDepartment ? (
            <p className="muted-text small admin-scope-employees-hint">
              <span className="admin-scope-hint-long">{dash.adminScopeEmployeesOnlyHint(scopedDepartment)}</span>
              <span className="admin-scope-hint-short">{dash.adminScopeEmployeesOnlyHintShort}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="supervisor-event-detail-body">
        {statsReportSummary}
        {rosterBlock}
      </div>

      {pendingModal}
    </section>
  );
}
