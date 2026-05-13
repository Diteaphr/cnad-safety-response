import { Activity } from 'lucide-react';
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
import type { Department, EventItem } from '../../types';

function formatSynced(strings: DashboardStrings, ts: number | null, locale: string): string | null {
  if (ts === null) return null;
  const d = new Date(ts);
  return `${strings.lastSynced}: ${d.toLocaleString(locale === 'en' ? 'en-US' : 'zh-TW')}`;
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
}: {
  event: EventItem | null;
  stats: { total: number; safe: number; needHelp: number; pending: number; responseRate: number };
  rows: Array<{ id: string; name: string; department: string; status: 'safe' | 'need_help' | 'pending'; note?: string; phone?: string }>;
  departments: Department[];
  deptBreakdown?: Array<{ department: string; safe: number; need_help: number; pending: number }>;
  dashboardFreshAt: number | null;
  dashMismatchHint: string | null;
  onBackToEvents: () => void;
}) {
  const { locale } = useLocale();
  const { dash } = getStrings(locale);

  const critical = rows.filter((row) => row.status === 'need_help');
  const pending = rows.filter((row) => row.status === 'pending');

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

  return (
    <section className="page-section dash-board-surface admin-dash-page">
      <DashboardShellHeader
        brandName={dash.brand}
        backLabel={dash.backToEvents}
        onBack={onBackToEvents}
        lastSyncedFormatted={formatSynced(dash, dashboardFreshAt, locale)}
        syncOk
      />

      <div className="dash-page-heading">
        <h1>{dash.adminTitle}</h1>
        <p className="muted-text">{dash.adminSubtitle}</p>
      </div>

      {dashMismatchHint ? <p className="dash-scope-hint muted-text">{dashMismatchHint}</p> : null}

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

      <div className="grid-2">
        <section className="dash-panel-elevated">
          <h3 className="dash-subsection-title">{dash.deptRanking}</h3>
          <div className="list">
            {deptBreakdown?.length ? (
              deptBreakdown.map((row) => {
                const headcount = row.safe + row.need_help + row.pending;
                const rate = headcount ? Math.round(((row.safe + row.need_help) / headcount) * 100) : 0;
                return (
                  <div className="list-item" key={row.department}>
                    <span>{row.department}</span>
                    <strong>
                      {rate}% · {dash.kpiSafe} {row.safe} / {dash.kpiNeedHelp} {row.need_help} / {dash.kpiNoResponse}{' '}
                      {row.pending}
                    </strong>
                  </div>
                );
              })
            ) : (
              deptList.map((dept) => {
                const deptRows = rows.filter((r) => r.department === dept.name);
                const responded = deptRows.filter((r) => r.status !== 'pending').length;
                const rate = deptRows.length ? Math.round((responded / deptRows.length) * 100) : 0;
                return (
                  <div className="list-item" key={dept.id}>
                    <span>{dept.name}</span>
                    <strong>{rate}%</strong>
                  </div>
                );
              })
            )}
          </div>
        </section>
        <section className="dash-panel-elevated supervisor-need-help-panel">
          <h3 className="dash-subsection-title">{dash.criticalAlerts}</h3>
          {critical.length === 0 ? (
            <p className="empty">{dash.noRows}</p>
          ) : (
            critical.map((row) => {
              const tel = row.phone?.replace(/\s/g, '') ?? '';
              return (
                <div className="list-item dash-need-row-slim dash-admin-critical-card" key={row.id}>
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
                  </div>
                  <StatusBadge status="need_help" />
                </div>
              );
            })
          )}
        </section>
      </div>
      <div className="grid-2">
        <section className="dash-panel-elevated">
          <h3 className="dash-subsection-title">{dash.noResponseQueue}</h3>
          {pending.length === 0 ? (
            <p className="empty">{dash.allRespondedNote}</p>
          ) : (
            pending.map((row) => (
              <div className="list-item" key={`pending-${row.id}`}>
                <div>
                  <strong>{row.name}</strong>
                  <p>{row.department}</p>
                </div>
                <StatusBadge status="pending" />
              </div>
            ))
          )}
        </section>
        <section className="map-placeholder dash-map-placeholder">{dash.mapPlaceholder}</section>
      </div>
    </section>
  );
}
