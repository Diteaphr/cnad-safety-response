import { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import type { EventItem, SafetyResponse, SafetyStatus, User } from '../types';
import { StatusBadge } from '../components/StatusBadge';

export function DirectReportEventHistoryPage({
  subordinate,
  events,
  responses,
  onBack,
}: {
  subordinate: User;
  events: EventItem[];
  responses: SafetyResponse[];
  onBack: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'safe' | 'need_help' | 'pending'>('all');

  const rows = useMemo(() => {
    const list = events
      .filter((e) => e.status !== 'draft' && e.targetDepartmentIds.includes(subordinate.departmentId))
      .map((event) => {
        const latest = responses
          .filter((r) => r.eventId === event.id && r.userId === subordinate.id)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        const status: SafetyStatus = latest?.status ?? 'pending';
        return { event, status, updatedAt: latest?.updatedAt };
      })
      .sort((a, b) => new Date(b.event.startAt).getTime() - new Date(a.event.startAt).getTime());
    return list;
  }, [events, responses, subordinate.departmentId, subordinate.id]);

  const filtered = rows.filter((row) => (filter === 'all' ? true : row.status === filter));

  const tabBtn = (key: typeof filter, label: string) => (
    <button
      key={key}
      type="button"
      className={`employee-events-tab pill ${filter === key ? 'active' : ''}`}
      onClick={() => setFilter(key)}
    >
      {label}
    </button>
  );

  return (
    <section className="page-section employee-events-page profile-settings-page">
      <button type="button" className="btn ghost profile-settings-back" onClick={onBack}>
        ← Back to Profile
      </button>

      <header className="employee-events-hero">
        <div className="employee-events-hero-text">
          <h2 className="employee-events-title">
            <ClipboardList className="employee-events-title-icon" aria-hidden />
            {subordinate.name}
          </h2>
          <p className="employee-events-subtitle">
            Event responses visible for their department; no submission shows as No Response.
          </p>
        </div>
      </header>

      <div className="employee-events-tabs pills-counted profile-settings-history-tabs">
        {tabBtn('all', 'All')}
        {tabBtn('safe', 'Safe')}
        {tabBtn('need_help', 'Need Help')}
        {tabBtn('pending', 'No Response')}
      </div>

      <div className="employee-events-card-list profile-settings-history-stack">
        {filtered.length === 0 ? (
          <div className="empty employee-events-empty">Nothing matches this filter.</div>
        ) : (
          filtered.map((row) => (
            <article className="profile-settings-history-card" key={row.event.id}>
              <div className="profile-settings-history-card-main">
                <strong>{row.event.title}</strong>
                <p>
                  {new Date(row.event.startAt).toLocaleString()}
                  {row.updatedAt ? ` · Updated ${new Date(row.updatedAt).toLocaleString()}` : ''}
                </p>
              </div>
              <StatusBadge status={row.status} />
            </article>
          ))
        )}
      </div>
    </section>
  );
}
