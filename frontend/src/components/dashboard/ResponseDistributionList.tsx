import type { DashboardStrings } from '../../locale/strings';

type DistRow = {
  key: 'safe' | 'need_help' | 'pending';
  label: string;
  count: number;
  pct: number;
};

type ResponseDistributionListProps = Readonly<{
  safe: number;
  needHelp: number;
  pending: number;
  strings: DashboardStrings;
  showStackedBar?: boolean;
  /** Hide pending from legend/breakdown rows; bar still uses all three segments vs total headcount. */
  hidePending?: boolean;
}>;

/** Vertical status breakdown with optional stacked bar — no horizontal scroll. */
export function ResponseDistributionList({
  safe,
  needHelp,
  pending,
  strings,
  showStackedBar = false,
  hidePending = false,
}: ResponseDistributionListProps) {
  const totalSum = Math.max(safe + needHelp + pending, 1);
  const ps = Math.round((safe / totalSum) * 1000) / 10;
  const pn = Math.round((needHelp / totalSum) * 1000) / 10;
  const pp = Math.round((pending / totalSum) * 1000) / 10;

  const allRows: DistRow[] = [
    { key: 'safe', label: strings.legendSafe, count: safe, pct: ps },
    { key: 'need_help', label: strings.legendNeed, count: needHelp, pct: pn },
    { key: 'pending', label: strings.legendPending, count: pending, pct: pp },
  ];

  const legendRows = hidePending ? allRows.filter((row) => row.key !== 'pending') : allRows;
  const breakdownRows = legendRows;

  const ws = `${(safe / totalSum) * 100}%`;
  const wn = `${(needHelp / totalSum) * 100}%`;
  const wp = `${(pending / totalSum) * 100}%`;

  return (
    <div className="sv-dist-list" role="img" aria-label={strings.distributionCaption(safe, needHelp, pending, ps, pn, pp)}>
      {showStackedBar ? (
        <>
          <div className="sv-dist-stack-bar" aria-hidden>
            <div className="sv-dist-stack-track">
              {safe > 0 ? <div className="sv-dist-stack-seg sv-dist-stack-seg--safe" style={{ width: ws }} /> : null}
              {needHelp > 0 ? <div className="sv-dist-stack-seg sv-dist-stack-seg--need" style={{ width: wn }} /> : null}
              {pending > 0 ? <div className="sv-dist-stack-seg sv-dist-stack-seg--pending" style={{ width: wp }} /> : null}
            </div>
          </div>
          <ul className="sv-dist-legend">
            {legendRows.map((row) => (
              <li key={row.key} className={`sv-dist-legend-item sv-dist-legend-item--${row.key}`}>
                <i className="sv-dist-legend-dot" aria-hidden />
                <span>{row.label}</span>
              </li>
            ))}
          </ul>
          <div className="sv-dist-divider" aria-hidden />
        </>
      ) : null}

      <ul className="sv-dist-breakdown">
        {breakdownRows.map((row) => (
          <li key={row.key} className={`sv-dist-breakdown-row sv-dist-breakdown-row--${row.key}`}>
            <span className="sv-dist-breakdown-icon" aria-hidden />
            <span className="sv-dist-breakdown-label">{row.label}</span>
            <span className="sv-dist-breakdown-pct">{row.pct}%</span>
            <span className="sv-dist-breakdown-count">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
