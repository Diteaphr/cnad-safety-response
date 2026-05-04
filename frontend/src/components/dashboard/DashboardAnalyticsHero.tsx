import type { DashboardStrings } from '../../locale/strings';

/** Donut left; KPI counts right (label left, value right) — replaces duplicate summary + bottom card grid. */
export function DashboardAnalyticsHero({
  responseRate,
  safe,
  needHelp,
  pending,
  total,
  rateLabel,
  strings: s,
}: {
  responseRate: number;
  safe: number;
  needHelp: number;
  pending: number;
  total: number;
  rateLabel: string;
  strings: DashboardStrings;
}) {
  const t = Math.max(total, 1);
  const pctSafe = (safe / t) * 100;
  const pctNeed = (needHelp / t) * 100;
  const pctPen = (pending / t) * 100;
  const endSafe = pctSafe;
  const endNeed = endSafe + pctNeed;

  const rows: Array<{ key: string; label: string; value: number; tone: 'primary' | 'safe' | 'danger' | 'warning' }> = [
    { key: 'tot', label: s.kpiTotal, value: total, tone: 'primary' },
    { key: 'sf', label: s.kpiSafe, value: safe, tone: 'safe' },
    { key: 'nh', label: s.kpiNeedHelp, value: needHelp, tone: 'danger' },
    { key: 'pd', label: s.kpiNoResponse, value: pending, tone: 'warning' },
  ];

  return (
    <div className="dash-analytics-hero">
      <div className="dash-analytics-hero-visual">
        <div className="dash-donut-wrap">
          <div
            className="dash-donut-ring"
            style={{
              background: `conic-gradient(
              var(--dash-safe, #16a34a) 0% ${endSafe}%,
              var(--dash-danger, #dc2626) ${endSafe}% ${endNeed}%,
              var(--dash-warn, #eab308) ${endNeed}% ${endNeed + pctPen}%,
              var(--dash-track, #e5e7eb) ${endNeed + pctPen}% 100%
            )`,
            }}
            aria-hidden
          />
          <div className="dash-donut-center">
            <strong className="dash-donut-rate">{responseRate}%</strong>
            <span className="muted-text dash-donut-label">{rateLabel}</span>
          </div>
        </div>
      </div>

      <div className="dash-hero-kpi-aside" aria-label={s.kpiTotal}>
        {rows.map((row) => (
          <div key={row.key} className={`dash-hero-kpi-row dash-hero-kpi-row--${row.tone}`}>
            <span className="dash-hero-kpi-label">{row.label}</span>
            <strong className="dash-hero-kpi-value">{row.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
