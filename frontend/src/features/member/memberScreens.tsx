import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter,
  Flame,
  Headphones,
  Hourglass,
  Package,
  Phone,
  Search,
  ShieldCheck,
  Users,
  Wind,
} from 'lucide-react';
import { PageBackButton } from '../../components/PageBackButton';
import { PageHeader } from '../../components/PageHeader';
import { useLocale } from '../../locale/LocaleContext';
import { getStrings } from '../../locale/strings';
import { stripRedundantStatusFromTitle } from '../../lib/adminEventDisplay';
import { formatLocaleDateTime, formatLocaleTime } from '../../lib/localTime';
import type { AppLocale } from '../../locale/LocaleContext';
import type { Department, EventItem, SafetyResponse } from '../../types';
import { formatEmployeeCardTime } from './memberFormat';
import { ReportHistoryCard } from './ReportHistoryCard';
import { ReportRevisionModal } from './ReportRevisionModal';
import { EmployeeQuickReportPanel } from './EmployeeQuickReportPanel';
import type {
  EmployeeReportFields,
  EventFilterTab,
  MemberHomeRow,
  MemberMode,
  TeamCounts,
} from './memberTypes';

export type { EmployeeReportFields, MemberHomeRow, MemberMode } from './memberTypes';

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

function personalEventStripeClass(isOngoingTab: boolean, pending: boolean, latest?: SafetyResponse): string {
  if (!isOngoingTab) return 'muted';
  if (pending) return 'pending';
  if (latest?.status === 'need_help') return 'danger';
  return 'safe';
}

function memberListSubtitleHero(mode: MemberMode): string {
  if (mode === 3) {
    return "Review direct reports' safety responses for events that include your department.";
  }
  if (mode === 2) {
    return 'Submit your status and monitor your direct reports.';
  }
  return 'Stay informed. Report your status. Stay safe.';
}

function teamStripeClass(isOngoingTab: boolean, teamCounts: { needHelp: number; pending: number; safe: number }): string {
  if (!isOngoingTab) return 'muted';
  if (teamCounts.needHelp > 0) return 'danger';
  if (teamCounts.pending > 0) return 'pending';
  if (teamCounts.safe > 0) return 'safe';
  return 'muted';
}

function MemberTeamMiniBadges({
  teamCounts,
  ariaLabel,
  safeLabel,
  needLabel,
  pendingLabel,
}: Readonly<{
  teamCounts: TeamCounts;
  ariaLabel: string;
  safeLabel: string;
  needLabel: string;
  pendingLabel: string;
}>) {
  return (
    <fieldset className="member-event-team-mini-badges">
      <legend className="sr-only">{ariaLabel}</legend>
      <span className="member-team-pill safe">
        <CheckCircle2 size={12} strokeWidth={2.25} aria-hidden />
        {safeLabel}
      </span>
      <span className={`member-team-pill${teamCounts.needHelp > 0 ? ' danger' : ''}`}>
        <AlertCircle size={12} strokeWidth={2.25} aria-hidden />
        {needLabel}
      </span>
      <span className="member-team-pill muted">
        <Hourglass size={12} strokeWidth={2} aria-hidden />
        {pendingLabel}
      </span>
    </fieldset>
  );
}

function EmployeeOngoingStatusBlock({
  pending,
  latest,
  ec,
  respondedTimeStr,
}: Readonly<{
  pending: boolean;
  latest?: SafetyResponse;
  ec: ReturnType<typeof getStrings>['employee'];
  respondedTimeStr: string;
}>) {
  let statusPill: ReactNode = null;
  if (pending) {
    statusPill = (
      <span className="employee-events-status-pill pending">
        <Hourglass size={14} strokeWidth={2} aria-hidden />
        {ec.cardPendingLabel}
      </span>
    );
  } else if (latest?.status === 'safe') {
    statusPill = (
      <span className="employee-events-status-pill safe">
        <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
        {ec.cardReportedSafeLabel}
      </span>
    );
  } else if (latest) {
    statusPill = (
      <span className="employee-events-status-pill danger">
        <AlertCircle size={14} strokeWidth={2} aria-hidden />
        {ec.cardReportedNeedLabel}
      </span>
    );
  }

  let hint: ReactNode = null;
  if (pending) {
    hint = <span className="employee-events-status-hint">{ec.cardAskSubmitHint}</span>;
  } else if (latest) {
    hint = <span className="employee-events-status-hint muted">{ec.cardRespondedHint(respondedTimeStr)}</span>;
  }

  return (
    <>
      {statusPill}
      {hint}
    </>
  );
}

