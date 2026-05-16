import { useMemo, useState } from 'react';
import { Activity, ChevronRight } from 'lucide-react';
import { EmployeeTable } from '../../components/EmployeeTable';
import { StatusBadge } from '../../components/StatusBadge';
import { DashboardShellHeader } from '../../components/dashboard/DashboardShellHeader';
import { EventOverviewCard } from '../../components/dashboard/EventOverviewCard';
import { DashboardAnalyticsHero } from '../../components/dashboard/DashboardAnalyticsHero';
import { ResponseDistributionBar } from '../../components/dashboard/ResponseDistributionBar';
import { deriveEventUiStatus } from '../../components/dashboard/deriveEventUiStatus';
import type { DashboardStrings } from '../../locale/strings';
import { getStrings } from '../../locale/strings';
import { useLocale } from '../../locale/LocaleContext';
import {
  formatAdminEventTypeLabel,
  formatEventImpactScope,
  stripRedundantStatusFromTitle,
} from '../../lib/adminEventDisplay';
import type { Department, EventItem } from '../../types';

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
  updatedAt?: string;
  locationLine?: string;
};

type DeptAgg = { department: string; safe: number; need_help: number; pending: number };

function adminDeptResponseRate(row: DeptAgg): number {
  const t = row.safe + row.need_help + row.pending;
  return t ? Math.round(((row.safe + row.need_help) / t) * 100) : 0;
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
}: {
  event: EventItem | null;
  stats: { total: number; safe: number; needHelp: number; pending: number; responseRate: number };
  rows: Array<{
    id: string;
    name: string;
    department: string;
    status: 'safe' | 'need_help' | 'pending';
    updatedAt?: string;
    note?: string;
    phone?: string;
    locationLine?: string;
  }>;
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
}) {
  const { locale } = useLocale();
  const { dash } = getStrings(locale);

  const filtered = rows
    .filter((row) => (filter === 'all' ? true : row.status === filter))
    .filter((row) => row.name.toLowerCase().includes(searchText.toLowerCase()))
    .sort((a, b) => (a.status === 'need_help' ? -1 : 1) - (b.status === 'need_help' ? -1 : 1));
  const urgentRows = rows.filter((row) => row.status === 'need_help');
  const urgentUncontacted = urgentRows.filter((row) => !contactedMap[row.id]);
  const pendingRows = rows.filter((row) => row.status === 'pending');
  const tableRows = filtered;

  const uiStatus = deriveEventUiStatus(event, {
    total: stats.total,
    safe: stats.safe,
    needHelp: stats.needHelp,
    pending: stats.pending,
  });
  const statusLabel = dash.statusLabels[uiStatus];
  const eventTitle = event?.title ?? '—';
  const typeLabel = event?.type ?? '—';
  const description = event?.description?.trim() || dash.eventDescriptionFallback;
  const updatedLine = dashboardFreshAt
    ? new Date(dashboardFreshAt).toLocaleString(locale === 'en' ? 'en-US' : 'zh-TW')
    : null;

  const filterTabs: Array<{ key: typeof filter; label: string }> = [
    { key: 'all', label: dash.filterAll },
    { key: 'need_help', label: dash.filterNeedHelp },
    { key: 'pending', label: dash.filterPending },
    { key: 'safe', label: dash.filterSafe },
  ];

  return (
    <section className="page-section dash-board-surface supervisor-dash-page">
      <DashboardShellHeader
        brandName={dash.brand}
        backLabel={dash.backToEvents}
        onBack={onBackToEvents}
        lastSyncedFormatted={formatSynced(dash, dashboardFreshAt, locale)}
        syncOk
      />

      <div className="dash-page-heading">
        <h1>{dash.supervisorTitle}</h1>
        <p className="muted-text">{dash.supervisorSubtitle}</p>
      </div>

      {dashMismatchHint ? <p className="dash-scope-hint muted-text">{dashMismatchHint}</p> : null}
      {pendingRatioHigh ? (
        <p className="supervisor-priority-alert" role="status">
          {dash.highPendingWarn}
        </p>
      ) : null}
      <EventOverviewCard
        icon={<Activity size={26} />}
        typeLabel={typeLabel}
        title={eventTitle}
        uiStatus={uiStatus}
        statusLabel={statusLabel}
        description={description}
        lastUpdatedFormatted={updatedLine ? `${dash.asOf} ${updatedLine}` : null}
      />

      <div className="dash-panel-elevated dash-hero-wrap">
        <DashboardAnalyticsHero
          responseRate={stats.responseRate}
          safe={stats.safe}
          needHelp={stats.needHelp}
          pending={stats.pending}
          total={stats.total}
          rateLabel={dash.responseRateCenter}
          strings={dash}
        />
      </div>

      <div className="dash-panel-elevated dash-dist-panel">
        <h3 className="dash-subsection-title">{dash.distribution}</h3>
        <ResponseDistributionBar strings={dash} safe={stats.safe} needHelp={stats.needHelp} pending={stats.pending} />
      </div>

      <div className="grid-2 dash-need-grid">
        <section className="dash-panel-elevated supervisor-need-help-panel">
          <h3 className="dash-subsection-title">{dash.immediateAttention}</h3>
          {urgentRows.length === 0 ? (
            <p className="empty">{dash.noRows}</p>
          ) : (
            urgentRows.map((row) => {
              const reached = contactedMap[row.id] ?? false;
              const tel = row.phone?.replace(/\s/g, '') ?? '';
              return (
                <article key={row.id} className="list-item supervisor-need-item dash-need-row-slim">
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
                      <span className="dash-need-slim-extra muted-text">{[row.locationLine, row.note].filter(Boolean).join(' · ')}</span>
                    ) : null}
                  </div>
                  <div className="dash-need-slim-aside">
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
          <h3 className="dash-subsection-title">{dash.pendingFollowUp}</h3>
          {pendingRows.length === 0 ? (
            <p className="empty">{dash.allRespondedNote}</p>
          ) : (
            pendingRows.map((row) => (
              <article key={row.id} className="list-item">
                <div>
                  <strong>{row.name}</strong>
                  <p>{row.department}</p>
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

      <div className="dash-panel-plain">
        <h3 className="dash-subsection-title">{dash.detailedList}</h3>
        <p className="muted-text dash-table-foot">{dash.employeeTableFootnote(tableRows.length, rows.length)}</p>
        {tableRows.length === 0 ? <p className="empty">{dash.noRows}</p> : <EmployeeTable rows={tableRows} />}
      </div>
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
          <>
            <div className="admin-dept-table-desktop">
              <table className="admin-dept-status-table">
                <thead>
                  <tr>
                    <th scope="col">{dash.adminDeptColDept}</th>
                    <th scope="col">{dash.adminDeptColRate}</th>
                    <th scope="col">{dash.adminDeptColSafe}</th>
                    <th scope="col">{dash.adminDeptColNeed}</th>
                    <th scope="col">{dash.adminDeptColPending}</th>
                    <th scope="col">
                      <span className="sr-only">{dash.adminDeptActionView}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overviewDeptRows.map((row) => {
                    const rate = adminDeptResponseRate(row);
                    return (
                      <tr key={row.department}>
                        <td>{row.department}</td>
                        <td>{rate}%</td>
                        <td>{row.safe}</td>
                        <td>{row.need_help}</td>
                        <td>{row.pending}</td>
                        <td>
                          <button
                            type="button"
                            className="btn ghost btn-sm admin-dept-view-btn"
                            onClick={() => {
                              onSelectDepartment(row.department);
                              setDetailTab('departments');
                            }}
                          >
                            {dash.adminDeptActionView}
                            <ChevronRight size={16} aria-hidden />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="admin-dept-cards-mobile">
              {overviewDeptRows.map((row) => {
                const rate = adminDeptResponseRate(row);
                return (
                  <div key={row.department} className="admin-dept-mobile-card">
                    <div className="admin-dept-mobile-card-top">
                      <strong>{row.department}</strong>
                      <span className="muted-text">{rate}%</span>
                    </div>
                    <p className="muted-text small admin-dept-mobile-stats">
                      {dash.kpiSafe} {row.safe} · {dash.kpiNeedHelp} {row.need_help} · {dash.kpiNoResponse} {row.pending}
                    </p>
                    <button
                      type="button"
                      className="btn ghost btn-sm admin-dept-view-btn"
                      onClick={() => {
                        onSelectDepartment(row.department);
                        setDetailTab('departments');
                      }}
                    >
                      {dash.adminDeptActionView}
                      <ChevronRight size={16} aria-hidden />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
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
            <>
              <div className="admin-dept-table-desktop">
                <table className="admin-dept-status-table">
                  <thead>
                    <tr>
                      <th scope="col">{dash.adminDeptColDept}</th>
                      <th scope="col">{dash.adminDeptColRate}</th>
                      <th scope="col">{dash.adminDeptColSafe}</th>
                      <th scope="col">{dash.adminDeptColNeed}</th>
                      <th scope="col">{dash.adminDeptColPending}</th>
                      <th scope="col">
                        <span className="sr-only">{dash.adminDeptActionView}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptAggSorted.map((row) => {
                      const rate = adminDeptResponseRate(row);
                      return (
                        <tr key={row.department}>
                          <td>{row.department}</td>
                          <td>{rate}%</td>
                          <td>{row.safe}</td>
                          <td>{row.need_help}</td>
                          <td>{row.pending}</td>
                          <td>
                            <button
                              type="button"
                              className="btn ghost btn-sm admin-dept-view-btn"
                              onClick={() => onSelectDepartment(row.department)}
                            >
                              {dash.adminDeptActionView}
                              <ChevronRight size={16} aria-hidden />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="admin-dept-cards-mobile">
                {deptAggSorted.map((row) => {
                  const rate = adminDeptResponseRate(row);
                  return (
                    <div key={row.department} className="admin-dept-mobile-card">
                      <div className="admin-dept-mobile-card-top">
                        <strong>{row.department}</strong>
                        <span className="muted-text">{rate}%</span>
                      </div>
                      <div className="progress-track admin-dept-mini-progress">
                        <div className="progress-fill" style={{ width: `${rate}%` }} />
                      </div>
                      <p className="muted-text small admin-dept-mobile-stats">
                        {dash.kpiSafe} {row.safe} · {dash.kpiNeedHelp} {row.need_help} · {dash.kpiNoResponse}{' '}
                        {row.pending}
                      </p>
                      <button
                        type="button"
                        className="btn ghost btn-sm admin-dept-view-btn"
                        onClick={() => onSelectDepartment(row.department)}
                      >
                        {dash.adminDeptActionView}
                        <ChevronRight size={16} aria-hidden />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
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
