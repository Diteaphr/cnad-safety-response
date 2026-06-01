import { AlertTriangle } from 'lucide-react';
import type { DashboardStrings } from '../../locale/strings';

type AdminEventKpiPanelProps = Readonly<{
  stats: { total: number; safe: number; needHelp: number; pending: number; responseRate: number };
  dash: DashboardStrings;
  safeLabel: string;
  uncontactedNeedHelp: number;
  syncedLine: string;
  reportedOfTotal: (reported: number, total: number) => string;
}>;

export function AdminEventKpiPanel({
  stats,
  dash,
  safeLabel,
  uncontactedNeedHelp,
  syncedLine,
  reportedOfTotal,
}: AdminEventKpiPanelProps) {
  const reported = stats.safe + stats.needHelp;

  return (
    <article className="dash-panel-elevated admin-event-kpi-panel">
      {stats.needHelp > 0 ? (
        <output className="admin-event-kpi-banner">
          <AlertTriangle size={16} aria-hidden />
          <span>{dash.adminPriorityBanner(stats.needHelp, uncontactedNeedHelp)}</span>
        </output>
      ) : null}

      <div className="admin-event-stat-row">
        <div className="admin-event-stat-card">
          <div className="admin-event-stat-num admin-event-stat-num--pending">{stats.pending}</div>
          <div className="admin-event-stat-label">{dash.kpiNoResponse}</div>
        </div>
        <div className="admin-event-stat-card">
          <div className="admin-event-stat-num admin-event-stat-num--need">{stats.needHelp}</div>
          <div className="admin-event-stat-label">{dash.kpiNeedHelp}</div>
        </div>
        <div className="admin-event-stat-card">
          <div className="admin-event-stat-num admin-event-stat-num--safe">{stats.safe}</div>
          <div className="admin-event-stat-label">{safeLabel}</div>
        </div>
      </div>

      <p className="admin-event-kpi-summary muted-text small">
        {dash.responseRateCenter} {stats.responseRate}%（{reportedOfTotal(reported, stats.total)}）
        <span className="admin-event-kpi-summary-dot" aria-hidden>
          {' '}
          ·{' '}
        </span>
        {dash.lastSynced} {syncedLine}
      </p>
    </article>
  );
}