function EmployeeClosedStatusBlock({
  latest,
  ec,
  closedDetailTime,
}: Readonly<{
  latest?: SafetyResponse;
  ec: ReturnType<typeof getStrings>['employee'];
  closedDetailTime: string;
}>) {
  let detail: ReactNode = (
    <span className="employee-events-status-hint muted">{ec.cardNoSubmissionClosed}</span>
  );
  if (latest?.status === 'safe') {
    detail = (
      <span className="employee-events-closed-safe">
        <CheckCircle2 size={14} className="text-safe" aria-hidden />
        {ec.cardIamSafeShort} · {closedDetailTime}
      </span>
    );
  } else if (latest?.status === 'need_help') {
    detail = (
      <span className="employee-events-closed-safe danger-text">
        <AlertCircle size={14} aria-hidden />
        {ec.cardNeedHelpShort} · {closedDetailTime}
      </span>
    );
  }

  return (
    <>
      <span className="employee-events-status-pill closed">{ec.cardClosedBadge}</span>
      {detail}
    </>
  );
}

function personalClosedDetail(latest: SafetyResponse | undefined, ec: ReturnType<typeof getStrings>['employee']): ReactNode {
  if (latest?.status === 'safe') {
    return (
      <span className="employee-events-closed-safe">
        <CheckCircle2 size={14} className="text-safe" aria-hidden />
        {ec.dualPersonalSafeClosed}
      </span>
    );
  }
  if (latest?.status === 'need_help') {
    return (
      <span className="employee-events-closed-safe danger-text">
        <AlertCircle size={14} aria-hidden />
        {ec.dualPersonalNeedClosed}
      </span>
    );
  }
  return <span className="employee-events-status-hint muted">{ec.dualNoPersonalSubmissionClosed}</span>;
}

function EmployeePersonalMiniStatus({
  isOngoingTab,
  latest,
  ec,
}: Readonly<{
  isOngoingTab: boolean;
  latest?: SafetyResponse;
  ec: ReturnType<typeof getStrings>['employee'];
}>) {
  if (isOngoingTab) {
    if (!latest) {
      return (
        <span className="employee-events-status-pill pending">
          <Hourglass size={14} strokeWidth={2} aria-hidden />
          {ec.cardPendingLabel}
        </span>
      );
    }
    if (latest.status === 'safe') {
      return (
        <span className="employee-events-status-pill safe">
          <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
          {ec.cardIamSafeShort}
        </span>
      );
    }
    return (
      <span className="employee-events-status-pill danger">
        <AlertCircle size={14} strokeWidth={2} aria-hidden />
        {ec.cardNeedHelpShort}
      </span>
    );
  }

  return (
    <>
      <span className="employee-events-status-pill closed">{ec.cardClosedBadge}</span>
      {personalClosedDetail(latest, ec)}
    </>
  );
}

function formatCardRespondedTime(latest: SafetyResponse | undefined, pending: boolean, locale: AppLocale): string {
  if (!latest || pending) return '';
  return formatLocaleTime(latest.updatedAt, locale, { hour: 'numeric', minute: '2-digit' });
}

