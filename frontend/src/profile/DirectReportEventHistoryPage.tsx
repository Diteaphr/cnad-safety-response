import { useMemo, useState } from 'react';
import { PageBackButton } from '../components/PageBackButton';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { formatProfileHistoryTime } from '../features/member/memberFormat';
import { useLocale } from '../locale/LocaleContext';
import { getStrings } from '../locale/strings';
import type { EventItem, SafetyResponse, SafetyStatus, User } from '../types';
import { compareEventsByStartThenCreatedDesc } from '../types';

export function DirectReportEventHistoryPage({
  subordinate,
  events,
  responses,
  onBack,
}: Readonly<{
  subordinate: User;
  events: EventItem[];
  responses: SafetyResponse[];
  onBack: () => void;
}>) {
  const { locale } = useLocale();
  const { profilePage: pp } = getStrings(locale);
  const [filter, setFilter] = useState<'all' | 'safe' | 'need_help' | 'pending'>('all');

  const filterLabels: Record<typeof filter, string> = {
    all: pp.historyFilterAll,
    safe: pp.historyFilterSafe,
    need_help: pp.historyFilterNeedHelp,
    pending: pp.historyFilterPending,
  };

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

  const tabBtn = (key: typeof filter) => (
    <button
      key={key}
      type="button"
      className={`profile-history-filter pill ${filter === key ? 'active' : ''}`}
      onClick={() => setFilter(key)}
    >
      {filterLabels[key]}
    </button>
  );

  return (
    <section className="page-section employee-events-page profile-settings-page profile-subordinate-history-page">
      <PageBackButton onClick={onBack} ariaLabel={pp.backToProfile} />

      <PageHeader title={subordinate.name} subtitle={pp.historySubtitle} />

      <div className="profile-history-filters" role="tablist" aria-label={pp.historyFilterAll}>
        {tabBtn('all')}
        {tabBtn('safe')}
        {tabBtn('need_help')}
        {tabBtn('pending')}
      </div>

      <div className="employee-events-card-list profile-settings-history-stack">
        {filtered.length === 0 ? (
          <div className="empty employee-events-empty">{pp.historyEmptyFilter}</div>
        ) : (
          filtered.map((row) => (
            <article className="profile-settings-history-card" key={row.event.id}>
              <div className="profile-settings-history-card-main">
                <strong className="profile-settings-history-card-title">{row.event.title}</strong>
                <dl className="profile-settings-history-card-dates">
                  <div className="profile-settings-history-date-row">
                    <dt>{pp.historyStartedAt}</dt>
                    <dd>{formatProfileHistoryTime(row.event.startAt, locale)}</dd>
                  </div>
                  {row.updatedAt ? (
                    <div className="profile-settings-history-date-row">
                      <dt>{pp.historyUpdatedAt}</dt>
                      <dd>{formatProfileHistoryTime(row.updatedAt, locale)}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              <div className="profile-settings-history-card-status">
                <StatusBadge status={row.status} />
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
