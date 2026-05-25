import { AlertTriangle } from 'lucide-react';
import { ResponseDistributionList } from '../../components/dashboard/ResponseDistributionList';
import type { DashboardStrings } from '../../locale/strings';

export function SupervisorReportInsightCard({
  stats,
  dash,
  pendingRatioHigh,
  onOpenPendingList,
}: {
  stats: { total: number; safe: number; needHelp: number; pending: number; responseRate: number };
  dash: DashboardStrings;
  pendingRatioHigh: boolean;
  onOpenPendingList: () => void;
}) {
  return (
    <article className="dash-panel-elevated sv-insight-card">
      <header className="sv-insight-card-head">
        <h3 className="sv-insight-card-title">{dash.distribution}</h3>
        {stats.pending > 0 ? (
          <button type="button" className="sv-insight-action-btn" onClick={onOpenPendingList}>
            {dash.supervisorPendingListBtn}
          </button>
        ) : null}
      </header>

      <div className="sv-insight-hero">
        <div className="sv-insight-hero-main">
          <span className="sv-insight-rate-num">{stats.responseRate}</span>
          <span className="sv-insight-rate-suffix">%</span>
          <span className="sv-insight-rate-label">{dash.responseRateCenter}</span>
        </div>
        {pendingRatioHigh ? (
          <span className="sv-insight-warn-tag" role="status">
            <AlertTriangle size={14} aria-hidden />
            {dash.supervisorHighPendingTag}
          </span>
        ) : null}
      </div>

      <p className="sv-insight-ratio">{dash.adminDetailCompletedRatio(stats.safe + stats.needHelp, stats.total)}</p>

      <ResponseDistributionList
        strings={dash}
        safe={stats.safe}
        needHelp={stats.needHelp}
        pending={stats.pending}
        showStackedBar
        hidePending
      />
    </article>
  );
}
