import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { DashboardShellHeader } from '../../components/dashboard/DashboardShellHeader';
import { PageBackButton } from '../../components/PageBackButton';
import { ResponseDistributionBar } from '../../components/dashboard/ResponseDistributionBar';
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
import { formatSupervisorViewScope } from './supervisorEventDetailHelpers';
import type { Department, EventItem, ToastState } from '../../types';

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

type DeptAgg = { department: string; safe: number; need_help: number; pending: number };

function adminDeptResponseRate(row: DeptAgg): number {
  const t = row.safe + row.need_help + row.pending;
  return t ? Math.round(((row.safe + row.need_help) / t) * 100) : 0;
}

function AdminDeptStatusList({
  rows,
  dash,
  onViewDepartment,
}: {
  rows: DeptAgg[];
  dash: DashboardStrings;
  onViewDepartment: (department: string) => void;
}) {
  return (
    <div className="admin-dept-status-list">
      {rows.map((row) => {
        const rate = adminDeptResponseRate(row);
        return (
          <article key={row.department} className="admin-dept-status-card">
            <div className="admin-dept-status-card-body">
              <strong className="admin-dept-status-card-title">{row.department}</strong>
              <p className="admin-dept-status-card-rate">{rate}%</p>
              <p className="muted-text small admin-dept-status-card-stats">
                {dash.kpiSafe} {row.safe} · {dash.kpiNeedHelp} {row.need_help} · {dash.kpiNoResponse} {row.pending}
              </p>
            </div>
            <div className="admin-dept-status-card-footer">
              <button
                type="button"
                className="btn ghost btn-sm admin-dept-view-btn"
                onClick={() => onViewDepartment(row.department)}
              >
                {dash.adminDeptActionView}
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function formatAdminReportTime(iso: string | undefined, locale: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale === 'en' ? 'en-US' : 'zh-TW');
  } catch {
    return '—';
  }
}

export function TeamDashboardHomePage({
  activeRows,
  closedRows,
  onOpenEvent,
  dashboardFreshAt,
}: {
  activeRows: Array<{ event: EventItem; teamCounts: { total: number; safe: number; needHelp: number; pending: number } }>;
  closedRows: Array<{ event: EventItem; teamCounts: { total: number; safe: number; needHelp: number; pending: number } }>;
  onOpenEvent: (eventId: string) => void;
  dashboardFreshAt: number | null;
}) {
  const { locale } = useLocale();
  const { dash } = getStrings(locale);

  const renderCard = (
    row: { event: EventItem; teamCounts: { total: number; safe: number; needHelp: number; pending: number } },
    variant: 'active' | 'closed',
  ) => {
    const { event, teamCounts } = row;
    const pctPending = teamCounts.total ? Math.round((teamCounts.pending / teamCounts.total) * 100) : 0;
    const rate = teamCounts.total
      ? Math.round(((teamCounts.safe + teamCounts.needHelp) / teamCounts.total) * 100)
      : 0;
    const alertHigh = variant === 'active' && teamCounts.total > 0 && teamCounts.pending / teamCounts.total >= 0.3;
    const statusLabel = event.status === 'active' ? dash.ongoing : dash.closed;
    return (
      <button
        key={event.id}
        type="button"
        className={`team-dash-event-card${variant === 'closed' ? ' team-dash-event-card--closed' : ''}${alertHigh ? ' team-dash-event-card--alert' : ''}`}
        onClick={() => onOpenEvent(event.id)}
      >
        <div className="team-dash-event-card-top">
          <strong className="team-dash-event-title">{event.title}</strong>
          <span className="muted-text team-dash-event-meta">
            {event.type} · {statusLabel}
          </span>
        </div>
        <div className="team-dash-event-stats">
          <span>
            {dash.kpiNoResponse} {teamCounts.pending} / {teamCounts.total}（{pctPending}%）
          </span>
          <span className="muted-text">
            {dash.responseRateCenter} {rate}%
          </span>
        </div>
        <div className="progress-track team-dash-progress">
          <div className="progress-fill" style={{ width: `${rate}%` }} />
        </div>
      </button>
    );
  };

  return (
    <section className="page-section team-dashboard-home dash-board-surface">
      <DashboardShellHeader
        brandName={dash.brand}
        backLabel={dash.backToEvents}
        onBack={() => {}}
        showBack={false}
        lastSyncedFormatted={formatSynced(dash, dashboardFreshAt, locale)}
        syncOk
      />
      <header className="dash-page-title-block">
        <h2>{dash.teamHomeTitle}</h2>
        <p className="muted-text">{dash.teamHomeSubtitle}</p>
      </header>
      <section className="team-dashboard-home-section">
        <h3 className="section-title">{dash.ongoing}</h3>
        {activeRows.length === 0 ? (
          <p className="empty muted-text">{dash.emptyBody}</p>
        ) : (
          <div className="team-dash-event-list">{activeRows.map((r) => renderCard(r, 'active'))}</div>
        )}
      </section>
      <section className="team-dashboard-home-section team-dashboard-home-section--closed">
        <h3 className="section-title">{dash.closed}</h3>
        {closedRows.length === 0 ? (
          <p className="empty muted-text">{dash.noRows}</p>
        ) : (
          <div className="team-dash-event-list">{closedRows.map((r) => renderCard(r, 'closed'))}</div>
        )}
      </section>
    </section>
  );
}

export function SupervisorDashboardPage({
  event,
  stats,
  rows,
  departments: deptList,
  filter,
  setFilter,
  searchText,
  setSearchText,
  onSendReminder,
  onExport,
  onBackToEvents,
  contactedMap,
  onToggleContacted,
  pendingRatioHigh,
  dashMismatchHint,
  dashboardFreshAt,
  hideBulkTeamActions = false,
  showDepartmentTabs = false,
  departmentFilter = 'all',
  setDepartmentFilter,
  departmentOptions = [],
  showToast,
}: {
  event: EventItem | null;
  stats: { total: number; safe: number; needHelp: number; pending: number; responseRate: number };
  rows: AdminPersonRow[];
  departments: Department[];
  filter: 'all' | 'safe' | 'need_help' | 'pending';
  setFilter: (value: 'all' | 'safe' | 'need_help' | 'pending') => void;
  searchText: string;
  setSearchText: (value: string) => void;
  onSendReminder: () => void;
  onExport: () => void;
  onBackToEvents: () => void;
  contactedMap: Record<string, boolean>;
  onToggleContacted: (userId: string) => void;
  pendingRatioHigh: boolean;
  dashMismatchHint: string | null;
  dashboardFreshAt: number | null;
  hideBulkTeamActions?: boolean;
  showDepartmentTabs?: boolean;
  departmentFilter?: string;
  setDepartmentFilter?: (value: string) => void;
  departmentOptions?: string[];
  showToast: (t: ToastState) => void;
}) {
  const { locale } = useLocale();
  const { dash, portal: portalStrings } = getStrings(locale);
  const [detailTab, setDetailTab] = useState<'overview' | 'tracking' | 'departments'>('overview');
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [pendingListOpen, setPendingListOpen] = useState(false);

  const filtered = rows
    .filter((row) => (filter === 'all' ? true : row.status === filter))
    .filter((row) => row.name.toLowerCase().includes(searchText.toLowerCase()))
    .sort((a, b) => (a.status === 'need_help' ? -1 : 1) - (b.status === 'need_help' ? -1 : 1));
  const urgentRows = rows.filter((row) => row.status === 'need_help');
  const urgentUncontacted = urgentRows.filter((row) => !contactedMap[row.id]);
  const pendingRows = rows.filter((row) => row.status === 'pending');
  const tableRows = filtered;

  const eventTitle = event ? stripRedundantStatusFromTitle(event.title) : '—';
  const typeDisplay = event ? formatAdminEventTypeLabel(event.type, portalStrings) : '—';
  const updatedLine = dashboardFreshAt
    ? new Date(dashboardFreshAt).toLocaleString(locale === 'en' ? 'en-US' : 'zh-TW')
    : null;
  const createdSource = event?.startAt ?? event?.createdAt ?? null;
  const createdLine = formatEmployeeCardTime(createdSource, locale);
  const viewScopeLine = formatSupervisorViewScope(departmentFilter, departmentOptions, dash);
  const syncedLine = updatedLine ?? '—';

  const deptAggSorted = useMemo((): DeptAgg[] => {
    const names = new Set(rows.map((r) => r.department).filter((d) => d && d !== '-'));
    const copy = [...names].map((department) => {
      const dr = rows.filter((r) => r.department === department);
      return {
        department,
        safe: dr.filter((r) => r.status === 'safe').length,
        need_help: dr.filter((r) => r.status === 'need_help').length,
        pending: dr.filter((r) => r.status === 'pending').length,
      };
    });
    copy.sort((a, b) => {
      if (b.need_help !== a.need_help) return b.need_help - a.need_help;
      if (b.pending !== a.pending) return b.pending - a.pending;
      return adminDeptResponseRate(a) - adminDeptResponseRate(b);
    });
    return copy;
  }, [rows]);

  const overviewDeptRows = useMemo(() => {
    if (!selectedDepartment) return deptAggSorted;
    return deptAggSorted.filter((r) => r.department === selectedDepartment);
  }, [deptAggSorted, selectedDepartment]);

  const personnelSorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const rank = (s: AdminPersonRow['status']) => (s === 'need_help' ? 0 : s === 'pending' ? 1 : 2);
      const d = rank(a.status) - rank(b.status);
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });
    return copy;
  }, [rows]);

  const tabIds = {
    overview: 'supervisor-tab-panel-overview',
    tracking: 'supervisor-tab-panel-tracking',
    departments: 'supervisor-tab-panel-departments',
  } as const;

  const filterTabs: Array<{ key: typeof filter; label: string }> = [
    { key: 'all', label: dash.filterAll },
    { key: 'need_help', label: dash.filterNeedHelp },
    { key: 'pending', label: dash.filterPending },
    { key: 'safe', label: dash.filterSafe },
  ];

  const rosterToolbar = (
    <div className="dash-toolbar toolbar">
      <div className="tabs">
        {filterTabs.map(({ key, label }) => (
          <button key={key} className={filter === key ? 'pill active' : 'pill'} onClick={() => setFilter(key)} type="button">
            {label}
          </button>
        ))}
      </div>
      <input placeholder={dash.searchPlaceholder} value={searchText} onChange={(e) => setSearchText(e.target.value)} />
    </div>
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
    <>
      {rosterToolbar}
      <section className="dash-panel-elevated sv-roster-panel">
        <p className="sv-roster-footnote">{dash.employeeTableFootnote(tableRows.length, rows.length)}</p>
        <SupervisorEmployeeCardList rows={tableRows} dash={dash} showToast={showToast} />
      </section>
    </>
  );

  const overviewTab = (
    <div id={tabIds.overview} role="tabpanel" aria-labelledby="supervisor-tab-trigger-overview">
      {statsReportSummary}
      {showDepartmentTabs ? (
        <section className="dash-panel-elevated admin-dept-status-section">
          <h3 className="dash-subsection-title">{dash.adminDeptReportStatusTitle}</h3>
          {overviewDeptRows.length === 0 ? (
            <p className="empty">{dash.noRows}</p>
          ) : (
            <AdminDeptStatusList
              rows={overviewDeptRows}
              dash={dash}
              onViewDepartment={(department) => {
                setSelectedDepartment(department);
                setDetailTab('departments');
              }}
            />
          )}
        </section>
      ) : (
        rosterBlock
      )}
    </div>
  );

  const trackingTab = (
    <div id={tabIds.tracking} role="tabpanel" aria-labelledby="supervisor-tab-trigger-tracking">
      <div className="admin-tracking-layout">
        <div className="admin-tracking-lists">
          <section className="dash-panel-elevated">
            <h3 className="dash-subsection-title">
              {dash.trackingNeedHelpSection}（{urgentRows.length}）
            </h3>
            <p className="muted-text small">{dash.trackingNeedHelpIntro}</p>
            {urgentRows.length === 0 ? (
              <p className="empty">{dash.noRows}</p>
            ) : (
              urgentRows.map((row) => {
                const reached = contactedMap[row.id] ?? false;
                const tel = row.phone?.replace(/\s/g, '') ?? '';
                return (
                  <article key={row.id} className="list-item dash-need-row-slim dash-admin-tracking-card">
                    <div className="dash-need-slim-main">
                      <strong className="dash-need-slim-name">{row.name}</strong>
                      <span className="muted-text dash-need-slim-dept">{row.department}</span>
                      <span className="dash-need-slim-phone">
                        {dash.phoneLabel}：
                        {row.phone ? (
                          <a href={tel ? `tel:${tel}` : undefined}>{row.phone}</a>
                        ) : (
                          <span className="muted-text">{dash.noPhone}</span>
                        )}
                      </span>
                      {row.note || row.locationLine ? (
                        <span className="muted-text small">{[row.locationLine, row.note].filter(Boolean).join(' · ')}</span>
                      ) : null}
                    </div>
                    <div className="admin-tracking-card-aside">
                      <StatusBadge status="need_help" />
                      <button
                        type="button"
                        className={`btn ghost btn-sm supervisor-contact-flag${reached ? ' is-reached' : ''}`}
                        onClick={() => onToggleContacted(row.id)}
                      >
                        {reached ? dash.contacted : dash.markContacted}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
            {urgentUncontacted.length > 5 ? (
              <p className="supervisor-many-alert" role="alert">
                {dash.manyUncontacted(urgentUncontacted.length)}
              </p>
            ) : null}
          </section>
          <section className="dash-panel-elevated">
            <h3 className="dash-subsection-title">
              {dash.trackingPendingSection}（{pendingRows.length}）
            </h3>
            <p className="muted-text small">{dash.trackingPendingIntro}</p>
            {pendingRows.length === 0 ? (
              <p className="empty">{dash.trackingPendingEmptyTitle}</p>
            ) : (
              pendingRows.map((row) => (
                <article key={row.id} className="list-item dash-admin-tracking-card admin-tracking-pending-card">
                  <div>
                    <strong>{row.name}</strong>
                    <p className="muted-text">{row.department}</p>
                  </div>
                  <StatusBadge status="pending" />
                </article>
              ))
            )}
            <div className="row-actions">
              {!hideBulkTeamActions ? (
                <>
                  <button className="btn warning" onClick={onSendReminder} type="button">
                    {dash.sendReminder}
                  </button>
                  <button className="btn ghost" onClick={onExport} type="button">
                    {dash.export}
                  </button>
                </>
              ) : (
                <p className="muted-text small">{dash.teamActionsNote}</p>
              )}
            </div>
          </section>
        </div>
      </div>
      {showDepartmentTabs ? rosterBlock : null}
    </div>
  );

  const departmentsTab = (
    <div id={tabIds.departments} role="tabpanel" aria-labelledby="supervisor-tab-trigger-departments">
      {!selectedDepartment ? (
        <section className="dash-panel-elevated admin-dept-list-shell">
          <header className="admin-dept-tab-heading">
            <h3 className="dash-subsection-title">{dash.adminDeptSituationHeading}</h3>
            <p className="muted-text small">{dash.adminDeptSituationSortHint}</p>
          </header>
          {deptAggSorted.length === 0 ? (
            <p className="empty">{dash.noRows}</p>
          ) : (
            <AdminDeptStatusList
              rows={deptAggSorted}
              dash={dash}
              onViewDepartment={(department) => setSelectedDepartment(department)}
            />
          )}
        </section>
      ) : (
        <div className="admin-dept-detail-wrap">
          <PageBackButton
            onClick={() => setSelectedDepartment(null)}
            ariaLabel={portalStrings.userMgmtBackToDepts}
            className="supervisor-dept-back"
          />
          <h3 className="dash-subsection-title admin-dept-scope-title">{selectedDepartment}</h3>
          {statsReportSummary}
          <section className="dash-panel-elevated">
            <h3 className="dash-subsection-title">{dash.adminDeptPersonnelHeading}</h3>
            {personnelSorted.filter((r) => r.department === selectedDepartment).length === 0 ? (
              <p className="empty">{dash.noRows}</p>
            ) : (
              personnelSorted
                .filter((r) => r.department === selectedDepartment)
                .map((row) => (
                  <div className="list-item admin-dept-person-row" key={row.id}>
                    <div>
                      <strong>{row.name}</strong>
                      <p className="muted-text small">
                        {row.status === 'pending'
                          ? dash.filterPending
                          : row.status === 'need_help'
                            ? dash.filterNeedHelp
                            : dash.filterSafe}
                      </p>
                    </div>
                    <StatusBadge
                      status={row.status === 'need_help' ? 'need_help' : row.status === 'pending' ? 'pending' : 'safe'}
                    />
                  </div>
                ))
            )}
          </section>
        </div>
      )}
    </div>
  );

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
          {viewScopeLine}
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

      <div className="admin-event-detail-tabs admin-event-center-toolbar supervisor-event-detail-tabs" role="tablist">
        <button
          id="supervisor-tab-trigger-overview"
          type="button"
          role="tab"
          aria-selected={detailTab === 'overview'}
          aria-controls={tabIds.overview}
          className={`event-filter-chip${detailTab === 'overview' ? ' is-active' : ''}`}
          onClick={() => setDetailTab('overview')}
        >
          <span className="admin-tab-label-long">{dash.tabOverview}</span>
          <span className="admin-tab-label-short">{dash.tabOverviewShort}</span>
        </button>
        <button
          id="supervisor-tab-trigger-tracking"
          type="button"
          role="tab"
          aria-selected={detailTab === 'tracking'}
          aria-controls={tabIds.tracking}
          className={`event-filter-chip${detailTab === 'tracking' ? ' is-active' : ''}`}
          onClick={() => setDetailTab('tracking')}
        >
          <span className="admin-tab-label-long">{dash.tabTracking}</span>
          <span className="admin-tab-label-short">{dash.tabTrackingShort}</span>
        </button>
        {showDepartmentTabs ? (
          <button
            id="supervisor-tab-trigger-departments"
            type="button"
            role="tab"
            aria-selected={detailTab === 'departments'}
            aria-controls={tabIds.departments}
            className={`event-filter-chip${detailTab === 'departments' ? ' is-active' : ''}`}
            onClick={() => setDetailTab('departments')}
          >
            <span className="admin-tab-label-long">{dash.tabDepartments}</span>
            <span className="admin-tab-label-short">{dash.tabDepartmentsShort}</span>
          </button>
        ) : null}
      </div>

      {showDepartmentTabs && departmentOptions.length > 1 ? (
        <div className="dash-panel-elevated admin-event-detail-scope-bar supervisor-event-detail-scope-bar">
          <p className="admin-event-detail-scope-heading">{dash.adminScopeCurrentRangeHeading}</p>
          <div className="supervisor-dept-filter-row event-filter-chips" role="group" aria-label={portalStrings.userMgmtDeptLabel}>
            <button
              type="button"
              className={`event-filter-chip${departmentFilter === 'all' ? ' is-active' : ''}`}
              onClick={() => setDepartmentFilter?.('all')}
            >
              {portalStrings.supervisorDeptFilterAll}
            </button>
            {departmentOptions.map((dept) => (
              <button
                key={dept}
                type="button"
                className={`event-filter-chip${departmentFilter === dept ? ' is-active' : ''}`}
                onClick={() => setDepartmentFilter?.(dept)}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="admin-detail-tab-panels">
        {detailTab === 'overview' ? overviewTab : null}
        {detailTab === 'tracking' ? trackingTab : null}
        {showDepartmentTabs && detailTab === 'departments' ? departmentsTab : null}
      </div>

      {pendingListOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingListOpen(false);
          }}
        >
          <div className="modal sv-pending-list-modal" role="dialog" aria-modal="true" aria-labelledby="sv-pending-list-title">
            <h3 id="sv-pending-list-title">{dash.supervisorPendingListTitle}</h3>
            {pendingRows.length === 0 ? (
              <p className="empty">{dash.noRows}</p>
            ) : (
              <ul className="sv-pending-list">
                {pendingRows.map((row) => (
                  <li key={row.id}>
                    <strong>{row.name}</strong>
                    <span className="muted-text">{row.department}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="modal-actions">
              <button type="button" className="btn primary" onClick={() => setPendingListOpen(false)}>
                {dash.supervisorContactClose}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function AdminDashboardPage({
  event,
  stats,
  rows,
  departments: deptList,
  deptBreakdown,
  dashboardFreshAt,
  dashMismatchHint,
  onBackToEvents,
  selectedDepartment,
  onSelectDepartment,
  deptRankingSourceRows,
  onCloseEvent,
  closingEventId,
}: {
  event: EventItem | null;
  stats: { total: number; safe: number; needHelp: number; pending: number; responseRate: number };
  rows: AdminPersonRow[];
  departments: Department[];
  deptBreakdown?: Array<{ department: string; safe: number; need_help: number; pending: number }>;
  dashboardFreshAt: number | null;
  dashMismatchHint: string | null;
  onBackToEvents: () => void;
  selectedDepartment: string | null;
  onSelectDepartment: (departmentName: string | null) => void;
  deptRankingSourceRows?: AdminPersonRow[];
  onCloseEvent?: (eventId: string) => void | Promise<void>;
  closingEventId?: string | null;
}) {
  const { locale } = useLocale();
  const { dash, portal: portalStrings } = getStrings(locale);

  const [detailTab, setDetailTab] = useState<'overview' | 'tracking' | 'departments'>('overview');
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeSubmitting, setCloseSubmitting] = useState(false);

  const rankingRows = deptRankingSourceRows ?? rows;
  const critical = rows.filter((row) => row.status === 'need_help');
  const pendingRows = rows.filter((row) => row.status === 'pending');

  const eventTitle = event ? stripRedundantStatusFromTitle(event.title) : '—';
  const typeDisplay = event ? formatAdminEventTypeLabel(event.type, portalStrings) : '—';
  const impactScopeLabel = event ? formatEventImpactScope(event, deptList, portalStrings) : '—';
  const updatedLine = dashboardFreshAt
    ? new Date(dashboardFreshAt).toLocaleString(locale === 'en' ? 'en-US' : 'zh-TW')
    : null;

  const deptAggBase = useMemo((): DeptAgg[] => {
    if (deptBreakdown?.length) {
      return deptBreakdown.map((row) => ({
        department: row.department,
        safe: row.safe,
        need_help: row.need_help,
        pending: row.pending,
      }));
    }
    return [...deptList]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((dept) => {
        const dr = rankingRows.filter((r) => r.department === dept.name);
        return {
          department: dept.name,
          safe: dr.filter((r) => r.status === 'safe').length,
          need_help: dr.filter((r) => r.status === 'need_help').length,
          pending: dr.filter((r) => r.status === 'pending').length,
        };
      });
  }, [deptBreakdown, deptList, rankingRows]);

  const deptAggSorted = useMemo(() => {
    const copy = [...deptAggBase];
    copy.sort((a, b) => {
      if (b.need_help !== a.need_help) return b.need_help - a.need_help;
      if (b.pending !== a.pending) return b.pending - a.pending;
      return adminDeptResponseRate(a) - adminDeptResponseRate(b);
    });
    return copy;
  }, [deptAggBase]);

  const overviewDeptRows = useMemo(() => {
    if (!selectedDepartment) return deptAggSorted;
    return deptAggSorted.filter((r) => r.department === selectedDepartment);
  }, [deptAggSorted, selectedDepartment]);

  const personnelSorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const rank = (s: AdminPersonRow['status']) => (s === 'need_help' ? 0 : s === 'pending' ? 1 : 2);
      const d = rank(a.status) - rank(b.status);
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });
    return copy;
  }, [rows]);

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

  const tabIds = {
    overview: 'admin-tab-panel-overview',
    tracking: 'admin-tab-panel-tracking',
    departments: 'admin-tab-panel-departments',
  } as const;

  const progressTone = stats.responseRate >= 70 ? 'is-high' : 'is-mid';
  const progressBarWidth = stats.total > 0 ? Math.min(100, stats.responseRate) : 0;

  const adminStatsProgressHero = (
    <div className="dash-panel-elevated admin-event-detail-progress-card">
      <div className="admin-event-center-progress-head admin-event-detail-progress-head">
        <span className="admin-event-detail-progress-rate">{dash.adminDetailReportRateLine(stats.responseRate)}</span>
      </div>
      <p className="muted-text admin-event-detail-progress-sub">
        {dash.adminDetailCompletedRatio(stats.safe + stats.needHelp, stats.total)}
      </p>
      <div className={`admin-event-center-progress-track ${progressTone}`}>
        <div className="admin-event-center-progress-fill" style={{ width: `${progressBarWidth}%` }} />
      </div>
    </div>
  );

  const kpiStrip = (
    <div className="admin-kpi-strip" aria-label={dash.globalOverview}>
      <div className="admin-kpi-card admin-kpi-card--danger">
        <span className="admin-kpi-card-label">{dash.kpiNeedHelp}</span>
        <strong className="admin-kpi-card-value">{stats.needHelp}</strong>
      </div>
      <div className="admin-kpi-card admin-kpi-card--warning">
        <span className="admin-kpi-card-label">{dash.kpiNoResponse}</span>
        <strong className="admin-kpi-card-value">{stats.pending}</strong>
      </div>
      <div className="admin-kpi-card admin-kpi-card--safe">
        <span className="admin-kpi-card-label">{dash.kpiSafe}</span>
        <strong className="admin-kpi-card-value">{stats.safe}</strong>
      </div>
      <div className="admin-kpi-card admin-kpi-card--neutral">
        <span className="admin-kpi-card-label">{dash.kpiTotal}</span>
        <strong className="admin-kpi-card-value">{stats.total}</strong>
      </div>
    </div>
  );

  const renderNeedHelpCard = (row: AdminPersonRow) => {
    const tel = row.phone?.replace(/\s/g, '') ?? '';
    return (
      <article key={row.id} className="list-item dash-need-row-slim dash-admin-tracking-card">
        <div className="dash-need-slim-main">
          <strong className="dash-need-slim-name">{row.name}</strong>
          <span className="muted-text dash-need-slim-dept">{row.department}</span>
          <span className="dash-need-slim-phone">
            {dash.phoneLabel}：
            {row.phone ? (
              <a href={tel ? `tel:${tel}` : undefined}>{row.phone}</a>
            ) : (
              <span className="muted-text">{dash.noPhone}</span>
            )}
          </span>
          <span className="muted-text small">
            {dash.adminReportedAt}：{formatAdminReportTime(row.updatedAt, locale)}
          </span>
          {row.note || row.locationLine ? (
            <span className="muted-text small">{[row.locationLine, row.note].filter(Boolean).join(' · ')}</span>
          ) : null}
        </div>
        <div className="admin-tracking-card-aside">
          <StatusBadge status="need_help" />
          <span className="muted-text admin-view-detail-muted">{dash.adminViewDetail}</span>
        </div>
      </article>
    );
  };

  const renderPendingCard = (row: AdminPersonRow) => (
    <article key={row.id} className="list-item dash-admin-tracking-card admin-tracking-pending-card">
      <div>
        <strong>{row.name}</strong>
        <p className="muted-text">{row.department}</p>
      </div>
      <StatusBadge status="pending" />
    </article>
  );

  const overviewTab = (
    <div id={tabIds.overview} role="tabpanel" aria-labelledby="admin-tab-trigger-overview">
      {adminStatsProgressHero}
      {kpiStrip}
      <div className="dash-panel-elevated dash-dist-panel admin-event-detail-dist-panel">
        <h3 className="dash-subsection-title">{dash.distribution}</h3>
        <ResponseDistributionBar
          compact
          strings={dash}
          safe={stats.safe}
          needHelp={stats.needHelp}
          pending={stats.pending}
        />
      </div>
      <section className="dash-panel-elevated admin-dept-status-section">
        <h3 className="dash-subsection-title">{dash.adminDeptReportStatusTitle}</h3>
        {overviewDeptRows.length === 0 ? (
          <p className="empty">{dash.noRows}</p>
        ) : (
          <AdminDeptStatusList
            rows={overviewDeptRows}
            dash={dash}
            onViewDepartment={(department) => {
              onSelectDepartment(department);
              setDetailTab('departments');
            }}
          />
        )}
      </section>
    </div>
  );

  const trackingTab = (
    <div id={tabIds.tracking} role="tabpanel" aria-labelledby="admin-tab-trigger-tracking">
      <div className="admin-tracking-layout">
        <div className="admin-tracking-lists">
          <section className="dash-panel-elevated">
            <h3 className="dash-subsection-title">
              {dash.trackingNeedHelpSection}（{critical.length}）
            </h3>
            <p className="muted-text small">{dash.trackingNeedHelpIntro}</p>
            {critical.length === 0 ? <p className="empty">{dash.noRows}</p> : critical.map(renderNeedHelpCard)}
          </section>
          <section className="dash-panel-elevated">
            <h3 className="dash-subsection-title">
              {dash.trackingPendingSection}（{pendingRows.length}）
            </h3>
            <p className="muted-text small">{dash.trackingPendingIntro}</p>
            {pendingRows.length === 0 ? (
              <div className="admin-tracking-pending-empty">
                <p className="admin-tracking-empty-lead">{dash.trackingPendingEmptyTitle}</p>
                <p className="muted-text small">{dash.trackingPendingEmptyBody}</p>
              </div>
            ) : (
              pendingRows.map(renderPendingCard)
            )}
          </section>
        </div>
        <section className="map-placeholder dash-map-placeholder admin-tracking-map">{dash.mapPlaceholder}</section>
      </div>
    </div>
  );

  const departmentsTab = (
    <div id={tabIds.departments} role="tabpanel" aria-labelledby="admin-tab-trigger-departments">
      {!selectedDepartment ? (
        <section className="dash-panel-elevated admin-dept-list-shell">
          <header className="admin-dept-tab-heading">
            <h3 className="dash-subsection-title">{dash.adminDeptSituationHeading}</h3>
            <p className="muted-text small">{dash.adminDeptSituationSortHint}</p>
          </header>
          {deptAggSorted.length === 0 ? (
            <p className="empty">{dash.noRows}</p>
          ) : (
            <AdminDeptStatusList rows={deptAggSorted} dash={dash} onViewDepartment={onSelectDepartment} />
          )}
        </section>
      ) : (
        <div className="admin-dept-detail-wrap">
          <h3 className="dash-subsection-title admin-dept-scope-title">{selectedDepartment}</h3>
          {adminStatsProgressHero}
          {kpiStrip}
          <section className="dash-panel-elevated">
            <h3 className="dash-subsection-title">{dash.adminDeptPersonnelHeading}</h3>
            {personnelSorted.length === 0 ? (
              <p className="empty">{dash.noRows}</p>
            ) : (
              personnelSorted.map((row) => (
                <div className="list-item admin-dept-person-row" key={row.id}>
                  <div>
                    <strong>{row.name}</strong>
                    <span className="muted-text"> · {row.department}</span>
                    <p className="muted-text small">
                      {row.status === 'pending'
                        ? dash.filterPending
                        : row.status === 'need_help'
                          ? dash.filterNeedHelp
                          : dash.filterSafe}
                      {row.status !== 'pending' && row.updatedAt
                        ? ` · ${dash.adminReportedAt} ${formatAdminReportTime(row.updatedAt, locale)}`
                        : null}
                    </p>
                  </div>
                  <StatusBadge
                    status={row.status === 'need_help' ? 'need_help' : row.status === 'pending' ? 'pending' : 'safe'}
                  />
                </div>
              ))
            )}
          </section>
        </div>
      )}
    </div>
  );

  if (!event) {
    return (
      <section className="page-section dash-board-surface admin-dash-page">
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

  const outstandingClose = stats.needHelp > 0 || stats.pending > 0;

  return (
    <section className="page-section dash-board-surface admin-dash-page admin-event-detail-root">
      <DashboardShellHeader
        brandName={dash.brand}
        backLabel={dash.backToEvents}
        onBack={onBackToEvents}
        lastSyncedFormatted={formatSynced(dash, dashboardFreshAt, locale)}
        syncOk
      />

      <article className="dash-panel-elevated admin-event-header-card">
        <div className="admin-event-header-top">
          <div className="admin-event-header-main admin-event-detail-header-main">
            <p className="muted-text admin-event-type-line admin-event-detail-desktop-only">
              {typeDisplay} · {impactScopeLabel}
              {updatedLine ? (
                <>
                  {' '}
                  · {dash.asOf} {updatedLine}
                </>
              ) : null}
            </p>
            <div className="admin-event-title-row admin-event-detail-title-cluster">
              <h1 className="admin-event-detail-title">{eventTitle}</h1>
              <span
                className={`admin-event-center-status-pill admin-event-detail-status-desktop admin-event-detail-desktop-only admin-event-center-status-pill--${event.status === 'closed' ? 'closed' : 'active'}`}
              >
                {event.status === 'closed' ? dash.closed : dash.ongoing}
              </span>
            </div>
            <p className="muted-text admin-event-detail-meta-mobile-line admin-event-detail-mobile-only">
              <span
                className={`admin-event-center-status-pill admin-event-center-status-pill--${event.status === 'closed' ? 'closed' : 'active'}`}
              >
                {event.status === 'closed' ? dash.closed : dash.ongoing}
              </span>
              {' · '}
              {typeDisplay}
            </p>
            {updatedLine ? (
              <p className="muted-text admin-event-detail-meta-mobile-time admin-event-detail-mobile-only">
                {dash.asOf} {updatedLine}
              </p>
            ) : null}
          </div>
          {event.status === 'active' && onCloseEvent ? (
            <div className="admin-event-header-aside-desktop admin-event-detail-close-aside">
              <button
                type="button"
                className="btn admin-btn-end-event-outline"
                onClick={openCloseModal}
                disabled={closingEventId === event.id}
              >
                {dash.adminCloseEventOutlineLabel}
              </button>
            </div>
          ) : null}
        </div>
      </article>

      {dashMismatchHint ? <p className="dash-scope-hint muted-text">{dashMismatchHint}</p> : null}

      <div className="admin-event-detail-tabs admin-event-center-toolbar" role="tablist" aria-label={dash.adminTitle}>
        <button
          id="admin-tab-trigger-overview"
          type="button"
          role="tab"
          aria-selected={detailTab === 'overview'}
          aria-controls={tabIds.overview}
          className={`event-filter-chip${detailTab === 'overview' ? ' is-active' : ''}`}
          onClick={() => setDetailTab('overview')}
        >
          <span className="admin-tab-label-long">{dash.tabOverview}</span>
          <span className="admin-tab-label-short">{dash.tabOverviewShort}</span>
        </button>
        <button
          id="admin-tab-trigger-tracking"
          type="button"
          role="tab"
          aria-selected={detailTab === 'tracking'}
          aria-controls={tabIds.tracking}
          className={`event-filter-chip${detailTab === 'tracking' ? ' is-active' : ''}`}
          onClick={() => setDetailTab('tracking')}
        >
          <span className="admin-tab-label-long">{dash.tabTracking}</span>
          <span className="admin-tab-label-short">{dash.tabTrackingShort}</span>
        </button>
        <button
          id="admin-tab-trigger-departments"
          type="button"
          role="tab"
          aria-selected={detailTab === 'departments'}
          aria-controls={tabIds.departments}
          className={`event-filter-chip${detailTab === 'departments' ? ' is-active' : ''}`}
          onClick={() => setDetailTab('departments')}
        >
          <span className="admin-tab-label-long">{dash.tabDepartments}</span>
          <span className="admin-tab-label-short">{dash.tabDepartmentsShort}</span>
        </button>
      </div>

      <div className="dash-panel-elevated admin-event-detail-scope-bar">
        <div className="admin-event-detail-scope-bar-inner">
          <p className="admin-event-detail-scope-heading">{dash.adminScopeCurrentRangeHeading}</p>
          <div className="admin-event-detail-scope-row">
            <button
              type="button"
              className={`event-filter-chip admin-scope-all-chip${selectedDepartment == null ? ' is-active' : ''}${selectedDepartment != null ? ' admin-scope-all-chip--muted' : ''}`}
              onClick={() => onSelectDepartment(null)}
            >
              <span className="admin-scope-chip-label-long">{dash.adminScopeChipAllDepartments}</span>
              <span className="admin-scope-chip-label-short">{dash.adminScopeChipAllDepartmentsShort}</span>
            </button>
            <select
              className={`admin-scope-select admin-event-detail-scope-select${selectedDepartment ? ' admin-event-detail-scope-select--filled' : ' admin-event-detail-scope-select--idle'}`}
              aria-label={dash.adminScopeSelectDepartmentPlaceholder}
              value={selectedDepartment ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                onSelectDepartment(v === '' ? null : v);
              }}
            >
            <option value="">{dash.adminScopeSelectDepartmentPlaceholder}</option>
            {[...deptList]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedDepartment ? (
          <p className="muted-text small admin-scope-employees-hint">
            <span className="admin-scope-hint-long">{dash.adminScopeEmployeesOnlyHint(selectedDepartment)}</span>
            <span className="admin-scope-hint-short">{dash.adminScopeEmployeesOnlyHintShort}</span>
          </p>
        ) : null}
      </div>

      <div className="admin-detail-tab-panels">
        {detailTab === 'overview' ? overviewTab : null}
        {detailTab === 'tracking' ? trackingTab : null}
        {detailTab === 'departments' ? departmentsTab : null}
      </div>

      {closeModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCloseModalOpen(false);
          }}
        >
          <div className="modal admin-close-event-modal" role="dialog" aria-modal="true" aria-labelledby="admin-close-event-title">
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
                disabled={closeSubmitting || closingEventId === event.id}
              >
                {dash.adminCloseEventCancel}
              </button>
              <button
                type="button"
                className="btn admin-btn-end-event-outline"
                onClick={() => void handleConfirmClose()}
                disabled={closeSubmitting || closingEventId === event.id}
              >
                {closingEventId === event.id
                  ? '…'
                  : outstandingClose
                    ? dash.adminCloseEventConfirmAnyway
                    : dash.adminCloseEventConfirmOk}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
