import { useMemo, useState } from 'react';
import { PageBackButton } from '../components/PageBackButton';
import { PageHeader } from '../components/PageHeader';
import type { EventItem, SafetyResponse, SafetyStatus, User } from '../types';
import { compareEventsByStartThenCreatedDesc } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { useLocale } from '../locale/LocaleContext';
import { getStrings } from '../locale/strings';

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
  const { locale } = useLocale();
  const { profilePage: pp } = getStrings(locale);
  const [filter, setFilter] = useState<'all' | 'safe' | 'need_help' | 'pending'>('all');

  const rows = useMemo(() => {
    const list = events
      .filter(
        (e) =>
          (e.status === 'active' || e.status === 'closed') &&
          (e.targetDepartmentIds.length === 0 || e.targetDepartmentIds.includes(subordinate.departmentId)),
      )
      .map((event) => {
        const latest = responses
          .filter((r) => r.eventId === event.id && r.userId === subordinate.id)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        const status: SafetyStatus = latest?.status ?? 'pending';
        return { event, status, updatedAt: latest?.updatedAt };
      })
      .sort((a, b) => compareEventsByStartThenCreatedDesc(a.event, b.event));
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

  const subtitle =
    locale === 'zh-Hant'
      ? '顯示其部門相關事件回報；未回報顯示為未回應。'
      : 'Event responses visible for their department; no submission shows as No Response.';

  return (
    <section className="page-section employee-events-page profile-settings-page">
      <PageBackButton onClick={onBack} ariaLabel={pp.backToProfile} />

      <PageHeader title={subordinate.name} subtitle={subtitle} />

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
                  {row.event.startAt != null && row.event.startAt !== ''
                    ? new Date(row.event.startAt).toLocaleString()
                    : '—'}
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