function formatCardClosedTime(latest: SafetyResponse | undefined, isClosedTab: boolean, locale: AppLocale): string {
  if (!latest || !isClosedTab) return '';
  return formatLocaleDateTime(latest.updatedAt, locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function EmployeeEventListCard({
  event,
  latest,
  filterTab,
  selectedEventId,
  onSelectEvent,
}: Readonly<{
  event: EventItem;
  latest?: SafetyResponse;
  filterTab: EventFilterTab;
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
}>) {
  const { locale } = useLocale();
  const ec = getStrings(locale).employee;
  const Icon = employeeEventTypeIcon(event.type);
  const deptLabel = event.cardDepartment ?? '';
  const isOngoingTab = filterTab === 'ongoing';
  const pending = !latest && isOngoingTab;
  const stripeClass = personalEventStripeClass(isOngoingTab, pending, latest);
  const respondedTimeStr = formatCardRespondedTime(latest, pending, locale);
  const closedDetailTime = formatCardClosedTime(latest, filterTab === 'closed', locale);

  const ongoingStatusBlock = isOngoingTab ? (
    <EmployeeOngoingStatusBlock pending={pending} latest={latest} ec={ec} respondedTimeStr={respondedTimeStr} />
  ) : null;

  const closedStatusBlock =
    filterTab === 'closed' ? (
      <EmployeeClosedStatusBlock latest={latest} ec={ec} closedDetailTime={closedDetailTime} />
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
            <div className="employee-events-card-title">{stripRedundantStatusFromTitle(event.title)}</div>
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

function MemberEventDualCard({
  event,
  latest,
  teamCounts,
  filterTab,
  selectedPersonalEventId,
  selectedTeamEventId,
  onOpenPersonal,
  onOpenTeam,
}: Readonly<{
  event: EventItem;
  latest?: SafetyResponse;
  teamCounts: TeamCounts;
  filterTab: EventFilterTab;
  selectedPersonalEventId: string;
  selectedTeamEventId: string;
  onOpenPersonal: (eventId: string) => void;
  onOpenTeam: (eventId: string) => void;
}>) {
  const { locale } = useLocale();
  const ec = getStrings(locale).employee;
  const Icon = employeeEventTypeIcon(event.type);
  const deptLabel = event.cardDepartment ?? '';
  const isOngoingTab = filterTab === 'ongoing';
  const pending = !latest && isOngoingTab;
  const stripeClass = personalEventStripeClass(isOngoingTab, pending, latest);

  const personalMini = <EmployeePersonalMiniStatus isOngoingTab={isOngoingTab} latest={latest} ec={ec} />;

  const teamMini = (
    <MemberTeamMiniBadges
      teamCounts={teamCounts}
      ariaLabel={ec.dualAriaTeamSummary}
      safeLabel={ec.teamMiniSafe(teamCounts.safe)}
      needLabel={ec.teamMiniNeed(teamCounts.needHelp)}
      pendingLabel={ec.teamMiniPending(teamCounts.pending)}
    />
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
            <div className="employee-events-card-title">{stripRedundantStatusFromTitle(event.title)}</div>
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
}: Readonly<{
  event: EventItem;
  teamCounts: TeamCounts;
  filterTab: EventFilterTab;
  selectedTeamEventId: string;
  onOpenTeam: (eventId: string) => void;
}>) {
  const { locale } = useLocale();
  const ec = getStrings(locale).employee;
  const Icon = employeeEventTypeIcon(event.type);
  const deptLabel = event.cardDepartment ?? '';
  const isOngoingTab = filterTab === 'ongoing';
  const stripeClass = teamStripeClass(isOngoingTab, teamCounts);

  const teamMini = (
    <MemberTeamMiniBadges
      teamCounts={teamCounts}
      ariaLabel={ec.dualAriaTeamSummary}
      safeLabel={ec.teamMiniSafe(teamCounts.safe)}
      needLabel={ec.teamMiniNeed(teamCounts.needHelp)}
      pendingLabel={ec.teamMiniPending(teamCounts.pending)}
    />
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
            <div className="employee-events-card-title">{stripRedundantStatusFromTitle(event.title)}</div>
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

function memberListOngoingIntro(mode: MemberMode) {
  if (mode === 3) {
    return (
      <div className="employee-events-section-intro">
        <Users className="employee-events-intro-icon" size={22} aria-hidden />
        <div>
          <h3>Ongoing Events</h3>
          <p>Open teams first — sorted by unanswered direct reports.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="employee-events-section-intro">
      <Activity className="employee-events-intro-icon" size={22} aria-hidden />
      <div>
        <h3>Ongoing Events</h3>
        <p>Events that require your response.</p>
      </div>
    </div>
  );
}

function memberListClosedIntro(mode: MemberMode) {
  const closedBody =
    mode === 3 ? "Past incidents for your team's departments." : 'Events that have ended.';
  return (
    <div className="employee-events-section-intro">
      <Archive className="employee-events-intro-icon" size={22} aria-hidden />
      <div>
        <h3>Closed Events</h3>
        <p>{closedBody}</p>
      </div>
    </div>
  );
}

function renderMode1MemberCards(
  filterTab: EventFilterTab,
  pendingList: MemberHomeRow[],
  respondedList: MemberHomeRow[],
  closedFlat: MemberHomeRow[],
  selectedPersonalEventId: string,
  onOpenPersonal: (eventId: string) => void,
) {
  if (filterTab === 'closed') {
    return closedFlat.map(({ event, latest }) => (
      <EmployeeEventListCard
        key={event.id}
        event={event}
        latest={latest}
        filterTab="closed"
        selectedEventId={selectedPersonalEventId}
        onSelectEvent={onOpenPersonal}
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
          onSelectEvent={onOpenPersonal}
        />
      ))}
      {respondedList.map(({ event, latest }) => (
        <EmployeeEventListCard
          key={event.id}
          event={event}
          latest={latest}
          filterTab="ongoing"
          selectedEventId={selectedPersonalEventId}
          onSelectEvent={onOpenPersonal}
        />
      ))}
    </>
  );
}

function memberPendingRows(rows: MemberHomeRow[], mode: MemberMode, isOngoingFilter: boolean): MemberHomeRow[] {
  if (!isOngoingFilter) return [];
  if (mode === 3) return rows;
  return rows.filter((r) => !r.latest);
}

function renderMode2MemberCards(
  args: Readonly<{
    filterTab: EventFilterTab;
    pendingList: MemberHomeRow[];
    respondedList: MemberHomeRow[];
    closedFlat: MemberHomeRow[];
    selectedPersonalEventId: string;
    selectedTeamEventId: string;
    onOpenPersonal: (eventId: string) => void;
    onOpenTeam: (eventId: string) => void;
  }>,
) {
  const {
    filterTab,
    pendingList,
    respondedList,
    closedFlat,
    selectedPersonalEventId,
    selectedTeamEventId,
    onOpenPersonal,
    onOpenTeam,
  } = args;
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
  if (filterTab === 'ongoing') {
    return (
      <>
        {pendingList.map((row) => renderDual(row))}
        {respondedList.map((row) => renderDual(row))}
      </>
    );
  }
  return closedFlat.map((row) => renderDual(row));
}

function renderMode3MemberCards(
  filterTab: EventFilterTab,
  pendingList: MemberHomeRow[],
  respondedList: MemberHomeRow[],
  closedFlat: MemberHomeRow[],
  selectedTeamEventId: string,
  onOpenTeam: (eventId: string) => void,
) {
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
  if (filterTab === 'ongoing') {
    return pendingList.concat(respondedList).map((row) => renderTeamOnly(row));
  }
  return closedFlat.map((row) => renderTeamOnly(row));
}

function renderMemberEventCards(
  mode: MemberMode,
  args: Readonly<{
    pendingList: MemberHomeRow[];
    respondedList: MemberHomeRow[];
    closedFlat: MemberHomeRow[];
    filterTab: EventFilterTab;
    selectedPersonalEventId: string;
    selectedTeamEventId: string;
    onOpenPersonal: (eventId: string) => void;
    onOpenTeam: (eventId: string) => void;
  }>,
) {
  const { pendingList, respondedList, closedFlat, filterTab, selectedPersonalEventId, selectedTeamEventId, onOpenPersonal, onOpenTeam } =
    args;
  if (mode === 1) {
    return renderMode1MemberCards(filterTab, pendingList, respondedList, closedFlat, selectedPersonalEventId, onOpenPersonal);
  }
  if (mode === 2) {
    return renderMode2MemberCards({
      filterTab,
      pendingList,
      respondedList,
      closedFlat,
      selectedPersonalEventId,
      selectedTeamEventId,
      onOpenPersonal,
      onOpenTeam,
    });
  }
  return renderMode3MemberCards(filterTab, pendingList, respondedList, closedFlat, selectedTeamEventId, onOpenTeam);
}

function MemberOngoingEventSections({
  mode,
  pendingRows,
  respondedRows,
  showPendingGroup,
  pendingHeading,
  pendingCount,
  pendingListForCards,
  cardListArgs,
}: Readonly<{
  mode: MemberMode;
  pendingRows: MemberHomeRow[];
  respondedRows: MemberHomeRow[];
  showPendingGroup: boolean;
  pendingHeading: string;
  pendingCount: number;
  pendingListForCards: MemberHomeRow[];
  cardListArgs: {
    selectedPersonalEventId: string;
    selectedTeamEventId: string;
    onOpenPersonal: (eventId: string) => void;
    onOpenTeam: (eventId: string) => void;
  };
}>) {
  return (
    <>
      {showPendingGroup ? (
        <div
          className={`employee-events-status-group employee-events-status-group--pending${mode === 3 ? ' member-mode3-single-list' : ''}`}
        >
          <h4 className="employee-events-group-heading">
            {pendingHeading}
            {' '}
            <span className="employee-events-group-count">{pendingCount}</span>
          </h4>
          <div className="employee-events-group-cards">
            {renderMemberEventCards(mode, {
              pendingList: pendingListForCards,
              respondedList: [],
              closedFlat: [],
              filterTab: 'ongoing',
              ...cardListArgs,
            })}
          </div>
        </div>
      ) : null}
      {mode !== 3 && respondedRows.length > 0 ? (
        <div
          className={`employee-events-status-group employee-events-status-group--responded${
            pendingRows.length > 0 ? ' employee-events-status-group--after-pending' : ''
          }`}
        >
          <h4 className="employee-events-group-heading">
            Responded
            {' '}
            <span className="employee-events-group-count">{respondedRows.length}</span>
          </h4>
          <div className="employee-events-group-cards">
            {renderMemberEventCards(mode, {
              pendingList: [],
              respondedList: respondedRows,
              closedFlat: [],
              filterTab: 'ongoing',
              ...cardListArgs,
            })}
          </div>
        </div>
      ) : null}
    </>
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
}: Readonly<{
  mode: MemberMode;
  rows: MemberHomeRow[];
  selectedPersonalEventId: string;
  selectedTeamEventId: string;
  onOpenPersonal: (eventId: string) => void;
  onOpenTeam: (eventId: string) => void;
  employeeEventFilter: EventFilterTab;
  setEmployeeEventFilter: (value: EventFilterTab) => void;
  ongoingCount: number;
  closedCount: number;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}>) {
  const isOngoingFilter = employeeEventFilter === 'ongoing';
  const pendingRows = memberPendingRows(rows, mode, isOngoingFilter);
  const respondedRows = isOngoingFilter && mode !== 3 ? rows.filter((r) => Boolean(r.latest)) : [];
  const subtitleHero = memberListSubtitleHero(mode);
  const ongoingIntro = memberListOngoingIntro(mode);
  const closedIntro = memberListClosedIntro(mode);
  const showPendingGroup = mode === 3 ? rows.length > 0 : pendingRows.length > 0;
  const pendingHeading = mode === 3 ? 'Active' : 'Not responded yet';
  const pendingCount = mode === 3 ? rows.length : pendingRows.length;
  const pendingListForCards = mode === 3 ? rows : pendingRows;

  const cardListArgs = {
    selectedPersonalEventId,
    selectedTeamEventId,
    onOpenPersonal,
    onOpenTeam,
  };

  return (
    <section className="page-section employee-events-page">
      <PageHeader title="Emergency Events" subtitle={subtitleHero} />

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
          <MemberOngoingEventSections
            mode={mode}
            pendingRows={pendingRows}
            respondedRows={respondedRows}
            showPendingGroup={showPendingGroup}
            pendingHeading={pendingHeading}
            pendingCount={pendingCount}
            pendingListForCards={pendingListForCards}
            cardListArgs={cardListArgs}
          />
        ) : (
          renderMemberEventCards(mode, {
            pendingList: [],
            respondedList: [],
            closedFlat: rows,
            filterTab: 'closed',
            ...cardListArgs,
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
}: Readonly<{
  title: string;
  events: EventItem[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
}>) {
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


function MemberEmergencyContactsCollapsible() {
  const { locale } = useLocale();
  const ec = getStrings(locale).employee;

  const scrollExpandedIntoView = (el: HTMLDetailsElement) => {
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  };

  return (
    <details
      className="member-emergency-collapsible"
      onToggle={(e) => {
        if (e.currentTarget.open) scrollExpandedIntoView(e.currentTarget);
      }}
    >
      <summary className="member-emergency-collapsible-summary">
        <span className="member-emergency-collapsible-leading">
          <Phone size={16} strokeWidth={2} aria-hidden />
          {ec.emergencyContactToggle}
        </span>
        <ChevronDown size={18} strokeWidth={2.25} className="member-emergency-collapsible-chevron" aria-hidden />
      </summary>
      <div className="member-emergency-collapsible-body">
        <a className="member-emergency-link" href="tel:+886212345678">
          <Headphones size={18} strokeWidth={2} aria-hidden />
          <span>
            <span className="member-emergency-link-title">Emergency Hotline</span>
            <span className="member-emergency-link-num">+886 (2) 1234-5678</span>
          </span>
        </a>
        <a className="member-emergency-link" href="tel:+886298765432">
          <Users size={18} strokeWidth={2} aria-hidden />
          <span>
            <span className="member-emergency-link-title">HR Duty Line</span>
            <span className="member-emergency-link-num">+886 (2) 9876-5432</span>
          </span>
        </a>
      </div>
    </details>
  );
}

function MemberIdleHistoryList({
  idleHistoryOngoing,
  idleHistoryClosed,
  departments,
  onSubmitReport,
  onRetryReport,
  submittingEventId,
  submitErrorMessage,
  submitErrorEventId,
  onDismissSubmitError,
}: Readonly<{
  idleHistoryOngoing: MemberHomeRow[];
  idleHistoryClosed: MemberHomeRow[];
  departments: Department[];
  onSubmitReport: (
    eventId: string,
    status: 'safe' | 'need_help',
    fields: EmployeeReportFields,
    meta?: { omitStoredAttachment?: boolean; showOverlay?: boolean },
  ) => void | Promise<void>;
  onRetryReport: () => void;
  submittingEventId: string | null;
  submitErrorMessage: string | null;
  submitErrorEventId: string | null;
  onDismissSubmitError: () => void;
}>) {
  const { locale } = useLocale();
  const ec = getStrings(locale).employee;
  const [editingRow, setEditingRow] = useState<MemberHomeRow | null>(null);
  const prevSubmittingRef = useRef<string | null>(null);

  useEffect(() => {
    const wasSubmitting = prevSubmittingRef.current;
    prevSubmittingRef.current = submittingEventId;
    if (!editingRow || !wasSubmitting || submittingEventId) return;
    if (submitErrorEventId === editingRow.event.id) return;
    setEditingRow(null);
  }, [submittingEventId, submitErrorEventId, editingRow]);

  const editingEventId = editingRow?.event.id ?? null;
  const modalSubmitting = editingEventId !== null && submittingEventId === editingEventId;
  const modalError =
    editingEventId !== null && submitErrorEventId === editingEventId ? submitErrorMessage : null;

  return (
    <>
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
                <li key={row.event.id}>
                  <ReportHistoryCard
                    event={row.event}
                    latest={lr}
                    departments={departments}
                    editable
                    onEdit={() => setEditingRow(row)}
                  />
                </li>
              );
            })}
          </ul>
        )}

        <h3 className="section-title member-idle-history-title member-idle-history-title--closed">
          {ec.sectionClosedEvents}
        </h3>
        {idleHistoryClosed.length === 0 ? (
          <p className="empty muted-text">{ec.idleNoClosedHistory}</p>
        ) : (
          <ul className="member-idle-history-list">
            {idleHistoryClosed.map((row) => {
              const lr = row.latest;
              if (!lr) return null;
              return (
                <li key={row.event.id}>
                  <ReportHistoryCard event={row.event} latest={lr} departments={departments} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ReportRevisionModal
        open={editingRow !== null}
        event={editingRow?.event ?? null}
        latestResponse={editingRow?.latest ?? null}
        departments={departments}
        reportSubmitting={modalSubmitting}
        submitErrorMessage={modalError}
        onDismissSubmitError={onDismissSubmitError}
        onRetrySubmit={onRetryReport}
        onSubmit={(status, fields, meta) => {
          if (!editingRow) return;
          void onSubmitReport(editingRow.event.id, status, fields, meta);
        }}
        onClose={() => setEditingRow(null)}
      />
    </>
  );
}

export function MemberReportHistoryPage({
  idleHistoryOngoing,
  idleHistoryClosed,
  departments,
  onSubmitReport,
  onRetryReport,
  submittingEventId,
  submitErrorMessage,
  submitErrorEventId,
  onDismissSubmitError,
  onBack,
}: Readonly<{
  idleHistoryOngoing: MemberHomeRow[];
  idleHistoryClosed: MemberHomeRow[];
  departments: Department[];
  onSubmitReport: (
    eventId: string,
    status: 'safe' | 'need_help',
    fields: EmployeeReportFields,
    meta?: { omitStoredAttachment?: boolean; showOverlay?: boolean },
  ) => void | Promise<void>;
  onRetryReport: () => void;
  submittingEventId: string | null;
  submitErrorMessage: string | null;
  submitErrorEventId: string | null;
  onDismissSubmitError: () => void;
  onBack: () => void;
}>) {
  const { locale } = useLocale();
  const { layoutNav: ln } = getStrings(locale);

  return (
    <section className="page-section employee-events-page member-report-history-page">
      <PageBackButton onClick={onBack} ariaLabel={ln.backToMemberHome} />
      <MemberIdleHistoryList
        idleHistoryOngoing={idleHistoryOngoing}
        idleHistoryClosed={idleHistoryClosed}
        departments={departments}
        onSubmitReport={onSubmitReport}
        onRetryReport={onRetryReport}
        submittingEventId={submittingEventId}
        submitErrorMessage={submitErrorMessage}
        submitErrorEventId={submitErrorEventId}
        onDismissSubmitError={onDismissSubmitError}
      />
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
  departments,
  supervisorTeamNudge,
  onDismissSupervisorNudge,
  onGoTeamDashboardFromNudge,
  onNavigateHistory,
}: Readonly<{
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
    meta?: { omitStoredAttachment?: boolean; showOverlay?: boolean },
  ) => void | Promise<void>;
  onRetryReport: () => void;
  submittingEventId: string | null;
  submitErrorMessage: string | null;
  submitErrorEventId: string | null;
  onDismissSubmitError: () => void;
  idleHistoryOngoing: MemberHomeRow[];
  idleHistoryClosed: MemberHomeRow[];
  departments: Department[];
  supervisorTeamNudge: null | { pendingPct: number; eventTitle: string };
  onDismissSupervisorNudge: () => void;
  onGoTeamDashboardFromNudge: () => void;
  onNavigateHistory: () => void;
}>) {
  const { locale } = useLocale();
  const { employee: ec, layoutNav } = getStrings(locale);
  const [editingRow, setEditingRow] = useState<MemberHomeRow | null>(null);
  const prevSubmittingRef = useRef<string | null>(null);

  useEffect(() => {
    const wasSubmitting = prevSubmittingRef.current;
    prevSubmittingRef.current = submittingEventId;
    if (!editingRow || !wasSubmitting || submittingEventId) return;
    if (submitErrorEventId === editingRow.event.id) return;
    setEditingRow(null);
  }, [submittingEventId, submitErrorEventId, editingRow]);

  const editingEventId = editingRow?.event.id ?? null;
  const modalSubmitting = editingEventId !== null && submittingEventId === editingEventId;
  const modalError =
    editingEventId !== null && submitErrorEventId === editingEventId ? submitErrorMessage : null;

  const latestFor = (eventId: string) =>
    userId
      ? responses
          .filter((r) => r.eventId === eventId && r.userId === userId)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
      : undefined;

  const waitingNeedHelpRows = idleHistoryOngoing.filter((row) => row.latest?.status === 'need_help');
  const waitingVisible = waitingNeedHelpRows.slice(0, 2);
  const waitingOverflow = waitingNeedHelpRows.length - waitingVisible.length;

  if (priorityView.kind === 'idle') {
    return (
      <section className="page-section employee-events-page member-priority-home member-priority-home--idle">
        {supervisorTeamNudge ? (
          <output className="supervisor-team-nudge-banner">
            <div className="supervisor-team-nudge-copy">
              <strong>{ec.supervisorNudgeTitle}</strong>
              <p>{ec.supervisorNudgeBody(supervisorTeamNudge.eventTitle, supervisorTeamNudge.pendingPct)}</p>
            </div>
            <div className="supervisor-team-nudge-actions">
              <button type="button" className="btn primary" onClick={onGoTeamDashboardFromNudge}>
                {layoutNav.teamReports}
              </button>
              <button type="button" className="btn ghost" onClick={onDismissSupervisorNudge}>
                {ec.close}
              </button>
            </div>
          </output>
        ) : null}

        <div className="member-idle-complete">
          <div className="member-idle-complete-icon-wrap" aria-hidden>
            <span className="member-idle-complete-halo" />
            <ShieldCheck className="member-idle-complete-icon" strokeWidth={1.65} />
          </div>
          <h2 className="member-idle-complete-title">{ec.reportCompleteTitle}</h2>
          <p className="member-idle-complete-body">{ec.reportCompleteBody}</p>
          <button type="button" className="member-idle-history-link" onClick={onNavigateHistory}>
            {ec.viewReportHistory}
            <ArrowRight size={15} strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        {waitingVisible.length > 0 ? (
          <div className="member-waiting-assistance">
            <h3 className="member-waiting-assistance-title">{ec.waitingAssistanceTitle}</h3>
            <p className="member-waiting-assistance-body muted-text">{ec.waitingAssistanceBody}</p>
            <ul className="member-waiting-assistance-list member-idle-history-list">
              {waitingVisible.map((row) => {
                const lr = row.latest;
                if (!lr) return null;
                return (
                  <li key={row.event.id}>
                    <ReportHistoryCard
                      event={row.event}
                      latest={lr}
                      departments={departments}
                      editable
                      onEdit={() => setEditingRow(row)}
                    />
                  </li>
                );
              })}
            </ul>
            {waitingOverflow > 0 ? (
              <button type="button" className="member-idle-history-link" onClick={onNavigateHistory}>
                {ec.waitingAssistanceMore(waitingOverflow)}
              </button>
            ) : null}
          </div>
        ) : null}

        <ReportRevisionModal
          open={editingRow !== null}
          event={editingRow?.event ?? null}
          latestResponse={editingRow?.latest ?? null}
          departments={departments}
          reportSubmitting={modalSubmitting}
          submitErrorMessage={modalError}
          onDismissSubmitError={onDismissSubmitError}
          onRetrySubmit={onRetryReport}
          onSubmit={(status, fields, meta) => {
            if (!editingRow) return;
            void onSubmitReport(editingRow.event.id, status, fields, meta);
          }}
          onClose={() => setEditingRow(null)}
        />

        <MemberEmergencyContactsCollapsible />
      </section>
    );
  }

  return (
    <section
      className="page-section employee-events-page member-priority-home member-priority-home--pending"
      aria-label={ec.priorityStackAria}
    >
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
                    {stripRedundantStatusFromTitle(row.event.title)}
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
