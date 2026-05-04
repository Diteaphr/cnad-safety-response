import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CloudUpload,
  FileImage,
  Flame,
  Filter,
  Headphones,
  Hourglass,
  Info,
  LifeBuoy,
  MapPin,
  MessageSquare,
  Package,
  Paperclip,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Wind,
} from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { StatusBadge } from '../../components/StatusBadge';
import { useLocale } from '../../locale/LocaleContext';
import type { AppLocale } from '../../locale/LocaleContext';
import { getStrings } from '../../locale/strings';
import { loadEmployeeReportDraft, saveEmployeeReportDraft } from '../../lib/employeeReportDraft';
import type { EventItem, SafetyResponse } from '../../types';

export type EmployeeReportFields = {
  comment: string;
  location: string;
  attachment: File | null;
};

const EMPTY_STACK_REPORT_FIELDS: EmployeeReportFields = { comment: '', location: '', attachment: null };

function employeeEventTypeIcon(type: EventItem['type']) {
  switch (type) {
    case 'Earthquake':
      return Activity;
    case 'Typhoon':
      return Wind;
    case 'Fire':
      return Flame;
    default:
      return Package;
  }
}

function formatEmployeeCardTime(iso: string, locale: AppLocale) {
  const tag = locale === 'en' ? 'en-US' : 'zh-TW';
  return new Date(iso).toLocaleString(tag, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function EmployeeEventListCard({
  event,
  latest,
  filterTab,
  selectedEventId,
  onSelectEvent,
}: {
  event: EventItem;
  latest?: SafetyResponse;
  filterTab: 'ongoing' | 'closed';
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
}) {
  const { locale } = useLocale();
  const ec = getStrings(locale).employee;
  const Icon = employeeEventTypeIcon(event.type);
  const deptLabel = event.cardDepartment ?? '';
  const isOngoingTab = filterTab === 'ongoing';
  const pending = !latest && isOngoingTab;
  const stripeClass =
    !isOngoingTab ? 'muted' : pending ? 'pending' : latest?.status === 'need_help' ? 'danger' : 'safe';
  const respondedTimeStr =
    latest && !pending
      ? new Date(latest.updatedAt).toLocaleTimeString(locale === 'en' ? 'en-US' : 'zh-TW', {
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';
  const closedDetailTime =
    latest && filterTab === 'closed'
      ? new Date(latest.updatedAt).toLocaleString(locale === 'en' ? 'en-US' : 'zh-TW', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';

  const ongoingStatusBlock = isOngoingTab ? (
    <>
      {pending ? (
        <span className="employee-events-status-pill pending">
          <Hourglass size={14} strokeWidth={2} aria-hidden />
          {ec.cardPendingLabel}
        </span>
      ) : latest?.status === 'safe' ? (
        <span className="employee-events-status-pill safe">
          <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
          {ec.cardReportedSafeLabel}
        </span>
      ) : latest ? (
        <span className="employee-events-status-pill danger">
          <AlertCircle size={14} strokeWidth={2} aria-hidden />
          {ec.cardReportedNeedLabel}
        </span>
      ) : null}
      {pending ? (
        <span className="employee-events-status-hint">{ec.cardAskSubmitHint}</span>
      ) : latest ? (
        <span className="employee-events-status-hint muted">{ec.cardRespondedHint(respondedTimeStr)}</span>
      ) : null}
    </>
  ) : null;

  const closedStatusBlock =
    filterTab === 'closed' ? (
      <>
        <span className="employee-events-status-pill closed">{ec.cardClosedBadge}</span>
        {latest?.status === 'safe' ? (
          <span className="employee-events-closed-safe">
            <CheckCircle2 size={14} className="text-safe" aria-hidden />
            {ec.cardIamSafeShort} · {closedDetailTime}
          </span>
        ) : latest?.status === 'need_help' ? (
          <span className="employee-events-closed-safe danger-text">
            <AlertCircle size={14} aria-hidden />
            {ec.cardNeedHelpShort} · {closedDetailTime}
          </span>
        ) : (
          <span className="employee-events-status-hint muted">{ec.cardNoSubmissionClosed}</span>
        )}
      </>
    ) : null;

  return (
    <button
      type="button"
      className={`employee-events-card${selectedEventId === event.id ? ' is-selected' : ''}`}
      onClick={() => onSelectEvent(event.id)}
    >
      <div className="employee-events-card-inner">
        <div className={`employee-events-card-stripe ee-stripe-bg-${stripeClass}`} aria-hidden />
        <div className="employee-events-card-main">
          <div className="employee-events-card-icon" aria-hidden>
            <Icon size={22} strokeWidth={1.85} />
          </div>

          <div className="employee-events-card-body">
            <div className="employee-events-card-title">{event.title}</div>
            <div className="employee-events-meta">
              <span className="employee-events-meta-dot">
                {event.type}
                {deptLabel ? <> · {deptLabel}</> : null}
              </span>
            </div>
            <div className="employee-events-meta subtle">{formatEmployeeCardTime(event.startAt, locale)}</div>
            {event.venue ? <div className="employee-events-meta subtle">{event.venue}</div> : null}

            <div className="employee-events-card-mobile-only">{ongoingStatusBlock ?? closedStatusBlock}</div>
          </div>

          <div className="employee-events-card-aside">
            <div className="employee-events-card-aside-text">
              {isOngoingTab ? (
                <>
                  {ongoingStatusBlock}
                  <span className={`employee-events-card-cta ${pending ? 'primary' : 'ghost'}`}>
                    <span className="employee-events-cta-label">{pending ? ec.cardContinue : ec.cardViewLabel}</span>
                    <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
                  </span>
                </>
              ) : (
                <>
                  {closedStatusBlock}
                  <span className="employee-events-card-cta ghost">
                    <span className="employee-events-cta-label">{ec.cardViewLabel}</span>
                    <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
                  </span>
                </>
              )}
            </div>
            <span className="employee-events-card-chevron-only" aria-hidden>
              <ChevronRight size={22} strokeWidth={2.25} />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export type MemberHomeRow = {
  event: EventItem;
  latest?: SafetyResponse;
  teamCounts?: { total: number; safe: number; needHelp: number; pending: number };
};

function MemberEventDualCard({
  event,
  latest,
  teamCounts,
  filterTab,
  selectedPersonalEventId,
  selectedTeamEventId,
  onOpenPersonal,
  onOpenTeam,
}: {
  event: EventItem;
  latest?: SafetyResponse;
  teamCounts: { total: number; safe: number; needHelp: number; pending: number };
  filterTab: 'ongoing' | 'closed';
  selectedPersonalEventId: string;
  selectedTeamEventId: string;
  onOpenPersonal: (eventId: string) => void;
  onOpenTeam: (eventId: string) => void;
}) {
  const { locale } = useLocale();
  const ec = getStrings(locale).employee;
  const Icon = employeeEventTypeIcon(event.type);
  const deptLabel = event.cardDepartment ?? '';
  const isOngoingTab = filterTab === 'ongoing';
  const pending = !latest && isOngoingTab;
  const stripeClass =
    !isOngoingTab ? 'muted' : pending ? 'pending' : latest?.status === 'need_help' ? 'danger' : 'safe';

  const personalMini = isOngoingTab ? (
    <>
      {!latest ? (
        <span className="employee-events-status-pill pending">
          <Hourglass size={14} strokeWidth={2} aria-hidden />
          {ec.cardPendingLabel}
        </span>
      ) : latest.status === 'safe' ? (
        <span className="employee-events-status-pill safe">
          <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
          {ec.cardIamSafeShort}
        </span>
      ) : (
        <span className="employee-events-status-pill danger">
          <AlertCircle size={14} strokeWidth={2} aria-hidden />
          {ec.cardNeedHelpShort}
        </span>
      )}
    </>
  ) : (
    <>
      <span className="employee-events-status-pill closed">{ec.cardClosedBadge}</span>
      {latest?.status === 'safe' ? (
        <span className="employee-events-closed-safe">
          <CheckCircle2 size={14} className="text-safe" aria-hidden />
          {ec.dualPersonalSafeClosed}
        </span>
      ) : latest?.status === 'need_help' ? (
        <span className="employee-events-closed-safe danger-text">
          <AlertCircle size={14} aria-hidden />
          {ec.dualPersonalNeedClosed}
        </span>
      ) : (
        <span className="employee-events-status-hint muted">{ec.dualNoPersonalSubmissionClosed}</span>
      )}
    </>
  );

  const teamMini = (
    <div className="member-event-team-mini-badges" role="group" aria-label={ec.dualAriaTeamSummary}>
      <span className="member-team-pill safe">
        <CheckCircle2 size={12} strokeWidth={2.25} aria-hidden />
        {ec.teamMiniSafe(teamCounts.safe)}
      </span>
      <span className={`member-team-pill${teamCounts.needHelp > 0 ? ' danger' : ''}`}>
        <AlertCircle size={12} strokeWidth={2.25} aria-hidden />
        {ec.teamMiniNeed(teamCounts.needHelp)}
      </span>
      <span className="member-team-pill muted">
        <Hourglass size={12} strokeWidth={2} aria-hidden />
        {ec.teamMiniPending(teamCounts.pending)}
      </span>
    </div>
  );

  return (
    <div className="member-event-shell">
      <div className="member-event-shell-top employee-events-card-inner">
        <div className={`employee-events-card-stripe ee-stripe-bg-${stripeClass}`} aria-hidden />
        <div className="employee-events-card-main member-event-shell-top-main">
          <div className="employee-events-card-icon" aria-hidden>
            <Icon size={22} strokeWidth={1.85} />
          </div>
          <div className="employee-events-card-body">
            <div className="employee-events-card-title">{event.title}</div>
            <div className="employee-events-meta">
              <span className="employee-events-meta-dot">
                {event.type}
                {deptLabel ? <> · {deptLabel}</> : null}
              </span>
            </div>
            <div className="employee-events-meta subtle">{formatEmployeeCardTime(event.startAt, locale)}</div>
            {event.venue ? <div className="employee-events-meta subtle">{event.venue}</div> : null}
          </div>
        </div>
      </div>

      <div className="member-event-dual-actions">
        <button
          type="button"
          className={`member-event-action-tile member-event-action-tile--personal${
            selectedPersonalEventId === event.id ? ' is-selected' : ''
          }`}
          onClick={() => onOpenPersonal(event.id)}
        >
          <span className="member-event-action-label">{ec.dualYourResponse}</span>
          <div className="member-event-action-summary">
            <div>{personalMini}</div>
            <ChevronRight className="member-event-action-chevron" size={18} strokeWidth={2.25} aria-hidden />
          </div>
        </button>
        <button
          type="button"
          className={`member-event-action-tile member-event-action-tile--team${
            selectedTeamEventId === event.id ? ' is-selected' : ''
          }`}
          onClick={() => onOpenTeam(event.id)}
        >
          <span className="member-event-action-label">{ec.dualTeamOverview(teamCounts.total)}</span>
          <div className="member-event-action-summary member-event-action-summary--team">
            <div>{teamMini}</div>
            <ChevronRight className="member-event-action-chevron" size={18} strokeWidth={2.25} aria-hidden />
          </div>
        </button>
      </div>
    </div>
  );
}

function MemberEventTeamCard({
  event,
  teamCounts,
  filterTab,
  selectedTeamEventId,
  onOpenTeam,
}: {
  event: EventItem;
  teamCounts: { total: number; safe: number; needHelp: number; pending: number };
  filterTab: 'ongoing' | 'closed';
  selectedTeamEventId: string;
  onOpenTeam: (eventId: string) => void;
}) {
  const { locale } = useLocale();
  const ec = getStrings(locale).employee;
  const Icon = employeeEventTypeIcon(event.type);
  const deptLabel = event.cardDepartment ?? '';
  const isOngoingTab = filterTab === 'ongoing';
  let stripeClass: string;
  if (!isOngoingTab) stripeClass = 'muted';
  else if (teamCounts.needHelp > 0) stripeClass = 'danger';
  else if (teamCounts.pending > 0) stripeClass = 'pending';
  else if (teamCounts.safe > 0) stripeClass = 'safe';
  else stripeClass = 'muted';

  const teamMini = (
    <div className="member-event-team-mini-badges" role="group" aria-label={ec.dualAriaTeamSummary}>
      <span className="member-team-pill safe">
        <CheckCircle2 size={12} strokeWidth={2.25} aria-hidden />
        {ec.teamMiniSafe(teamCounts.safe)}
      </span>
      <span className={`member-team-pill${teamCounts.needHelp > 0 ? ' danger' : ''}`}>
        <AlertCircle size={12} strokeWidth={2.25} aria-hidden />
        {ec.teamMiniNeed(teamCounts.needHelp)}
      </span>
      <span className="member-team-pill muted">
        <Hourglass size={12} strokeWidth={2} aria-hidden />
        {ec.teamMiniPending(teamCounts.pending)}
      </span>
    </div>
  );

  return (
    <button
      type="button"
      className={`member-event-shell member-event-shell--team-only member-event-team-fullbtn${
        selectedTeamEventId === event.id ? ' is-selected' : ''
      }`}
      onClick={() => onOpenTeam(event.id)}
    >
      <div className="member-event-shell-top employee-events-card-inner">
        <div className={`employee-events-card-stripe ee-stripe-bg-${stripeClass}`} aria-hidden />
        <div className="employee-events-card-main member-event-shell-top-main">
          <div className="employee-events-card-icon" aria-hidden>
            <Icon size={22} strokeWidth={1.85} />
          </div>
          <div className="employee-events-card-body">
            <div className="employee-events-card-title">{event.title}</div>
            <div className="employee-events-meta">
              <span className="employee-events-meta-dot">
                {event.type}
                {deptLabel ? <> · {deptLabel}</> : null}
              </span>
            </div>
            <div className="employee-events-meta subtle">{formatEmployeeCardTime(event.startAt, locale)}</div>
            {event.venue ? <div className="employee-events-meta subtle">{event.venue}</div> : null}
          </div>
        </div>
      </div>
      <div className="member-event-team-only-footer">
        <span className="member-event-action-label">{ec.dualTeamOverview(teamCounts.total)}</span>
        <div className="member-event-action-summary member-event-action-summary--team member-event-team-only-summary">
          {teamMini}
          <ChevronRight className="member-event-action-chevron" size={18} strokeWidth={2.25} aria-hidden />
        </div>
      </div>
    </button>
  );
}

export function MemberEventListPage({
  mode,
  rows,
  selectedPersonalEventId,
  selectedTeamEventId,
  onOpenPersonal,
  onOpenTeam,
  employeeEventFilter,
  setEmployeeEventFilter,
  ongoingCount,
  closedCount,
  searchQuery,
  setSearchQuery,
}: {
  mode: 1 | 2 | 3;
  rows: MemberHomeRow[];
  selectedPersonalEventId: string;
  selectedTeamEventId: string;
  onOpenPersonal: (eventId: string) => void;
  onOpenTeam: (eventId: string) => void;
  employeeEventFilter: 'ongoing' | 'closed';
  setEmployeeEventFilter: (value: 'ongoing' | 'closed') => void;
  ongoingCount: number;
  closedCount: number;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}) {
  const pendingRows =
    employeeEventFilter === 'ongoing' ? rows.filter((r) => !(mode === 3 ? false : Boolean(r.latest))) : [];
  const respondedRows =
    employeeEventFilter === 'ongoing' ? rows.filter((r) => (mode === 3 ? false : Boolean(r.latest))) : [];

  const subtitleHero =
    mode === 3
      ? 'Review direct reports\' safety responses for events that include your department.'
      : mode === 2
        ? 'Submit your status and monitor your direct reports.'
        : 'Stay informed. Report your status. Stay safe.';

  const ongoingIntro =
    mode === 3 ? (
      <div className="employee-events-section-intro">
        <Users className="employee-events-intro-icon" size={22} aria-hidden />
        <div>
          <h3>Ongoing Events</h3>
          <p>Open teams first — sorted by unanswered direct reports.</p>
        </div>
      </div>
    ) : (
      <div className="employee-events-section-intro">
        <Activity className="employee-events-intro-icon" size={22} aria-hidden />
        <div>
          <h3>Ongoing Events</h3>
          <p>Events that require your response.</p>
        </div>
      </div>
    );

  const closedIntro =
    mode === 3 ? (
      <div className="employee-events-section-intro">
        <Archive className="employee-events-intro-icon" size={22} aria-hidden />
        <div>
          <h3>Closed Events</h3>
          <p>Past incidents for your team&apos;s departments.</p>
        </div>
      </div>
    ) : (
      <div className="employee-events-section-intro">
        <Archive className="employee-events-intro-icon" size={22} aria-hidden />
        <div>
          <h3>Closed Events</h3>
          <p>Events that have ended.</p>
        </div>
      </div>
    );

  const dualOrTeamCards = ({
    pendingList,
    respondedList,
    closedFlat,
    filterTab,
  }: {
    pendingList: MemberHomeRow[];
    respondedList: MemberHomeRow[];
    closedFlat: MemberHomeRow[];
    filterTab: 'ongoing' | 'closed';
  }) => {
    if (mode === 1) {
      if (filterTab === 'closed') {
        return closedFlat.map(({ event, latest }) => (
          <EmployeeEventListCard
            key={event.id}
            event={event}
            latest={latest}
            filterTab="closed"
            selectedEventId={selectedPersonalEventId}
            onSelectEvent={(id) => onOpenPersonal(id)}
          />
        ));
      }
      return (
        <>
          {pendingList.map(({ event, latest }) => (
            <EmployeeEventListCard
              key={event.id}
              event={event}
              latest={latest}
              filterTab="ongoing"
              selectedEventId={selectedPersonalEventId}
              onSelectEvent={(id) => onOpenPersonal(id)}
            />
          ))}
          {respondedList.map(({ event, latest }) => (
            <EmployeeEventListCard
              key={event.id}
              event={event}
              latest={latest}
              filterTab="ongoing"
              selectedEventId={selectedPersonalEventId}
              onSelectEvent={(id) => onOpenPersonal(id)}
            />
          ))}
        </>
      );
    }
    if (mode === 2) {
      const renderDual = ({ event, latest, teamCounts }: MemberHomeRow) => (
        <MemberEventDualCard
          key={event.id}
          event={event}
          latest={latest}
          teamCounts={teamCounts!}
          filterTab={filterTab}
          selectedPersonalEventId={selectedPersonalEventId}
          selectedTeamEventId={selectedTeamEventId}
          onOpenPersonal={onOpenPersonal}
          onOpenTeam={onOpenTeam}
        />
      );
      if (filterTab === 'ongoing')
        return (
          <>
            {pendingList.map((row) => renderDual(row))}
            {respondedList.map((row) => renderDual(row))}
          </>
        );
      return closedFlat.map((row) => renderDual(row));
    }

    /* mode === 3 */
    const renderTeamOnly = ({ event, teamCounts }: MemberHomeRow) => (
      <MemberEventTeamCard
        key={event.id}
        event={event}
        teamCounts={teamCounts!}
        filterTab={filterTab}
        selectedTeamEventId={selectedTeamEventId}
        onOpenTeam={onOpenTeam}
      />
    );

    if (filterTab === 'ongoing')
      return (
        <>
          {pendingList.concat(respondedList).map((row) => renderTeamOnly(row))}
        </>
      );

    return closedFlat.map((row) => renderTeamOnly(row));
  };

  return (
    <section className="page-section employee-events-page">
      <header className="employee-events-hero">
        <div className="employee-events-hero-text">
          <h2 className="employee-events-title">
            <Activity className="employee-events-title-icon" aria-hidden />
            Emergency Events
          </h2>
          <p className="employee-events-subtitle">{subtitleHero}</p>
        </div>
      </header>

      <div className="employee-events-tabs pills-counted">
        <button
          className={`employee-events-tab pill ${employeeEventFilter === 'ongoing' ? 'active' : ''}`}
          onClick={() => setEmployeeEventFilter('ongoing')}
          type="button"
        >
          Ongoing ({ongoingCount})
        </button>
        <button
          className={`employee-events-tab pill ${employeeEventFilter === 'closed' ? 'active' : ''}`}
          onClick={() => setEmployeeEventFilter('closed')}
          type="button"
        >
          Closed ({closedCount})
        </button>
      </div>

      <div className="employee-events-toolbar">
        <label className="employee-events-search">
          <Search className="employee-events-search-icon" size={18} aria-hidden />
          <input
            type="search"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="button" className="employee-events-filter-btn" aria-label="Filter events">
          <Filter size={18} />
        </button>
      </div>

      {employeeEventFilter === 'ongoing' ? ongoingIntro : closedIntro}

      <div className="employee-events-card-list">
        {employeeEventFilter === 'ongoing' ? (
          <>
            {(mode !== 3 && pendingRows.length > 0) || (mode === 3 && rows.length > 0) ? (
              <div
                className={`employee-events-status-group employee-events-status-group--pending${mode === 3 ? ' member-mode3-single-list' : ''}`}
              >
                {mode !== 3 ? (
                  <h4 className="employee-events-group-heading">
                    Not responded yet
                    <span className="employee-events-group-count">{pendingRows.length}</span>
                  </h4>
                ) : (
                  <h4 className="employee-events-group-heading">
                    Active
                    <span className="employee-events-group-count">{rows.length}</span>
                  </h4>
                )}
                <div className="employee-events-group-cards">
                  {mode === 3 ? (
                    dualOrTeamCards({
                      pendingList: rows,
                      respondedList: [],
                      closedFlat: [],
                      filterTab: 'ongoing',
                    })
                  ) : (
                    dualOrTeamCards({
                      pendingList: pendingRows,
                      respondedList: [],
                      closedFlat: [],
                      filterTab: 'ongoing',
                    })
                  )}
                </div>
              </div>
            ) : null}
            {mode !== 3 ? (
              <>
                {respondedRows.length > 0 ? (
                  <div
                    className={`employee-events-status-group employee-events-status-group--responded${
                      pendingRows.length > 0 ? ' employee-events-status-group--after-pending' : ''
                    }`}
                  >
                    <h4 className="employee-events-group-heading">
                      Responded
                      <span className="employee-events-group-count">{respondedRows.length}</span>
                    </h4>
                    <div className="employee-events-group-cards">
                      {dualOrTeamCards({
                        pendingList: [],
                        respondedList: respondedRows,
                        closedFlat: [],
                        filterTab: 'ongoing',
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          dualOrTeamCards({
            pendingList: [],
            respondedList: [],
            closedFlat: rows,
            filterTab: 'closed',
          })
        )}
      </div>

      {rows.length === 0 ? (
        <div className="empty employee-events-empty">No events match this filter.</div>
      ) : null}
    </section>
  );
}

function EventSelectionPage({
  title,
  events,
  selectedEventId,
  onSelectEvent,
}: {
  title: string;
  events: EventItem[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
}) {
  return (
    <section className="page-section">
      <h2>{title}</h2>
      <div className="event-card-row single-column">
        {events.map((event) => (
          <button key={event.id} className={selectedEventId === event.id ? 'event-mini-card active' : 'event-mini-card'} onClick={() => onSelectEvent(event.id)} type="button">
            <strong>{event.title}</strong>
            <span>{event.type}</span>
            <small>{event.status}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function formatFileSize(bytes?: number | null) {
  if (bytes == null || bytes <= 0) return '—';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

interface EditDraftBaseline {
  comment: string;
  location: string;
  attachment: File | null;
  selectedNeedHelp: boolean;
  pendingSubmission: 'safe' | 'need_help' | null;
  omitStoredAttachment: boolean;
}

function EmployeeQuickReportPanel({
  draftUserId,
  userName,
  selectedEvent,
  currentDepartment,
  latestResponse,
  reportSubmitting,
  submitErrorMessage,
  onDismissSubmitError,
  onRetrySubmit,
  onSubmit,
  layout = 'full',
  hideEmergencyContact = false,
  stackSectionId,
  onBackToEvents,
  stackInitialReport = false,
}: {
  draftUserId: string | null;
  userName: string;
  selectedEvent: EventItem | null;
  currentDepartment: string;
  latestResponse?: SafetyResponse;
  reportSubmitting: boolean;
  submitErrorMessage: string | null;
  onDismissSubmitError: () => void;
  onRetrySubmit: () => void;
  onSubmit: (
    status: 'safe' | 'need_help',
    fields: EmployeeReportFields,
    meta?: { omitStoredAttachment?: boolean },
  ) => void | Promise<void>;
  layout?: 'full' | 'embedded';
  /** 堆疊卡片用於 a11y 與捲動錨點 */
  stackSectionId?: string;
  hideEmergencyContact?: boolean;
  onBackToEvents?: () => void;
  /** 待回報首報：窄列＋雙大鈕、送出僅 status、成功 overlay */
  stackInitialReport?: boolean;
}) {
  const { locale } = useLocale();
  const ec = getStrings(locale).employee;
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const helpDetailsRef = useRef<HTMLDivElement>(null);
  const persistDraftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [employeeComment, setEmployeeComment] = useState('');
  const [employeeLocation, setEmployeeLocation] = useState('');
  const [employeeAttachment, setEmployeeAttachment] = useState<File | null>(null);
  const [selectedNeedHelp, setSelectedNeedHelp] = useState(false);
  const [wantToUpdate, setWantToUpdate] = useState(false);
  const [draftBaseline, setDraftBaseline] = useState<EditDraftBaseline | null>(null);
  const [pendingSubmission, setPendingSubmission] = useState<'safe' | 'need_help' | null>(null);
  const [discardPromptAfter, setDiscardPromptAfter] = useState<'back' | 'cancel' | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [omitStoredAttachment, setOmitStoredAttachment] = useState(false);
  const [initialSuccessOverlayOpen, setInitialSuccessOverlayOpen] = useState(false);

  const MAX_COMMENT_LEN = 500;
  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

  const hasReport = Boolean(latestResponse);
  const showReportingControls = !hasReport || wantToUpdate;
  const isRevisionDraft = Boolean(hasReport && wantToUpdate);

  /** 詳細區塊：初次回報在選「需要協助」後顯示；修訂草稿在選 need help 或已暫存 need_help 時顯示 */
  const showHelpDetailsPanel =
    selectedNeedHelp || (isRevisionDraft && pendingSubmission === 'need_help');

  const needFlowActive =
    (!isRevisionDraft && selectedNeedHelp) || (isRevisionDraft && (selectedNeedHelp || pendingSubmission === 'need_help'));

  const safeButtonDimmed = needFlowActive && (!isRevisionDraft || pendingSubmission !== 'safe');
  const revertToBaselineAndExitEdit = (baseline: EditDraftBaseline) => {
    setEmployeeComment(baseline.comment);
    setEmployeeLocation(baseline.location);
    setEmployeeAttachment(baseline.attachment);
    setSelectedNeedHelp(baseline.selectedNeedHelp);
    setPendingSubmission(baseline.pendingSubmission);
    setOmitStoredAttachment(baseline.omitStoredAttachment);
    setWantToUpdate(false);
    setDraftBaseline(null);
  };

  const isDraftDirty =
    draftBaseline !== null &&
    (employeeComment !== draftBaseline.comment ||
      employeeLocation !== draftBaseline.location ||
      employeeAttachment !== draftBaseline.attachment ||
      selectedNeedHelp !== draftBaseline.selectedNeedHelp ||
      pendingSubmission !== draftBaseline.pendingSubmission ||
      omitStoredAttachment !== draftBaseline.omitStoredAttachment);

  useEffect(() => {
    setWantToUpdate(false);
    setPendingSubmission(null);
    setDraftBaseline(null);
    setOmitStoredAttachment(false);

    const eid = selectedEvent?.id;
    if (!eid || !draftUserId) return;
    if (latestResponse) return;

    const stored = loadEmployeeReportDraft(draftUserId, eid);
    setEmployeeComment(stored?.comment ?? '');
    setEmployeeLocation(stored?.location ?? '');
    setSelectedNeedHelp(false);
  }, [selectedEvent?.id, draftUserId, latestResponse?.id]);

  useEffect(() => {
    if (!draftUserId || !selectedEvent?.id || Boolean(latestResponse) || wantToUpdate) return;
    if (stackInitialReport) return;
    if (persistDraftTimer.current) window.clearTimeout(persistDraftTimer.current);
    persistDraftTimer.current = window.setTimeout(() => {
      saveEmployeeReportDraft(draftUserId, selectedEvent.id, {
        comment: employeeComment,
        location: employeeLocation,
        selectedNeedHelp,
      });
    }, 420);
    return () => {
      if (persistDraftTimer.current) window.clearTimeout(persistDraftTimer.current);
    };
  }, [
    draftUserId,
    selectedEvent?.id,
    latestResponse,
    wantToUpdate,
    employeeComment,
    employeeLocation,
    selectedNeedHelp,
    stackInitialReport,
  ]);


  const prevLatestResponseIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    prevLatestResponseIdRef.current = undefined;
    setInitialSuccessOverlayOpen(false);
  }, [selectedEvent?.id]);

  useEffect(() => {
    const lid = latestResponse?.id;
    if (!stackInitialReport || !lid) return;
    if (prevLatestResponseIdRef.current !== lid) {
      prevLatestResponseIdRef.current = lid;
      setInitialSuccessOverlayOpen(true);
    }
  }, [stackInitialReport, latestResponse?.id]);

  useEffect(() => {
    if (latestResponse) setWantToUpdate(false);
  }, [latestResponse?.updatedAt]);

  useEffect(() => {
    if (!showHelpDetailsPanel) return;
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        helpDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [showHelpDetailsPanel]);

  useEffect(() => {
    if (!wantToUpdate) setDraftBaseline(null);
  }, [wantToUpdate]);

  const reportFields = (): EmployeeReportFields => ({
    comment: employeeComment,
    location: employeeLocation,
    attachment: employeeAttachment,
  });

  const handleSubmitSafeTap = () => {
    if (reportSubmitting) return;
    if (isRevisionDraft) {
      setPendingSubmission('safe');
      setSelectedNeedHelp(false);
      return;
    }
    setSelectedNeedHelp(false);
    const fields = stackInitialReport ? EMPTY_STACK_REPORT_FIELDS : reportFields();
    void onSubmit('safe', fields, {
      omitStoredAttachment: stackInitialReport ? false : omitStoredAttachment,
    });
  };

  const handleNeedHelpTap = () => {
    if (reportSubmitting) return;
    if (isRevisionDraft) {
      setPendingSubmission('need_help');
      setSelectedNeedHelp(true);
      return;
    }
    setSelectedNeedHelp(true);
  };

  const handleConfirmNeedHelp = () => {
    if (reportSubmitting) return;
    if (isRevisionDraft) return;
    if (!selectedNeedHelp) return;
    void onSubmit('need_help', reportFields(), {
      omitStoredAttachment: stackInitialReport ? false : omitStoredAttachment,
    });
  };

  const enterRevisionMode = () => {
    if (!latestResponse) return;
    const wasNeedHelp = latestResponse.status === 'need_help';
    const pendingInit = wasNeedHelp ? 'need_help' : 'safe';
    const c = latestResponse.comment ?? '';
    const loc = latestResponse.location ?? '';
    setEmployeeComment(c);
    setEmployeeLocation(loc);
    setEmployeeAttachment(null);
    setUploadNotice(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    setDraftBaseline({
      comment: c,
      location: loc,
      attachment: null,
      selectedNeedHelp: wasNeedHelp,
      pendingSubmission: pendingInit,
      omitStoredAttachment: false,
    });
    setOmitStoredAttachment(false);
    setWantToUpdate(true);
    setPendingSubmission(pendingInit);
    setSelectedNeedHelp(wasNeedHelp);
  };

  const confirmDiscardDraft = () => {
    const reason = discardPromptAfter;
    if (draftBaseline) revertToBaselineAndExitEdit(draftBaseline);
    setDiscardPromptAfter(null);
    if (reason === 'back') onBackToEvents?.();
  };

  const requestBackNavigation = () => {
    if (isRevisionDraft && isDraftDirty) {
      setDiscardPromptAfter('back');
      return;
    }
    onBackToEvents?.();
  };

  const requestCancelRevision = () => {
    if (!draftBaseline || !isRevisionDraft) return;
    if (isDraftDirty) {
      setDiscardPromptAfter('cancel');
      return;
    }
    revertToBaselineAndExitEdit(draftBaseline);
  };

  const handleSaveRevision = () => {
    if (reportSubmitting) return;
    if (!pendingSubmission || !isRevisionDraft) return;
    void onSubmit(pendingSubmission, reportFields(), { omitStoredAttachment });
  };

  const applyAttachment = (file: File | undefined | null) => {
    setUploadNotice(null);
    if (!file) {
      setEmployeeAttachment(null);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadNotice(ec.uploadTooBig);
      return;
    }
    setOmitStoredAttachment(false);
    setEmployeeAttachment(file);
  };

  if (!selectedEvent) return null;

  const fieldId = selectedEvent.id.replace(/[^a-zA-Z0-9_-]/g, '');
  const heroTime = new Date(selectedEvent.startAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const fullHero =
    layout === 'full' ? (
      <header className="employee-event-hero">
        <button className="employee-event-back" type="button" onClick={requestBackNavigation} aria-label={ec.backToEventsAria}>
          <ChevronLeft size={24} strokeWidth={2.25} aria-hidden />
        </button>
        <div className="employee-event-hero-art" aria-hidden />
        <div className="employee-event-hero-body">
          <div className="employee-event-icon-ring">
            <Activity size={36} strokeWidth={1.6} aria-hidden />
          </div>
          <h1 className="employee-event-headline">{selectedEvent.title}</h1>
          <p className="employee-event-subline">
            {hasReport && wantToUpdate
              ? ec.heroSublineDraft
              : hasReport && !wantToUpdate
                ? '\u00a0'
                : ec.heroSublineReporting(userName)}
          </p>
          <div className="employee-event-meta-pill">
            <span className="employee-event-meta-item">
              <span className="employee-event-meta-ic" aria-hidden>
                ●
              </span>
              {selectedEvent.type}
            </span>
            <span className="employee-event-meta-split" aria-hidden />
            <span className="employee-event-meta-item">{currentDepartment}</span>
            <span className="employee-event-meta-split" aria-hidden />
            <span className="employee-event-meta-item">{heroTime}</span>
          </div>
        </div>
      </header>
    ) : null;

  return (
    <>
      {fullHero}
      {reportSubmitting ? (
        <p className="employee-submit-progress" aria-live="polite">
          {ec.submitting}
        </p>
      ) : null}
      {submitErrorMessage ? (
        <div className="employee-submit-error-banner" role="alert">
          <AlertCircle size={22} aria-hidden />
          <div className="employee-submit-error-body">
            <strong>{ec.submitFailTitle}</strong>
            <p>{submitErrorMessage}</p>
            <div className="employee-submit-error-actions">
              <button type="button" className="btn primary" disabled={reportSubmitting} onClick={onRetrySubmit}>
                <RefreshCw size={16} aria-hidden /> {ec.retry}
              </button>
              <button type="button" className="btn ghost" onClick={onDismissSubmitError}>
                {ec.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`employee-event-body${layout === 'embedded' ? ' employee-quick-report-body--embedded' : ''}`}
        id={stackSectionId}
      >
        <div className={`employee-event-shell${isRevisionDraft ? ' employee-event-shell--revision' : ''}`}>
              {!showReportingControls && latestResponse && !stackInitialReport ? (
                <>
                  <div className="employee-submit-success-banner">
                    <CheckCircle2 className="employee-submit-success-ic" size={40} strokeWidth={2} aria-hidden />
                    <div className="employee-submit-success-copy">
                      <strong>Report Submitted</strong>
                      <p>Your status has been shared with your emergency response team.</p>
                    </div>
                  </div>

                  <article className="event-detail-card employee-status-overview-card">
                    <h3 className="employee-section-title">
                      <Users size={22} strokeWidth={1.75} className="employee-section-title-icon" aria-hidden />
                      Your current status
                    </h3>
                    <div className="employee-status-overview-grid">
                      <div
                        className={`employee-status-slot ${latestResponse.status === 'safe' ? 'employee-status-slot--active-safe' : 'employee-status-slot--muted'}`}
                      >
                        {latestResponse.status === 'safe' ? (
                          <span className="employee-status-slot-check" aria-hidden>
                            <CheckCircle2 size={22} strokeWidth={2} />
                          </span>
                        ) : null}
                        <ShieldCheck size={28} strokeWidth={1.5} aria-hidden />
                        <div>
                          <div className="employee-status-slot-title">I&apos;m Safe</div>
                          <div className="employee-status-slot-hint">{latestResponse.status === 'safe' ? 'This is the status you submitted.' : 'Not selected.'}</div>
                        </div>
                      </div>
                      <div
                        className={`employee-status-slot ${latestResponse.status === 'need_help' ? 'employee-status-slot--active-help' : 'employee-status-slot--muted'}`}
                      >
                        {latestResponse.status === 'need_help' ? (
                          <span className="employee-status-slot-check employee-status-slot-check--help" aria-hidden>
                            <CheckCircle2 size={22} strokeWidth={2} />
                          </span>
                        ) : null}
                        <LifeBuoy size={28} strokeWidth={1.5} aria-hidden />
                        <div>
                          <div className="employee-status-slot-title">I need help</div>
                          <div className="employee-status-slot-hint">{latestResponse.status === 'need_help' ? 'This is the status you submitted.' : 'Not selected.'}</div>
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="event-detail-card employee-summary-card">
                    <h3 className="employee-section-title">
                      <ClipboardList size={22} strokeWidth={1.75} className="employee-section-title-icon" aria-hidden />
                      Submitted summary
                    </h3>
                    <dl className="employee-summary-rows">
                      <div className="employee-summary-row">
                        <dt>Status</dt>
                        <dd>
                          <span className={latestResponse.status === 'safe' ? 'employee-pill-safe' : 'employee-pill-help'}>
                            {latestResponse.status === 'safe' ? "I'm Safe" : 'I need help'}
                          </span>
                        </dd>
                      </div>
                      <div className="employee-summary-row">
                        <dt>{ec.submittedAtLabel}</dt>
                        <dd>
                          {(() => {
                            const t = new Date(latestResponse.updatedAt);
                            const tag = locale === 'en' ? 'en-US' : 'zh-TW';
                            return `${t.toLocaleTimeString(tag, { hour: 'numeric', minute: '2-digit' })} (${t.toLocaleTimeString(tag, {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: true,
                            })})`;
                          })()}
                        </dd>
                      </div>
                      <div className="employee-summary-row">
                        <dt>{ec.locationLabel}</dt>
                        <dd>{latestResponse.location?.trim() || '—'}</dd>
                      </div>
                      <div className="employee-summary-row">
                        <dt>{ec.commentLabel}</dt>
                        <dd>{latestResponse.comment?.trim() || '—'}</dd>
                      </div>
                      <div className="employee-summary-row employee-summary-row--files">
                        <dt>{ec.attachTitle}</dt>
                        <dd>
                          {latestResponse.attachmentName ? (
                            <span className="employee-file-chip">
                              <FileImage size={18} strokeWidth={1.75} aria-hidden />
                              <span>
                                <strong>{latestResponse.attachmentName}</strong>
                                <span className="employee-file-chip-meta">{formatFileSize(latestResponse.attachmentSizeBytes)}</span>
                              </span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </dd>
                      </div>
                    </dl>

                    <div className="employee-summary-actions">
                      <button type="button" className="btn btn-navy-solid" onClick={enterRevisionMode}>
                        <Pencil size={18} strokeWidth={2} aria-hidden /> {ec.editReport}
                      </button>
                      <button type="button" className="btn employee-btn-outline" onClick={() => onBackToEvents?.()}>
                        {ec.done}
                      </button>
                    </div>
                  </article>
                </>
              ) : null}
              {!showReportingControls && latestResponse && stackInitialReport && !wantToUpdate && !initialSuccessOverlayOpen ? (
                <div className="member-initial-report-done">
                  <CheckCircle2 size={36} strokeWidth={2} className="member-initial-report-done-ic" aria-hidden />
                  <div className="member-initial-report-done-copy">
                    <strong>{ec.reportSuccessTitle}</strong>
                    <p className="muted-text">
                      {latestResponse.status === 'safe' ? ec.statusDetailSafe : ec.statusDetailNeedHelp}
                    </p>
                    <button type="button" className="btn primary btn-block" onClick={enterRevisionMode}>
                      {ec.supplementOrUpdate}
                    </button>
                  </div>
                </div>
              ) : null}
              {showReportingControls ? (
                <>
                  {isRevisionDraft ? (
                    <aside className="employee-edit-alert" role="status">
                      <Info size={22} strokeWidth={2} className="employee-edit-alert-icon" aria-hidden />
                      <div>
                        <strong>Editing submitted report</strong>
                        <p>You can update your information and save your changes.</p>
                      </div>
                    </aside>
                  ) : null}

                  {stackInitialReport && !isRevisionDraft ? (
                    <>
                      <div className={`member-initial-report-actions${reportSubmitting ? ' is-disabled' : ''}`}>
                        <button
                          type="button"
                          disabled={reportSubmitting}
                          className={`employee-status-wide safe member-initial-report-btn${safeButtonDimmed ? ' is-dimmed' : ''}`}
                          onClick={handleSubmitSafeTap}
                        >
                          <span className="employee-status-inner">
                            <span className="employee-status-ic" aria-hidden>
                              <ShieldCheck size={28} strokeWidth={1.65} />
                            </span>
                            <span className="employee-status-label">I&apos;m Safe</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={reportSubmitting}
                          className={`employee-status-wide need member-initial-report-btn${selectedNeedHelp ? ' is-selected' : ''}`}
                          onClick={handleNeedHelpTap}
                        >
                          <span className="employee-status-inner">
                            <span className="employee-status-ic" aria-hidden>
                              <LifeBuoy size={28} strokeWidth={1.65} />
                            </span>
                            <span className="employee-status-label">I need help</span>
                          </span>
                        </button>
                      </div>
                    </>
                  ) : (
                  <article className="event-detail-card">
                    <div className="event-detail-card-head">
                      <span className="event-detail-card-icon">
                        <Users size={22} strokeWidth={1.75} aria-hidden />
                      </span>
                      <h3>{ec.reportCardTitle}</h3>
                    </div>
                    <div className={`employee-status-row${isRevisionDraft ? ' employee-status-row--revision' : ''}`}>
                      <button
                        type="button"
                        disabled={reportSubmitting}
                        className={
                          isRevisionDraft
                            ? `employee-status-revision-btn employee-status-revision-btn--safe${pendingSubmission === 'safe' ? ' is-selected' : ''}`
                            : `employee-status-wide safe ${safeButtonDimmed ? 'is-dimmed' : ''}`
                        }
                        onClick={handleSubmitSafeTap}
                      >
                        {isRevisionDraft && pendingSubmission === 'safe' ? (
                          <span className="employee-revision-corner-badge employee-revision-corner-badge--safe" aria-hidden>
                            <CheckCircle2 size={22} strokeWidth={2.25} />
                          </span>
                        ) : null}
                        <span className="employee-status-inner">
                          <span className="employee-status-ic" aria-hidden>
                            <ShieldCheck size={28} strokeWidth={1.65} />
                          </span>
                          <span className="employee-status-label">I&apos;m Safe</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={reportSubmitting}
                        className={
                          isRevisionDraft
                            ? `employee-status-revision-btn employee-status-revision-btn--need${pendingSubmission === 'need_help' ? ' is-selected' : ''}`
                            : `employee-status-wide need`
                        }
                        onClick={handleNeedHelpTap}
                      >
                        {isRevisionDraft && needFlowActive ? (
                          <span className="employee-choice-check" aria-hidden>
                            ✓
                          </span>
                        ) : null}
                        {isRevisionDraft && pendingSubmission === 'need_help' ? (
                          <span className="employee-revision-corner-badge employee-revision-corner-badge--need" aria-hidden>
                            <CheckCircle2 size={22} strokeWidth={2.25} />
                          </span>
                        ) : null}
                        <span className="employee-status-inner">
                          <span className="employee-status-ic" aria-hidden>
                            <LifeBuoy size={28} strokeWidth={1.65} />
                          </span>
                          <span className="employee-status-label">I need help</span>
                        </span>
                      </button>
                    </div>
                  </article>
                  )}

                  {!isRevisionDraft && showReportingControls && selectedNeedHelp ? (
                    <div ref={helpDetailsRef} className="employee-help-details-panel">
                      <article className="event-detail-card">
                        <div className="event-detail-card-head">
                          <span className="event-detail-card-icon">
                            <ClipboardList size={22} strokeWidth={1.75} aria-hidden />
                          </span>
                          <h3>
                            {ec.supplementaryTitle}{' '}
                            <span className="employee-optional-hint">（{ec.optionalBadge}）</span>
                          </h3>
                        </div>
                        <div className="employee-fields">
                          <label className="employee-field-label" htmlFor={`emp-loc-${fieldId}`}>
                            {ec.locationLabel}
                          </label>
                          <div className="input-with-leading-icon">
                            <span className="input-leading-ic" aria-hidden>
                              <MapPin size={19} strokeWidth={2} color="#3d5f85" />
                            </span>
                            <input
                              id={`emp-loc-${fieldId}`}
                              placeholder={ec.locationPlaceholder}
                              disabled={reportSubmitting}
                              value={employeeLocation}
                              onChange={(e) => setEmployeeLocation(e.target.value)}
                            />
                          </div>

                          <label className="employee-field-label" htmlFor={`emp-comment-${fieldId}`}>
                            {ec.commentLabel}
                          </label>
                          <div className="textarea-with-leading-icon">
                            <span className="input-leading-ic textarea-leading" aria-hidden>
                              <MessageSquare size={19} strokeWidth={2} color="#3d5f85" />
                            </span>
                            <textarea
                              id={`emp-comment-${fieldId}`}
                              placeholder={ec.commentPlaceholder}
                              disabled={reportSubmitting}
                              value={employeeComment}
                              maxLength={MAX_COMMENT_LEN}
                              onChange={(e) => setEmployeeComment(e.target.value.slice(0, MAX_COMMENT_LEN))}
                            />
                            <span className="employee-char-count">{employeeComment.length}/{MAX_COMMENT_LEN}</span>
                          </div>
                        </div>
                      </article>

                      <article className="event-detail-card">
                        <div className="event-detail-card-head">
                          <span className="event-detail-card-icon">
                            <Paperclip size={22} strokeWidth={1.75} aria-hidden />
                          </span>
                          <h3>
                            {ec.attachTitle}{' '}
                            <span className="employee-optional-hint">（{ec.optionalBadge}）</span>
                          </h3>
                        </div>
                        <input
                          ref={attachmentInputRef}
                          id={`emp-file-${fieldId}`}
                          type="file"
                          className="visually-hidden-input"
                          onChange={(e) => applyAttachment(e.target.files?.[0])}
                        />
                        <label
                          htmlFor={`emp-file-${fieldId}`}
                          className={`employee-drop-zone${dropActive ? ' is-dragging' : ''}${employeeAttachment ? ' has-file' : ''}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDropActive(true);
                          }}
                          onDragLeave={() => setDropActive(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDropActive(false);
                            applyAttachment(e.dataTransfer.files?.[0]);
                          }}
                        >
                          <span className="employee-drop-ic" aria-hidden>
                            <CloudUpload size={46} strokeWidth={1.45} color="#1e5494" />
                          </span>
                          <span className="employee-drop-title">{ec.dropTitle}</span>
                          <span className="employee-drop-hint">{ec.dropHint}</span>
                          {employeeAttachment ? <span className="employee-drop-file">{employeeAttachment.name}</span> : null}
                          {uploadNotice ? <span className="employee-drop-error">{uploadNotice}</span> : null}
                        </label>
                        {employeeAttachment ? (
                          <button
                            type="button"
                            className="btn ghost btn-remove-att"
                            onClick={() => {
                              if (attachmentInputRef.current) attachmentInputRef.current.value = '';
                              applyAttachment(null);
                            }}
                          >
                            {ec.removeAttachment}
                          </button>
                        ) : null}
                      </article>
                      <button
                        type="button"
                        className="btn primary btn-block employee-submit-need-help"
                        disabled={reportSubmitting}
                        onClick={handleConfirmNeedHelp}
                      >
                        {ec.submitNeedHelp}
                      </button>
                    </div>
                  ) : null}

                  {isRevisionDraft && showHelpDetailsPanel ? (
                    <div ref={helpDetailsRef} className="employee-help-details-panel">
                    <article className="event-detail-card">
                      <div className="event-detail-card-head">
                        <span className="event-detail-card-icon">
                          <ClipboardList size={22} strokeWidth={1.75} aria-hidden />
                        </span>
                        <h3>{ec.revisionDetailsHeading}</h3>
                      </div>
                      <div className="employee-fields">
                        <label className="employee-field-label" htmlFor={`emp-loc-rev-${fieldId}`}>
                          {ec.locationLabel}
                        </label>
                        <div className="input-with-leading-icon">
                          <span className="input-leading-ic" aria-hidden>
                            <MapPin size={19} strokeWidth={2} color="#3d5f85" />
                          </span>
                          <input
                            id={`emp-loc-rev-${fieldId}`}
                            placeholder={ec.locationPlaceholder}
                            disabled={reportSubmitting}
                            value={employeeLocation}
                            onChange={(e) => setEmployeeLocation(e.target.value)}
                          />
                        </div>

                        <label className="employee-field-label" htmlFor={`emp-comment-rev-${fieldId}`}>
                          {ec.commentLabel}
                        </label>
                        <div className="textarea-with-leading-icon">
                          <span className="input-leading-ic textarea-leading" aria-hidden>
                            <MessageSquare size={19} strokeWidth={2} color="#3d5f85" />
                          </span>
                          <textarea
                            id={`emp-comment-rev-${fieldId}`}
                            placeholder={ec.commentPlaceholder}
                            disabled={reportSubmitting}
                            value={employeeComment}
                            maxLength={MAX_COMMENT_LEN}
                            onChange={(e) => setEmployeeComment(e.target.value.slice(0, MAX_COMMENT_LEN))}
                          />
                          <span className="employee-char-count">{employeeComment.length}/{MAX_COMMENT_LEN}</span>
                        </div>
                      </div>
                    </article>

                    <article className="event-detail-card">
                      <div className="event-detail-card-head">
                        <span className="event-detail-card-icon">
                          <Paperclip size={22} strokeWidth={1.75} aria-hidden />
                        </span>
                        <h3>{ec.attachTitle}</h3>
                      </div>
                      {isRevisionDraft && latestResponse?.attachmentName && !employeeAttachment && !omitStoredAttachment ? (
                        <div className="employee-attached-existing">
                          <span className="employee-attached-thumb" aria-hidden />
                          <div className="employee-attached-meta">
                            <strong>{latestResponse.attachmentName}</strong>
                            <span>{formatFileSize(latestResponse.attachmentSizeBytes)}</span>
                          </div>
                          <div className="employee-attached-actions">
                            <button type="button" className="btn ghost btn-compact" onClick={() => attachmentInputRef.current?.click()}>
                              {ec.replaceAttachment}
                            </button>
                            <button
                              type="button"
                              className="btn ghost btn-icon-danger"
                              aria-label={ec.removeAttachmentAria}
                              onClick={() => setOmitStoredAttachment(true)}
                            >
                              <Trash2 size={18} strokeWidth={2} aria-hidden />
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <input ref={attachmentInputRef} id={`emp-file-rev-${fieldId}`} type="file" className="visually-hidden-input" onChange={(e) => applyAttachment(e.target.files?.[0])} />
                      <label
                        htmlFor={`emp-file-rev-${fieldId}`}
                        className={`employee-drop-zone${dropActive ? ' is-dragging' : ''}${employeeAttachment ? ' has-file' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDropActive(true);
                        }}
                        onDragLeave={() => setDropActive(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDropActive(false);
                          applyAttachment(e.dataTransfer.files?.[0]);
                        }}
                      >
                        <span className="employee-drop-ic" aria-hidden>
                          <CloudUpload size={46} strokeWidth={1.45} color="#1e5494" />
                        </span>
                        <span className="employee-drop-title">{ec.dropTitle}</span>
                        <span className="employee-drop-hint">{ec.dropHint}</span>
                        {employeeAttachment ? <span className="employee-drop-file">{employeeAttachment.name}</span> : null}
                        {uploadNotice ? <span className="employee-drop-error">{uploadNotice}</span> : null}
                      </label>
                      {employeeAttachment ? (
                        <button
                          type="button"
                          className="btn ghost btn-remove-att"
                          onClick={() => {
                            if (attachmentInputRef.current) attachmentInputRef.current.value = '';
                            applyAttachment(null);
                          }}
                        >
                          {ec.removeAttachment}
                        </button>
                      ) : null}
                    </article>
                  </div>
                  ) : null}
                </>
              ) : null}

              {!hideEmergencyContact ? (
              <article className="event-detail-card event-detail-card--emergency">
                <div className="event-detail-card-head">
                  <span className="event-detail-card-icon">
                    <Phone size={22} strokeWidth={1.8} aria-hidden />
                  </span>
                  <h3>{ec.emergencyContactTitle}</h3>
                </div>
                <div className="emergency-inline emergency-inline--desktop">
                  <a className="emergency-slot" href="tel:+886212345678">
                    <span className="emergency-slot-ic emergency-slot-ic--headset" aria-hidden>
                      <Headphones size={20} strokeWidth={2} />
                    </span>
                    <div>
                      <div className="emergency-slot-title">Emergency Hotline</div>
                      <div className="emergency-slot-num">+886 (2) 1234-5678</div>
                    </div>
                  </a>
                  <span className="emergency-vrule" aria-hidden />
                  <a className="emergency-slot" href="tel:+886298765432">
                    <span className="emergency-slot-ic emergency-slot-ic--people" aria-hidden>
                      <Users size={20} strokeWidth={2} />
                    </span>
                    <div>
                      <div className="emergency-slot-title">HR Duty Line</div>
                      <div className="emergency-slot-num">+886 (2) 9876-5432</div>
                    </div>
                  </a>
                </div>
                <div className="emergency-list emergency-list--narrow">
                  <a className="emergency-row" href="tel:+886212345678">
                    <span className="emergency-row-ic" aria-hidden>
                      <Headphones size={20} strokeWidth={2} />
                    </span>
                    <div className="emergency-row-text">
                      <div className="emergency-slot-title">Emergency Hotline</div>
                      <div className="emergency-slot-num">+886 (2) 1234-5678</div>
                    </div>
                    <span className="emergency-row-chevron" aria-hidden>
                      <ChevronRight size={20} strokeWidth={2} />
                    </span>
                  </a>
                  <a className="emergency-row" href="tel:+886298765432">
                    <span className="emergency-row-ic" aria-hidden>
                      <Users size={20} strokeWidth={2} />
                    </span>
                    <div className="emergency-row-text">
                      <div className="emergency-slot-title">HR Duty Line</div>
                      <div className="emergency-slot-num">+886 (2) 9876-5432</div>
                    </div>
                    <span className="emergency-row-chevron" aria-hidden>
                      <ChevronRight size={20} strokeWidth={2} />
                    </span>
                  </a>
                </div>
              </article>
              ) : null}

              <footer className={`employee-event-tagline${isRevisionDraft ? ' employee-event-tagline--revision' : ''}`}>
                Stay safe. Stay connected. ♡
              </footer>
            </div>
          </div>

          {isRevisionDraft ? (
            <footer className="employee-edit-sticky-bar">
              <div className="employee-edit-sticky-inner">
                <p className="employee-edit-sticky-meta">
                  Last updated{' '}
                  {latestResponse ? new Date(latestResponse.updatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—'}
                </p>
                <div className="employee-edit-sticky-actions">
                  <button type="button" className="btn employee-btn-outline-strong" onClick={requestCancelRevision}>
                    Discard changes
                  </button>
                  <button type="button" className="btn btn-navy-solid" disabled={!isDraftDirty || reportSubmitting} onClick={handleSaveRevision}>
                    Save changes
                  </button>
                </div>
                <p className="employee-edit-sticky-tagline">Stay safe. Stay connected. ♡</p>
              </div>
            </footer>
          ) : null}

          {stackInitialReport && latestResponse && initialSuccessOverlayOpen ? (
            <div
              className="member-report-success-overlay-backdrop"
              role="presentation"
              onClick={() => setInitialSuccessOverlayOpen(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setInitialSuccessOverlayOpen(false);
              }}
            >
              <div
                className="member-report-success-overlay-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="member-initial-success-title"
                onClick={(e) => e.stopPropagation()}
              >
                <CheckCircle2 size={52} strokeWidth={2} className="member-report-success-overlay-ic" aria-hidden />
                <h3 id="member-initial-success-title">{selectedEvent.title}</h3>
                <p className="member-report-success-overlay-status">
                  {latestResponse.status === 'safe' ? ec.overlaySubmittedSafe : ec.overlaySubmittedNeedHelp}
                </p>
                <button type="button" className="btn primary btn-block" onClick={() => setInitialSuccessOverlayOpen(false)}>
                  {ec.close}
                </button>
              </div>
            </div>
          ) : null}

          <ConfirmModal
            open={discardPromptAfter !== null}
            title="Discard unsaved changes?"
            description="You have unsaved changes to your report draft. If you leave now, those changes will be lost."
            cancelText="Continue editing"
            confirmText="Discard changes"
            onCancel={() => setDiscardPromptAfter(null)}
            onConfirm={confirmDiscardDraft}
          />
    </>
  );
}

export function EmployeeHomePage({
  draftUserId,
  userName,
  selectedEvent,
  currentDepartment,
  latestResponse,
  reportSubmitting,
  submitErrorMessage,
  onDismissSubmitError,
  onRetrySubmit,
  onSubmit,
  onBackToEvents,
}: {
  draftUserId: string | null;
  userName: string;
  selectedEvent: EventItem | null;
  currentDepartment: string;
  latestResponse?: SafetyResponse;
  reportSubmitting: boolean;
  submitErrorMessage: string | null;
  onDismissSubmitError: () => void;
  onRetrySubmit: () => void;
  onSubmit: (
    status: 'safe' | 'need_help',
    fields: EmployeeReportFields,
    meta?: { omitStoredAttachment?: boolean },
  ) => void | Promise<void>;
  onBackToEvents: () => void;
}) {
  const { locale } = useLocale();
  const ec = getStrings(locale).employee;
  return (
    <section className="employee-event-page">
      {!selectedEvent ? (
        <div className="employee-event-empty">
          <p>{ec.noEventSelected}</p>
        </div>
      ) : (
        <EmployeeQuickReportPanel
          draftUserId={draftUserId}
          userName={userName}
          selectedEvent={selectedEvent}
          currentDepartment={currentDepartment}
          latestResponse={latestResponse}
          reportSubmitting={reportSubmitting}
          submitErrorMessage={submitErrorMessage}
          onDismissSubmitError={onDismissSubmitError}
          onRetrySubmit={onRetrySubmit}
          onSubmit={onSubmit}
          layout="full"
          hideEmergencyContact={false}
          onBackToEvents={onBackToEvents}
        />
      )}
    </section>
  );
}

export function MemberPriorityHomePage({
  priorityView,
  draftUserId,
  userName,
  currentDepartment,
  responses,
  userId,
  onSubmitReport,
  onRetryReport,
  submittingEventId,
  submitErrorMessage,
  submitErrorEventId,
  onDismissSubmitError,
  idleHistoryOngoing,
  idleHistoryClosed,
  onSupplementEvent,
  supervisorTeamNudge,
  onDismissSupervisorNudge,
  onGoTeamDashboardFromNudge,
}: {
  priorityView: { kind: 'personal_stack' | 'idle'; rows: MemberHomeRow[] };
  draftUserId: string | null;
  userName: string;
  currentDepartment: string;
  responses: SafetyResponse[];
  userId: string | null;
  onSubmitReport: (
    eventId: string,
    status: 'safe' | 'need_help',
    fields: EmployeeReportFields,
    meta?: { omitStoredAttachment?: boolean },
  ) => void | Promise<void>;
  onRetryReport: () => void;
  submittingEventId: string | null;
  submitErrorMessage: string | null;
  submitErrorEventId: string | null;
  onDismissSubmitError: () => void;
  idleHistoryOngoing: MemberHomeRow[];
  idleHistoryClosed: MemberHomeRow[];
  onSupplementEvent: (eventId: string) => void;
  supervisorTeamNudge: null | { pendingPct: number; eventTitle: string };
  onDismissSupervisorNudge: () => void;
  onGoTeamDashboardFromNudge: () => void;
}) {
  const { locale } = useLocale();
  const { employee: ec, layoutNav } = getStrings(locale);

  const latestFor = (eventId: string) =>
    userId
      ? responses
          .filter((r) => r.eventId === eventId && r.userId === userId)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
      : undefined;

  if (priorityView.kind === 'idle') {
    return (
      <section className="page-section employee-events-page member-priority-home member-priority-home--idle">
        {supervisorTeamNudge ? (
          <div className="supervisor-team-nudge-banner" role="status">
            <div className="supervisor-team-nudge-copy">
              <strong>{ec.supervisorNudgeTitle}</strong>
              <p>{ec.supervisorNudgeBody(supervisorTeamNudge.eventTitle, supervisorTeamNudge.pendingPct)}</p>
            </div>
            <div className="supervisor-team-nudge-actions">
              <button type="button" className="btn primary" onClick={onGoTeamDashboardFromNudge}>
                {layoutNav.teamDash}
              </button>
              <button type="button" className="btn ghost" onClick={onDismissSupervisorNudge}>
                {ec.close}
              </button>
            </div>
          </div>
        ) : null}
        <header className="employee-events-hero">
          <div className="employee-events-hero-text">
            <h2 className="employee-events-title">
              <Activity className="employee-events-title-icon" aria-hidden />
              {ec.idleHeroTitle}
            </h2>
            <p className="employee-events-subtitle">{ec.idleHeroSubtitle}</p>
          </div>
        </header>

        <div className="member-idle-history">
          <h3 className="section-title member-idle-history-title">{ec.sectionOngoingEvents}</h3>
          {idleHistoryOngoing.length === 0 ? (
            <p className="empty muted-text">{ec.idleNoOngoingSupplemented}</p>
          ) : (
            <ul className="member-idle-history-list">
              {idleHistoryOngoing.map((row) => {
                const lr = row.latest;
                if (!lr) return null;
                return (
                  <li key={row.event.id} className="member-idle-history-row">
                    <div className="member-idle-history-row-main">
                      <span className="member-idle-history-event-title">{row.event.title}</span>
                      <span className="muted-text subtle">{row.event.type}</span>
                    </div>
                    <div className="member-idle-history-row-aside">
                      <StatusBadge status={lr.status} />
                      <button type="button" className="btn primary btn-sm" onClick={() => onSupplementEvent(row.event.id)}>
                        {ec.supplementOrUpdate}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <h3 className="section-title member-idle-history-title member-idle-history-title--closed">{ec.sectionClosedEvents}</h3>
          {idleHistoryClosed.length === 0 ? (
            <p className="empty muted-text">{ec.idleNoClosedHistory}</p>
          ) : (
            <ul className="member-idle-history-list">
              {idleHistoryClosed.map((row) => {
                const lr = row.latest;
                if (!lr) return null;
                return (
                  <li key={row.event.id} className="member-idle-history-row member-idle-history-row--readonly">
                    <div className="member-idle-history-row-main">
                      <span className="member-idle-history-event-title">{row.event.title}</span>
                      <span className="muted-text subtle">{formatEmployeeCardTime(lr.updatedAt, locale)}</span>
                    </div>
                    <StatusBadge status={lr.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <article className="event-detail-card event-detail-card--emergency member-priority-idle-emergency">
          <div className="event-detail-card-head">
            <span className="event-detail-card-icon">
              <Phone size={22} strokeWidth={1.8} aria-hidden />
            </span>
            <h3>{ec.emergencyContactTitle}</h3>
          </div>
          <div className="emergency-inline emergency-inline--desktop">
            <a className="emergency-slot" href="tel:+886212345678">
              <span className="emergency-slot-ic emergency-slot-ic--headset" aria-hidden>
                <Headphones size={20} strokeWidth={2} />
              </span>
              <div>
                <div className="emergency-slot-title">Emergency Hotline</div>
                <div className="emergency-slot-num">+886 (2) 1234-5678</div>
              </div>
            </a>
            <span className="emergency-vrule" aria-hidden />
            <a className="emergency-slot" href="tel:+886298765432">
              <span className="emergency-slot-ic emergency-slot-ic--people" aria-hidden>
                <Users size={20} strokeWidth={2} />
              </span>
              <div>
                <div className="emergency-slot-title">HR Duty Line</div>
                <div className="emergency-slot-num">+886 (2) 9876-5432</div>
              </div>
            </a>
          </div>
          <div className="emergency-list emergency-list--narrow">
            <a className="emergency-row" href="tel:+886212345678">
              <span className="emergency-row-ic" aria-hidden>
                <Headphones size={20} strokeWidth={2} />
              </span>
              <div className="emergency-row-text">
                <div className="emergency-slot-title">Emergency Hotline</div>
                <div className="emergency-slot-num">+886 (2) 1234-5678</div>
              </div>
              <span className="emergency-row-chevron" aria-hidden>
                <ChevronRight size={20} strokeWidth={2} />
              </span>
            </a>
            <a className="emergency-row" href="tel:+886298765432">
              <span className="emergency-row-ic" aria-hidden>
                <Users size={20} strokeWidth={2} />
              </span>
              <div className="emergency-row-text">
                <div className="emergency-slot-title">HR Duty Line</div>
                <div className="emergency-slot-num">+886 (2) 9876-5432</div>
              </div>
              <span className="emergency-row-chevron" aria-hidden>
                <ChevronRight size={20} strokeWidth={2} />
              </span>
            </a>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="page-section employee-events-page member-priority-home" aria-label={ec.priorityStackAria}>
      <header className="employee-events-hero">
        <div className="employee-events-hero-text">
          <h2 className="employee-events-title">
            <ShieldCheck className="employee-events-title-icon" aria-hidden />
            {ec.reportNowHeroTitle}
          </h2>
          <p className="employee-events-subtitle">{ec.reportNowHeroSubtitle}</p>
        </div>
      </header>

      <div className="member-priority-stack">
        {priorityView.rows.map((row) => {
          const lid = `priority-head-${row.event.id}`;
          const latest = latestFor(row.event.id) ?? row.latest;
          const errHere = submitErrorEventId === row.event.id;
          return (
            <div key={row.event.id} className="member-priority-report-card" aria-labelledby={lid}>
              <div className="member-priority-card-head">
                <div className="member-priority-card-icon" aria-hidden>
                  {(() => {
                    const Ico = employeeEventTypeIcon(row.event.type);
                    return <Ico size={24} strokeWidth={1.85} />;
                  })()}
                </div>
                <div className="member-priority-card-head-text">
                  <h3 className="member-priority-card-title" id={lid}>
                    {row.event.title}
                  </h3>
                  <p className="member-priority-card-meta">
                    {row.event.type} · {formatEmployeeCardTime(row.event.startAt, locale)}
                  </p>
                </div>
              </div>
              <EmployeeQuickReportPanel
                draftUserId={draftUserId}
                userName={userName}
                selectedEvent={row.event}
                currentDepartment={currentDepartment}
                latestResponse={latest}
                reportSubmitting={submittingEventId === row.event.id}
                submitErrorMessage={errHere ? submitErrorMessage : null}
                onDismissSubmitError={onDismissSubmitError}
                onRetrySubmit={onRetryReport}
                onSubmit={(status, fields, meta) => onSubmitReport(row.event.id, status, fields, meta)}
                layout="embedded"
                hideEmergencyContact
                stackInitialReport
                stackSectionId={`priority-report-${row.event.id}`}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
