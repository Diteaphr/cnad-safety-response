import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { DashboardStrings } from '../../locale/strings';
import { aggregateByDepartment, type DeptStatRow } from './deptAggregation';

function DeptStackBar({ dept }: Readonly<{ dept: DeptStatRow }>) {
  const total = Math.max(dept.total, 1);
  const wNeed = `${(dept.needHelp / total) * 100}%`;
  const wPending = `${(dept.pending / total) * 100}%`;
  const wSafe = `${(dept.safe / total) * 100}%`;

  return (
    <div className="sv-dist-stack-bar admin-dept-histogram-bar" aria-hidden>
      <div className="sv-dist-stack-track">
        {dept.needHelp > 0 ? (
          <div className="sv-dist-stack-seg sv-dist-stack-seg--need" style={{ width: wNeed }} />
        ) : null}
        {dept.pending > 0 ? (
          <div className="sv-dist-stack-seg sv-dist-stack-seg--pending" style={{ width: wPending }} />
        ) : null}
        {dept.safe > 0 ? <div className="sv-dist-stack-seg sv-dist-stack-seg--safe" style={{ width: wSafe }} /> : null}
      </div>
    </div>
  );
}

function pct(count: number, total: number): number {
  return total ? Math.round((count / total) * 100) : 0;
}

type DepartmentHistogramProps = Readonly<{
  rows: Array<{ department: string; status: 'safe' | 'need_help' | 'pending' }>;
  dash: DashboardStrings;
  selectedDept: string | null;
  onSelectDept: (deptName: string) => void;
  onClearDept: () => void;
  onScrollToRoster: () => void;
}>;

export function DepartmentHistogram({
  rows,
  dash,
  selectedDept,
  onSelectDept,
  onClearDept,
  onScrollToRoster,
}: DepartmentHistogramProps) {
  const depts = useMemo(() => aggregateByDepartment(rows), [rows]);

  if (depts.length <= 1) return null;

  return (
    <article className="dash-panel-elevated admin-dept-histogram">
      <header className="admin-dept-histogram-head">
        <div className="admin-dept-histogram-head-text">
          <h3 className="admin-dept-histogram-title">{dash.adminDeptReportSectionTitle}</h3>
          <p className="admin-dept-histogram-hint muted-text small">{dash.adminDeptHistogramHint}</p>
        </div>
        <button type="button" className="admin-dept-histogram-link" onClick={onScrollToRoster}>
          {dash.adminDeptViewRosterLink}
        </button>
      </header>

      {selectedDept ? (
        <div className="admin-dept-histogram-filter-bar">
          <span className="muted-text small">{dash.adminScopeEmployeesOnlyHint(selectedDept)}</span>
          <button type="button" className="admin-dept-histogram-clear" onClick={onClearDept}>
            {dash.adminDeptClearFilter}
          </button>
        </div>
      ) : null}

      <ul className="admin-dept-histogram-list">
        {depts.map((dept) => {
          const pNeed = pct(dept.needHelp, dept.total);
          const pPending = pct(dept.pending, dept.total);
          const pSafe = pct(dept.safe, dept.total);
          const isActive = selectedDept === dept.name;

          return (
            <li key={dept.name}>
              <button
                type="button"
                className={`admin-dept-histogram-row${isActive ? ' is-active' : ''}`}
                onClick={() => onSelectDept(dept.name)}
                aria-label={dash.adminDeptRowAria(dept.name)}
                aria-pressed={isActive}
              >
                <div className="admin-dept-histogram-row-body">
                  <div className="admin-dept-histogram-row-head">
                    <span className="admin-dept-histogram-name">{dept.name}</span>
                    {dept.needHelp > 0 ? (
                      <span className="admin-dept-histogram-alert">{dash.adminDeptNeedHelpHint(dept.needHelp)}</span>
                    ) : (
                      <span className="admin-dept-histogram-rate muted-text">
                        {dash.responseRateCenter} {dept.responseRate}%
                      </span>
                    )}
                  </div>
                  <DeptStackBar dept={dept} />
                  <div className="admin-dept-histogram-legend muted-text small">
                    {dept.needHelp > 0 ? (
                      <span className="admin-dept-histogram-legend-item admin-dept-histogram-legend-item--need">
                        ■ {dash.legendNeed} {pNeed}%
                      </span>
                    ) : null}
                    {dept.pending > 0 ? (
                      <span className="admin-dept-histogram-legend-item">■ {dash.legendPending} {pPending}%</span>
                    ) : null}
                    {dept.safe > 0 ? (
                      <span className="admin-dept-histogram-legend-item admin-dept-histogram-legend-item--safe">
                        ■ {dash.legendSafe} {pSafe}%
                      </span>
                    ) : null}
                  </div>
                </div>
                <ChevronRight className="admin-dept-histogram-chevron" size={18} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
