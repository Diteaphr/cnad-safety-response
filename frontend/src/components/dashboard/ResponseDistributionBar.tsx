import type { DashboardStrings } from '../../locale/strings';

/** Stacked bar + explicit % and counts so the strip is self-explanatory. */
export function ResponseDistributionBar({
  safe,
  needHelp,
  pending,
  strings,
}: {
  safe: number;
  needHelp: number;
  pending: number;
  strings: DashboardStrings;
}) {
  const sum = Math.max(safe + needHelp + pending, 1);
  const ps = Math.round((safe / sum) * 1000) / 10;
  const pn = Math.round((needHelp / sum) * 1000) / 10;
  const pp = Math.round((pending / sum) * 1000) / 10;
  const ws = `${(safe / sum) * 100}%`;
  const wn = `${(needHelp / sum) * 100}%`;
  const wp = `${(pending / sum) * 100}%`;

  return (
    <div className="dash-dist-section">
      <p className="muted-text dash-dist-hint">{strings.distributionHint}</p>
      <div className="dash-dist-bar" role="img" aria-label={strings.distributionCaption(safe, needHelp, pending, ps, pn, pp)}>
        <div className="dash-dist-bar-track">
          <div className="dash-dist-seg dash-dist-seg--safe" style={{ width: ws }} />
          <div className="dash-dist-seg dash-dist-seg--need" style={{ width: wn }} />
          <div className="dash-dist-seg dash-dist-seg--pending" style={{ width: wp }} />
        </div>
      </div>
      <ul className="dash-dist-legend dash-dist-legend--inline">
        <li>
          <i className="dot safe" aria-hidden />
          <span>
            {strings.legendSafe}: <strong>{safe}</strong> ({ps}%)
          </span>
        </li>
        <li>
          <i className="dot danger" aria-hidden />
          <span>
            {strings.legendNeed}: <strong>{needHelp}</strong> ({pn}%)
          </span>
        </li>
        <li>
          <i className="dot pending" aria-hidden />
          <span>
            {strings.legendPending}: <strong>{pending}</strong> ({pp}%)
          </span>
        </li>
      </ul>
    </div>
  );
}
