import { EmployeeTable } from '../../components/EmployeeTable';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import type { Department } from '../../types';

export function SupervisorDashboardPage({
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
  allRespondedBanner,
  dashMismatchHint,
  dashboardFreshAt,
}: {
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
  allRespondedBanner: boolean;
  dashMismatchHint: string | null;
  dashboardFreshAt: number | null;
}) {
  const filtered = rows
    .filter((row) => (filter === 'all' ? true : row.status === filter))
    .filter((row) => row.name.toLowerCase().includes(searchText.toLowerCase()))
    .sort((a, b) => (a.status === 'need_help' ? -1 : 1) - (b.status === 'need_help' ? -1 : 1));
  const urgentRows = rows.filter((row) => row.status === 'need_help');
  const urgentUncontacted = urgentRows.filter((row) => !contactedMap[row.id]);
  const pendingRows = rows.filter((row) => row.status === 'pending');

  const tableRows = filtered;
  const pctSafeShare = stats.total ? Math.round((stats.safe / stats.total) * 100) : 0;
  const pctNeedShare = stats.total ? Math.round((stats.needHelp / stats.total) * 100) : 0;
  const pctPendingShare = stats.total ? Math.round((stats.pending / stats.total) * 100) : 0;

  return (
    <section className="page-section">
      <button className="btn ghost" onClick={onBackToEvents} type="button">
        ← Back to Events
      </button>
      <h2>Supervisor Dashboard</h2>
      {dashMismatchHint ? <p className="muted-text supervisor-dash-scope-hint">{dashMismatchHint}</p> : null}
      {dashboardFreshAt ? (
        <p className="muted-text supervisor-dash-sync-time">
          Snapshot synced · {new Date(dashboardFreshAt).toLocaleString()}
        </p>
      ) : null}
      {pendingRatioHigh ? (
        <p className="supervisor-priority-alert" role="status">
          逾三成部屬仍未回報，請優先聯繫並確認現況。
        </p>
      ) : null}
      {allRespondedBanner ? (
        <p className="muted-text supervisor-all-clear" role="status">
          回報已完成：所有部屬皆已送出狀態。
        </p>
      ) : null}
      {stats.total === 0 ? <p className="muted-text">尚無可監看的部屬資料。</p> : null}

      <div className="panel supervisor-overview">
        <h3 className="section-title">Response Snapshot</h3>
        <div className="dashboard-top">
          <div className="stat-grid">
            <StatCard label="Total Employees" value={stats.total} />
            <StatCard label="Safe" value={stats.safe} tone="safe" />
            <StatCard label="Need Help" value={stats.needHelp} tone="danger" />
            <StatCard label="No Response" value={stats.pending} tone="warning" />
            <StatCard label="Response Rate" value={`${stats.responseRate}%`} tone="primary" />
          </div>
          <div className="dashboard-visual">
            <div
              className="pie-chart"
              style={{
                background: `conic-gradient(#2ba95a 0 ${(stats.safe / Math.max(stats.total, 1)) * 100}%, #d53d3f ${(stats.safe / Math.max(stats.total, 1)) * 100}% ${((stats.safe + stats.needHelp) / Math.max(stats.total, 1)) * 100}%, #f2c04a ${((stats.safe + stats.needHelp) / Math.max(stats.total, 1)) * 100}% 100%)`,
              }}
            />
            <div className="pie-legend">
              <span>
                <i className="dot safe" /> Safe: {stats.safe}
              </span>
              <span>
                <i className="dot danger" /> Need Help: {stats.needHelp}
              </span>
              <span>
                <i className="dot pending" /> No Response: {stats.pending}
              </span>
            </div>
          </div>
        </div>
        {stats.total > 0 ? (
          <p className="supervisor-share-line muted-text">
            三態百分比：平安 {pctSafeShare}% · 需協助 {pctNeedShare}% · 未回報 {pctPendingShare}%（對照上列人數；進度條為已回報佔總員額）。
          </p>
        ) : null}
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${stats.responseRate}%` }} />
        </div>
      </div>

      <div className="grid-2">
        <section className={`panel supervisor-need-help-panel${urgentUncontacted.length > 5 ? ' supervisor-need-help-many' : ''}`}>
          <h3 className="section-title">Immediate Attention · Need Help</h3>
          {urgentRows.length === 0 ? (
            <p className="empty">尚無標記為需要協助人員。</p>
          ) : (
            urgentRows.map((row) => {
              const reached = contactedMap[row.id] ?? false;
              return (
                <article key={row.id} className="list-item supervisor-need-item">
                  <div>
                    <strong>{row.name}</strong>
                    <p className="muted-text">
                      {row.department}
                      {row.phone ? (
                        <>
                          {' '}
                          ·{' '}
                          <a href={`tel:${row.phone.replace(/\s/g, '')}`}>{row.phone}</a>
                        </>
                      ) : null}
                    </p>
                    {(row.note || row.locationLine) ? <p>{[row.locationLine, row.note].filter(Boolean).join(' · ')}</p> : null}
                  </div>
                  <div className="supervisor-need-help-actions">
                    <StatusBadge status="need_help" />
                    <button
                      type="button"
                      className={`btn ghost btn-sm supervisor-contact-flag${reached ? ' is-reached' : ''}`}
                      onClick={() => onToggleContacted(row.id)}
                    >
                      {reached ? '已聯繫' : '標記為已聯繫'}
                    </button>
                  </div>
                </article>
              );
            })
          )}
          {urgentUncontacted.length > 5 ? (
            <p className="supervisor-many-alert" role="alert">
              仍有 {urgentUncontacted.length} 位需協助人員未完成聯繫確認。
            </p>
          ) : null}
        </section>
        <section className="panel">
          <h3 className="section-title">Pending Follow-up</h3>
          {pendingRows.length === 0 ? (
            <p className="empty">All employees responded.</p>
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
            <button className="btn warning" onClick={onSendReminder} type="button">
              Send Reminder
            </button>
            <button className="btn ghost" onClick={onExport} type="button">
              Export / Email
            </button>
          </div>
        </section>
      </div>

      <div className="toolbar">
        <div className="tabs">
          {(['all', 'need_help', 'pending', 'safe'] as const).map((item) => (
            <button key={item} className={filter === item ? 'pill active' : 'pill'} onClick={() => setFilter(item)} type="button">
              {item}
            </button>
          ))}
        </div>
        <input placeholder="Search employee" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
      </div>
      <h3 className="section-title">Detailed Employee List</h3>
      {tableRows.length === 0 ? <p className="empty">尚無回報資料</p> : <EmployeeTable rows={tableRows} />}
    </section>
  );
}

export function AdminDashboardPage({
  stats,
  rows,
  departments: deptList,
  deptBreakdown,
  dashboardFreshAt,
  dashMismatchHint,
  onBackToEvents,
}: {
  stats: { total: number; safe: number; needHelp: number; pending: number; responseRate: number };
  rows: Array<{ id: string; name: string; department: string; status: 'safe' | 'need_help' | 'pending'; note?: string }>;
  departments: Department[];
  deptBreakdown?: Array<{ department: string; safe: number; need_help: number; pending: number }>;
  dashboardFreshAt: number | null;
  dashMismatchHint: string | null;
  onBackToEvents: () => void;
}) {
  const critical = rows.filter((row) => row.status === 'need_help');
  const pending = rows.filter((row) => row.status === 'pending');
  return (
    <section className="page-section">
      <button className="btn ghost" onClick={onBackToEvents} type="button">
        ← Back to Events
      </button>
      <h2>Admin Dashboard</h2>
      {dashMismatchHint ? <p className="muted-text supervisor-dash-scope-hint">{dashMismatchHint}</p> : null}
      {dashboardFreshAt ? (
        <p className="muted-text supervisor-dash-sync-time">
          Snapshot synced · {new Date(dashboardFreshAt).toLocaleString()}
        </p>
      ) : null}
      <section className="panel">
        <h3 className="section-title">Global Status Overview</h3>
        {stats.total === 0 ? <p className="empty">尚無回報資料</p> : null}
        <div className="stat-grid">
          <StatCard label="Global Safe" value={stats.safe} tone="safe" />
          <StatCard label="Global Need Help" value={stats.needHelp} tone="danger" />
          <StatCard label="Global No Response" value={stats.pending} tone="warning" />
          <StatCard label="Response Rate" value={`${stats.responseRate}%`} tone="primary" />
        </div>
      </section>
      <div className="grid-2">
        <section className="panel">
          <h3 className="section-title">Department Response Ranking</h3>
          <div className="list">
            {deptBreakdown?.length ? (
              deptBreakdown.map((row) => {
                const headcount = row.safe + row.need_help + row.pending;
                const rate = headcount ? Math.round(((row.safe + row.need_help) / headcount) * 100) : 0;
                return (
                  <div className="list-item" key={row.department}>
                    <span>{row.department}</span>
                    <strong>
                      回報率 {rate}% · 平安 {row.safe} / 協助 {row.need_help} / 未回 {row.pending}
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
        <section className="panel">
          <h3 className="section-title">Critical Alerts</h3>
          {critical.length === 0 ? <p className="empty">No employees currently marked Need Help.</p> : critical.map((row) => (
            <div className="list-item" key={row.id}>
              <div>
                <strong>{row.name}</strong>
                <p>{row.department}</p>
              </div>
              <StatusBadge status="need_help" />
            </div>
          ))}
        </section>
      </div>
      <div className="grid-2">
        <section className="panel">
          <h3 className="section-title">No Response Queue</h3>
          {pending.length === 0 ? <p className="empty">No pending responders.</p> : pending.map((row) => (
            <div className="list-item" key={`pending-${row.id}`}>
              <div>
                <strong>{row.name}</strong>
                <p>{row.department}</p>
              </div>
              <StatusBadge status="pending" />
            </div>
          ))}
        </section>
        <section className="map-placeholder">Map / Location Overview (Prototype Placeholder)</section>
      </div>
    </section>
  );
}
