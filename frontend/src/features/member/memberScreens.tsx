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
import { loadEmployeeReportDraft, saveEmployeeReportDraft } from '../../lib/employeeReportDraft';
import type { EventItem, SafetyResponse } from '../../types';

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

function formatEmployeeCardTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
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
  const Icon = employeeEventTypeIcon(event.type);
  const deptLabel = event.cardDepartment ?? '';
  const isOngoingTab = filterTab === 'ongoing';
  const pending = !latest && isOngoingTab;
  const stripeClass =
    !isOngoingTab ? 'muted' : pending ? 'pending' : latest?.status === 'need_help' ? 'danger' : 'safe';

  const ongoingStatusBlock = isOngoingTab ? (
    <>
      {pending ? (
        <span className="employee-events-status-pill pending">
          <Hourglass size={14} strokeWidth={2} aria-hidden />
          Pending response
        </span>
      ) : latest?.status === 'safe' ? (
        <span className="employee-events-status-pill safe">
          <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
          Reported · I&apos;m Safe
        </span>
      ) : latest ? (
        <span className="employee-events-status-pill danger">
          <AlertCircle size={14} strokeWidth={2} aria-hidden />
          Reported · I need help
        </span>
      ) : null}
      {pending ? (
        <span className="employee-events-status-hint">Please submit your status.</span>
      ) : latest ? (
        <span className="employee-events-status-hint muted">
          You responded at{' '}
          {new Date(latest.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </span>
      ) : null}
    </>
  ) : null;

  const closedStatusBlock =
    filterTab === 'closed' ? (
      <>
        <span className="employee-events-status-pill closed">Closed</span>
        {latest?.status === 'safe' ? (
          <span className="employee-events-closed-safe">
            <CheckCircle2 size={14} className="text-safe" aria-hidden />
            I&apos;m Safe ·{' '}
            {new Date(latest.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        ) : latest?.status === 'need_help' ? (
          <span className="employee-events-closed-safe danger-text">
            <AlertCircle size={14} aria-hidden />
            I need help ·{' '}
            {new Date(latest.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        ) : (
          <span className="employee-events-status-hint muted">No submission on file.</span>
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
            <div className="employee-events-meta subtle">{formatEmployeeCardTime(event.startAt)}</div>
            {event.venue ? <div className="employee-events-meta subtle">{event.venue}</div> : null}

            <div className="employee-events-card-mobile-only">{ongoingStatusBlock ?? closedStatusBlock}</div>
          </div>

          <div className="employee-events-card-aside">
            <div className="employee-events-card-aside-text">
              {isOngoingTab ? (
                <>
                  {ongoingStatusBlock}
                  <span className={`employee-events-card-cta ${pending ? 'primary' : 'ghost'}`}>
                    <span className="employee-events-cta-label">{pending ? 'Continue' : 'View'}</span>
                    <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
                  </span>
                </>
              ) : (
                <>
                  {closedStatusBlock}
                  <span className="employee-events-card-cta ghost">
                    <span className="employee-events-cta-label">View</span>
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

type MemberHomeRow = {
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
          Pending response
        </span>
      ) : latest.status === 'safe' ? (
        <span className="employee-events-status-pill safe">
          <CheckCircle2 size={14} strokeWidth={2} aria-hidden />
          I&apos;m Safe
        </span>
      ) : (
        <span className="employee-events-status-pill danger">
          <AlertCircle size={14} strokeWidth={2} aria-hidden />
          I need help
        </span>
      )}
    </>
  ) : (
    <>
      <span className="employee-events-status-pill closed">Closed</span>
      {latest?.status === 'safe' ? (
        <span className="employee-events-closed-safe">
          <CheckCircle2 size={14} className="text-safe" aria-hidden />
          Personal · Safe
        </span>
      ) : latest?.status === 'need_help' ? (
        <span className="employee-events-closed-safe danger-text">
          <AlertCircle size={14} aria-hidden />
          Personal · Need help
        </span>
      ) : (
        <span className="employee-events-status-hint muted">No personal submission</span>
      )}
    </>
  );

  const teamMini = (
    <div className="member-event-team-mini-badges" role="group" aria-label="Team response summary">
      <span className="member-team-pill safe">
        <CheckCircle2 size={12} strokeWidth={2.25} aria-hidden />
        {teamCounts.safe} Safe
      </span>
      <span className={`member-team-pill${teamCounts.needHelp > 0 ? ' danger' : ''}`}>
        <AlertCircle size={12} strokeWidth={2.25} aria-hidden />
        {teamCounts.needHelp} Need help
      </span>
      <span className="member-team-pill muted">
        <Hourglass size={12} strokeWidth={2} aria-hidden />
        {teamCounts.pending} Pending
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
            <div className="employee-events-meta subtle">{formatEmployeeCardTime(event.startAt)}</div>
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
          <span className="member-event-action-label">Your response</span>
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
          <span className="member-event-action-label">Team overview ({teamCounts.total})</span>
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
    <div className="member-event-team-mini-badges" role="group" aria-label="Team response summary">
      <span className="member-team-pill safe">
        <CheckCircle2 size={12} strokeWidth={2.25} aria-hidden />
        {teamCounts.safe} Safe
      </span>
      <span className={`member-team-pill${teamCounts.needHelp > 0 ? ' danger' : ''}`}>
        <AlertCircle size={12} strokeWidth={2.25} aria-hidden />
        {teamCounts.needHelp} Need help
      </span>
      <span className="member-team-pill muted">
        <Hourglass size={12} strokeWidth={2} aria-hidden />
        {teamCounts.pending} Pending
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
            <div className="employee-events-meta subtle">{formatEmployeeCardTime(event.startAt)}</div>
            {event.venue ? <div className="employee-events-meta subtle">{event.venue}</div> : null}
          </div>
        </div>
      </div>
      <div className="member-event-team-only-footer">
        <span className="member-event-action-label">Team overview ({teamCounts.total})</span>
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

export function EmployeeHomePage({
  draftUserId,
  userName,
  selectedEvent,
  currentDepartment,
  latestResponse,
  employeeComment,
  setEmployeeComment,
  employeeLocation,
  setEmployeeLocation,
  employeeAttachment,
  setEmployeeAttachment,
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
  employeeComment: string;
  setEmployeeComment: (value: string) => void;
  employeeLocation: string;
  setEmployeeLocation: (value: string) => void;
  employeeAttachment: File | null;
  setEmployeeAttachment: (file: File | null) => void;
  reportSubmitting: boolean;
  submitErrorMessage: string | null;
  onDismissSubmitError: () => void;
  onRetrySubmit: () => void;
  onSubmit: (status: 'safe' | 'need_help', meta?: { omitStoredAttachment?: boolean }) => void | Promise<void>;
  onBackToEvents: () => void;
}) {
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const helpDetailsRef = useRef<HTMLDivElement>(null);
  const persistDraftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [selectedNeedHelp, setSelectedNeedHelp] = useState(false);
  const [wantToUpdate, setWantToUpdate] = useState(false);
  const [draftBaseline, setDraftBaseline] = useState<EditDraftBaseline | null>(null);
  const [pendingSubmission, setPendingSubmission] = useState<'safe' | 'need_help' | null>(null);
  const [discardPromptAfter, setDiscardPromptAfter] = useState<'back' | 'cancel' | null>(null);
  const [confirmSwitchToSafeOpen, setConfirmSwitchToSafeOpen] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [omitStoredAttachment, setOmitStoredAttachment] = useState(false);

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
    setSelectedNeedHelp(Boolean(stored?.selectedNeedHelp));
  }, [selectedEvent?.id, draftUserId, latestResponse?.id, setEmployeeComment, setEmployeeLocation]);

  useEffect(() => {
    if (!draftUserId || !selectedEvent?.id || Boolean(latestResponse) || wantToUpdate) return;
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
  ]);

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

  const handleNeedHelp = () => {
    if (reportSubmitting) return;
    if (isRevisionDraft) {
      setPendingSubmission('need_help');
      setSelectedNeedHelp(true);
      return;
    }
    setPendingSubmission(null);
    setSelectedNeedHelp(true);
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
    if (reason === 'back') onBackToEvents();
  };

  const requestBackNavigation = () => {
    if (isRevisionDraft && isDraftDirty) {
      setDiscardPromptAfter('back');
      return;
    }
    onBackToEvents();
  };

  const requestCancelRevision = () => {
    if (!draftBaseline || !isRevisionDraft) return;
    if (isDraftDirty) {
      setDiscardPromptAfter('cancel');
      return;
    }
    revertToBaselineAndExitEdit(draftBaseline);
  };

  const handleSubmitSafeTap = () => {
    if (reportSubmitting) return;
    if (isRevisionDraft) {
      setPendingSubmission('safe');
      setSelectedNeedHelp(false);
      return;
    }
    if (selectedNeedHelp) {
      setConfirmSwitchToSafeOpen(true);
      return;
    }
    void onSubmit('safe', { omitStoredAttachment });
  };

  const handleSubmitNeedHelpConfirm = () => {
    if (reportSubmitting) return;
    if (isRevisionDraft) return;
    void onSubmit('need_help', { omitStoredAttachment });
  };

  const handleSaveRevision = () => {
    if (reportSubmitting) return;
    if (!pendingSubmission || !isRevisionDraft) return;
    void onSubmit(pendingSubmission, { omitStoredAttachment });
  };

  const applyAttachment = (file: File | undefined | null) => {
    setUploadNotice(null);
    if (!file) {
      setEmployeeAttachment(null);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadNotice('單檔不得超過 10MB');
      return;
    }
    setOmitStoredAttachment(false);
    setEmployeeAttachment(file);
  };

  const confirmSwitchToSafeSubmit = () => {
    if (reportSubmitting) return;
    setConfirmSwitchToSafeOpen(false);
    setSelectedNeedHelp(false);
    setEmployeeComment('');
    setEmployeeLocation('');
    setEmployeeAttachment(null);
    setUploadNotice(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    void onSubmit('safe', { omitStoredAttachment: false });
  };

  const heroTime = selectedEvent ? new Date(selectedEvent.startAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

  return (
    <section className="employee-event-page">
      {selectedEvent ? (
        <>
          <header className="employee-event-hero">
            <button className="employee-event-back" type="button" onClick={requestBackNavigation} aria-label="返回事件列表">
              <ChevronLeft size={24} strokeWidth={2.25} aria-hidden />
            </button>
            <div className="employee-event-hero-art" aria-hidden />
            <div className="employee-event-hero-body">
              <div className="employee-event-icon-ring">
                <Activity size={36} strokeWidth={1.6} aria-hidden />
              </div>
              <h1 className="employee-event-headline">{selectedEvent.title}</h1>
              <p className="employee-event-subline">
                {hasReport && wantToUpdate ? '請更新並儲存你的回報。' : hasReport && !wantToUpdate ? '\u00a0' : `Hi ${userName}，請確認你的狀態是否平安。`}
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

          {reportSubmitting ? (
            <p className="employee-submit-progress" aria-live="polite">
              送出中…（弱網下可能自動重試，請稍候）
            </p>
          ) : null}
          {submitErrorMessage ? (
            <div className="employee-submit-error-banner" role="alert">
              <AlertCircle size={22} aria-hidden />
              <div className="employee-submit-error-body">
                <strong>無法送出回報</strong>
                <p>{submitErrorMessage}</p>
                <div className="employee-submit-error-actions">
                  <button type="button" className="btn primary" disabled={reportSubmitting} onClick={onRetrySubmit}>
                    <RefreshCw size={16} aria-hidden /> 重試
                  </button>
                  <button type="button" className="btn ghost" onClick={onDismissSubmitError}>
                    關閉
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="employee-event-body">
            <div className={`employee-event-shell${isRevisionDraft ? ' employee-event-shell--revision' : ''}`}>
              {!showReportingControls && latestResponse ? (
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
                        <dt>Submitted at</dt>
                        <dd>
                          {(() => {
                            const t = new Date(latestResponse.updatedAt);
                            return `${t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} (${t.toLocaleTimeString('zh-TW', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: true,
                            })})`;
                          })()}
                        </dd>
                      </div>
                      <div className="employee-summary-row">
                        <dt>Location</dt>
                        <dd>{latestResponse.location?.trim() || '—'}</dd>
                      </div>
                      <div className="employee-summary-row">
                        <dt>Comment</dt>
                        <dd>{latestResponse.comment?.trim() || '—'}</dd>
                      </div>
                      <div className="employee-summary-row employee-summary-row--files">
                        <dt>Attached files</dt>
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
                        <Pencil size={18} strokeWidth={2} aria-hidden /> Edit Report
                      </button>
                      <button type="button" className="btn employee-btn-outline" onClick={onBackToEvents}>
                        Done
                      </button>
                    </div>
                  </article>
                </>
              ) : (
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

                  <article className="event-detail-card">
                    <div className="event-detail-card-head">
                      <span className="event-detail-card-icon">
                        <Users size={22} strokeWidth={1.75} aria-hidden />
                      </span>
                      <h3>Report your status</h3>
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
                            : `employee-status-wide need ${needFlowActive ? 'is-need-selected' : ''}`
                        }
                        onClick={handleNeedHelp}
                      >
                        {!isRevisionDraft && needFlowActive ? (
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

                  {showHelpDetailsPanel ? (
                    <div ref={helpDetailsRef} className="employee-help-details-panel">
                    <article className="event-detail-card">
                      <div className="event-detail-card-head">
                        <span className="event-detail-card-icon">
                          <ClipboardList size={22} strokeWidth={1.75} aria-hidden />
                        </span>
                        <h3>{isRevisionDraft ? 'Additional details' : 'Additional details (Optional)'}</h3>
                      </div>
                      <div className="employee-fields">
                        <label className="employee-field-label" htmlFor="emp-loc-input">
                          Location
                        </label>
                        <div className="input-with-leading-icon">
                          <span className="input-leading-ic" aria-hidden>
                            <MapPin size={19} strokeWidth={2} color="#3d5f85" />
                          </span>
                          <input
                            id="emp-loc-input"
                            placeholder="例如：Building A, 3F, Lab 2"
                            disabled={reportSubmitting}
                            value={employeeLocation}
                            onChange={(e) => setEmployeeLocation(e.target.value)}
                          />
                        </div>

                        <label className="employee-field-label" htmlFor="emp-comment-area">
                          Comment
                        </label>
                        <div className="textarea-with-leading-icon">
                          <span className="input-leading-ic textarea-leading" aria-hidden>
                            <MessageSquare size={19} strokeWidth={2} color="#3d5f85" />
                          </span>
                          <textarea
                            id="emp-comment-area"
                            placeholder="Tell us more about your situation…"
                            disabled={reportSubmitting}
                            value={employeeComment}
                            maxLength={MAX_COMMENT_LEN}
                            onChange={(e) => setEmployeeComment(e.target.value.slice(0, MAX_COMMENT_LEN))}
                          />
                          <span className="employee-char-count">{employeeComment.length}/{MAX_COMMENT_LEN}</span>
                        </div>

                        {!isRevisionDraft && selectedNeedHelp ? (
                          <button className="btn danger employee-confirm-help" disabled={reportSubmitting} type="button" onClick={handleSubmitNeedHelpConfirm}>
                            {isRevisionDraft ? '確認「需要協助」（暫存）' : '確認需要協助並送出'}
                          </button>
                        ) : null}
                      </div>
                    </article>

                    <article className="event-detail-card">
                      <div className="event-detail-card-head">
                        <span className="event-detail-card-icon">
                          <Paperclip size={22} strokeWidth={1.75} aria-hidden />
                        </span>
                        <h3>Attach files</h3>
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
                              Replace
                            </button>
                            <button
                              type="button"
                              className="btn ghost btn-icon-danger"
                              aria-label="Remove attachment"
                              onClick={() => setOmitStoredAttachment(true)}
                            >
                              <Trash2 size={18} strokeWidth={2} aria-hidden />
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <input ref={attachmentInputRef} id="emp-file-input" type="file" className="visually-hidden-input" onChange={(e) => applyAttachment(e.target.files?.[0])} />
                      <label
                        htmlFor="emp-file-input"
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
                        <span className="employee-drop-title">拖曳檔案到此，或點此瀏覽</span>
                        <span className="employee-drop-hint">支援圖片、影片與文件（各自最大 10MB）</span>
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
                          移除附件
                        </button>
                      ) : null}
                    </article>
                  </div>
                  ) : null}
                </>
              )}

              <article className="event-detail-card event-detail-card--emergency">
                <div className="event-detail-card-head">
                  <span className="event-detail-card-icon">
                    <Phone size={22} strokeWidth={1.8} aria-hidden />
                  </span>
                  <h3>Emergency contact</h3>
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

          <ConfirmModal
            open={discardPromptAfter !== null}
            title="Discard unsaved changes?"
            description="You have unsaved changes to your report draft. If you leave now, those changes will be lost."
            cancelText="Continue editing"
            confirmText="Discard changes"
            onCancel={() => setDiscardPromptAfter(null)}
            onConfirm={confirmDiscardDraft}
          />
          <ConfirmModal
            open={confirmSwitchToSafeOpen}
            title="改為「I'm Safe」？"
            description="你目前選擇了需要協助。若改為平安，將關閉詳細欄位並以「平安」送出回報。"
            cancelText="取消"
            confirmText="改為 I'm Safe 並送出"
            confirmTone="primary"
            onCancel={() => setConfirmSwitchToSafeOpen(false)}
            onConfirm={confirmSwitchToSafeSubmit}
          />
        </>
      ) : (
        <div className="employee-event-empty">
          <p>目前沒有選取的事件</p>
        </div>
      )}
    </section>
  );
}

export function EmployeeHistoryPage({
  responses,
  events,
  filter,
  setFilter,
}: {
  responses: SafetyResponse[];
  events: EventItem[];
  filter: 'all' | 'safe' | 'need_help';
  setFilter: (value: 'all' | 'safe' | 'need_help') => void;
}) {
  const filtered = responses.filter((response) => (filter === 'all' ? true : response.status === filter));
  return (
    <section className="page-section">
      <h2>My Reporting History</h2>
      <div className="tabs">
        {(['all', 'safe', 'need_help'] as const).map((item) => (
          <button key={item} className={filter === item ? 'pill active' : 'pill'} onClick={() => setFilter(item)} type="button">
            {item}
          </button>
        ))}
      </div>
      <div className="list">
        {filtered.map((response) => {
          const event = events.find((item) => item.id === response.eventId);
          return (
            <article className="list-item" key={response.id}>
              <div>
                <strong>{event?.title ?? 'Unknown Event'}</strong>
                <p>{new Date(response.updatedAt).toLocaleString()}</p>
              </div>
              <StatusBadge status={response.status} />
            </article>
          );
        })}
      </div>
    </section>
  );
}
