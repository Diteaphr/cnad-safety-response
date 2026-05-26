import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Flame,
  HelpCircle,
  Lightbulb,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AdminEventListRow, Department } from '../../types';
import { useLocale } from '../../locale/LocaleContext';
import { getStrings } from '../../locale/strings';
import {
  AdminQuickCreateFormFields,
  type EventFormState,
} from './EventAndAdminPages';
import { scrollPortalMainToTop } from '../../lib/scrollPortalMain';
import {
  formatAdminEventTypeLabel,
  formatEventImpactScope,
  stripRedundantStatusFromTitle,
} from '../../lib/adminEventDisplay';
import { formatEmployeeCardTime } from '../member/memberFormat';

function TypeIcon({ type }: Readonly<{ type: string }>) {
  const common = { size: 22 as const, strokeWidth: 2.1 as const, 'aria-hidden': true as const };
  switch (type) {
    case 'Earthquake':
      return <Activity {...common} />;
    case 'Typhoon':
      return <CloudRain {...common} />;
    case 'Fire':
      return <Flame {...common} />;
    case 'Other':
      return <HelpCircle {...common} />;
    default:
      return <HelpCircle {...common} />;
  }
}

/** 事件開始時間（後端 start_time）；未設定時顯示 — */
function formatEventStart(iso: string | null, locale: string): string {
  if (iso == null || iso === '') return '—';
  const loc = locale === 'en' ? 'en-US' : 'zh-TW';
  return new Date(iso).toLocaleString(loc, { dateStyle: 'short', timeStyle: 'short' });
}

function SupervisorStackedProgressBar({
  safe,
  needHelp,
  pending,
}: Readonly<{
  safe: number;
  needHelp: number;
  pending: number;
}>) {
  const totalSum = Math.max(safe + needHelp + pending, 1);
  const ws = `${(safe / totalSum) * 100}%`;
  const wn = `${(needHelp / totalSum) * 100}%`;
  const wp = `${(pending / totalSum) * 100}%`;

  return (
    <div className="sv-dist-stack-bar admin-event-center-stack-bar" aria-hidden>
      <div className="sv-dist-stack-track">
        {safe > 0 ? <div className="sv-dist-stack-seg sv-dist-stack-seg--safe" style={{ width: ws }} /> : null}
        {needHelp > 0 ? <div className="sv-dist-stack-seg sv-dist-stack-seg--need" style={{ width: wn }} /> : null}
        {pending > 0 ? <div className="sv-dist-stack-seg sv-dist-stack-seg--pending" style={{ width: wp }} /> : null}
      </div>
    </div>
  );
}

/** Narrow-view donut: stacked safe / need / pending arcs with response rate in center. */
function SupervisorMobileProgressRing({
  safe,
  needHelp,
  pending,
  responseRate,
}: Readonly<{
  safe: number;
  needHelp: number;
  pending: number;
  responseRate: number;
}>) {
  const size = 44;
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * radius;
  const total = safe + needHelp + pending;
  const totalMax = Math.max(total, 1);

  const parts: Array<{ key: 'safe' | 'need' | 'pending'; count: number }> = [];
  if (safe > 0) parts.push({ key: 'safe', count: safe });
  if (needHelp > 0) parts.push({ key: 'need', count: needHelp });
  if (pending > 0) parts.push({ key: 'pending', count: pending });

  const gapPx = parts.length > 1 ? 2.5 : 0;
  const gapTotal = gapPx * Math.max(parts.length - 1, 0);
  const usable = circumference - gapTotal;

  let cumulative = 0;
  const segments =
    parts.length === 0
      ? []
      : parts.map((part) => {
          const len = (part.count / totalMax) * usable;
          const seg = { ...part, len, dashoffset: -cumulative };
          cumulative += len + gapPx;
          return seg;
        });

  return (
    <div className="admin-event-center-progress-ring" role="img" aria-label={`${responseRate}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {segments.length === 0 ? (
          <circle
            cx={cx}
            cy={cx}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="admin-event-center-progress-ring-track"
          />
        ) : (
          <g transform={`rotate(-90 ${cx} ${cx})`}>
            {segments.map((seg) => (
              <circle
                key={seg.key}
                cx={cx}
                cy={cx}
                r={radius}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="round"
                className={`admin-event-center-progress-ring-seg admin-event-center-progress-ring-seg--${seg.key}`}
                strokeDasharray={`${seg.len} ${circumference - seg.len}`}
                strokeDashoffset={seg.dashoffset}
              />
            ))}
          </g>
        )}
      </svg>
      <span className="admin-event-center-progress-ring-pct">{responseRate}%</span>
    </div>
  );
}

export function AdminEventCenterPage({
  rows,
  departments,
  onSelectEvent,
  adminQuickCreate,
  variant = 'admin',
}: Readonly<{
  rows: AdminEventListRow[];
  departments: Department[];
  onSelectEvent: (eventId: string) => void;
  variant?: 'admin' | 'supervisor';
  adminQuickCreate?: {
    eventForm: EventFormState;
    setEventForm: (value: EventFormState) => void;
    eventTypeCatalog: { name: string }[] | null;
    departments: Department[];
    onSubmitCreate: () => Promise<boolean>;
    onPrepareCreate?: () => void;
    onEventTypesChanged?: () => void | Promise<void>;
    showToast?: (t: { tone: 'success' | 'warning' | 'danger' | 'info'; message: string }) => void;
  };
}>) {
  const { locale } = useLocale();
  const { portal: p, dash, statusBadge } = getStrings(locale);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [searchText, setSearchText] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [tipVisible, setTipVisible] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const createSubmittingRef = useRef(false);
  const prevPagingRef = useRef<{ page: number; pageSize: number } | null>(null);

  useEffect(() => {
    createSubmittingRef.current = createSubmitting;
  }, [createSubmitting]);

  useEffect(() => {
    if (!createModalOpen) return undefined;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !createSubmittingRef.current) setCreateModalOpen(false);
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [createModalOpen]);

  const counts = useMemo(() => {
    const active = rows.filter((r) => r.event.status === 'active').length;
    const closed = rows.filter((r) => r.event.status === 'closed').length;
    return { all: rows.length, active, closed };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return rows
      .filter((r) => (statusFilter === 'all' ? true : r.event.status === statusFilter))
      .filter((r) => (q ? r.event.title.toLowerCase().includes(q) : true));
  }, [rows, statusFilter, searchText]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchText, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    const prev = prevPagingRef.current;
    prevPagingRef.current = { page: safePage, pageSize };
    if (!prev || (prev.page === safePage && prev.pageSize === pageSize)) return;
    scrollPortalMainToTop();
  }, [safePage, pageSize]);

  const sliceFrom = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(sliceFrom, sliceFrom + pageSize);

  const submitQuickCreate = async () => {
    if (!adminQuickCreate) return;
    setCreateSubmitting(true);
    try {
      const ok = await adminQuickCreate.onSubmitCreate();
      if (ok) setCreateModalOpen(false);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const onRowClick = (eventId: string) => () => {
    onSelectEvent(eventId);
  };

  return (
    <section className="page-section admin-event-center supervisor-event-center">
      {variant === 'admin' && createModalOpen && adminQuickCreate ? (
        <div
          className="modal-backdrop admin-create-event-backdrop"
          aria-hidden="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !createSubmitting) {
              setCreateModalOpen(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
              if (!createSubmitting) setCreateModalOpen(false);
            }
          }}
        >
          <dialog
            open
            className="modal admin-create-event-modal"
            aria-modal="true"
            aria-labelledby="admin-create-event-title"
          >
            <h3 id="admin-create-event-title">{p.adminOverviewCreateTitle}</h3>
            <p className="muted-text small">{p.adminOverviewCreateBody}</p>
            <AdminQuickCreateFormFields
              p={p}
              eventForm={adminQuickCreate.eventForm}
              setEventForm={adminQuickCreate.setEventForm}
              eventTypeCatalog={adminQuickCreate.eventTypeCatalog}
              departments={adminQuickCreate.departments}
              onEventTypesChanged={adminQuickCreate.onEventTypesChanged}
              showToast={adminQuickCreate.showToast}
            />
            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                disabled={createSubmitting}
                onClick={() => setCreateModalOpen(false)}
              >
                {p.adminCreateModalCancel}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={createSubmitting}
                onClick={() => void submitQuickCreate()}
              >
                {createSubmitting ? '…' : p.createEventButton}
              </button>
            </div>
          </dialog>
        </div>
      ) : null}

      <header className="admin-event-center-header">
        <div>
          <h2 className="admin-event-center-title">
            {variant === 'supervisor' ? dash.teamHomeTitle : p.eventManagement}
          </h2>
          <p className="muted-text admin-event-center-sub">
            {variant === 'supervisor' ? dash.teamHomeSubtitle : p.adminEventCenterSubtitle}
          </p>
        </div>
      </header>

      <div className="admin-event-center-toolbar supervisor-event-center-toolbar">
        <div className="event-filter-chips admin-event-center-tabs" role="tablist" aria-label={p.eventFilterLabel}>
          {(
            [
              ['all', p.filterAll, counts.all],
              ['active', p.filterActive, counts.active],
              ['closed', p.filterClosed, counts.closed],
            ] as const
          ).map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              className={`event-filter-chip${statusFilter === key ? ' is-active' : ''}`}
              onClick={() => setStatusFilter(key)}
            >
              {label} ({n})
            </button>
          ))}
        </div>
        <label className="sv-roster-search sv-roster-search--desktop supervisor-event-center-search">
          <Search className="sv-roster-search-icon" size={18} aria-hidden />
          <input
            type="search"
            placeholder={p.adminEventCenterSearchPlaceholder}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label={p.adminEventCenterSearchPlaceholder}
          />
        </label>
        <button
          type="button"
          className="sv-roster-search-toggle sv-roster-search--mobile supervisor-event-center-search-toggle"
          aria-label={p.adminEventCenterSearchPlaceholder}
          aria-expanded={searchExpanded}
          onClick={() => setSearchExpanded((open) => !open)}
        >
          <Search size={20} aria-hidden />
        </button>
      </div>
      {searchExpanded ? (
        <label className="sv-roster-search sv-roster-search--mobile-expanded supervisor-event-center-search-expanded">
          <Search className="sv-roster-search-icon" size={18} aria-hidden />
          <input
            type="search"
            placeholder={p.adminEventCenterSearchPlaceholder}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label={p.adminEventCenterSearchPlaceholder}
            autoFocus
          />
        </label>
      ) : null}

      <div className="admin-event-center-table-wrap">
        <div className="admin-event-center-table">
          {pageRows.length === 0 ? (
            <p className="empty muted-text admin-event-center-empty">{p.adminEventCenterEmpty}</p>
          ) : (
            <>
              <div className="admin-event-center-thead">
                <span className="admin-event-center-th admin-event-center-th--event">{p.adminEventCenterColEvent}</span>
                <span className="admin-event-center-th">{p.adminEventCenterColStatus}</span>
                <span className="admin-event-center-th">{p.adminEventCenterColProgress}</span>
                <span className="admin-event-center-th">{p.adminEventCenterColStats}</span>
                <span className="admin-event-center-th admin-event-center-th--chev" aria-hidden />
              </div>
              <div className="admin-event-center-tbody">
                {pageRows.map((row) => {
                  const { event, total, safe, needHelp, pending, responseRate, reported } = row;
                  const scopeTime = `${formatEventImpactScope(event, departments, p)} · ${formatEventStart(event.startAt, locale)}`;
                  const titleDisplay = stripRedundantStatusFromTitle(event.title);
                  const typeLabel = formatAdminEventTypeLabel(event.type, p);
                  const createdLine = formatEmployeeCardTime(event.startAt ?? event.createdAt, locale);
                  const isClosed = event.status === 'closed';

                  return (
                    <button
                      type="button"
                      key={event.id}
                      className="admin-event-center-row admin-event-center-row--supervisor"
                      aria-label={event.title}
                      onClick={onRowClick(event.id)}
                    >
                      <div className="admin-event-center-card-head">
                        <div className="admin-event-center-cell admin-event-center-cell--event">
                          <SupervisorMobileProgressRing
                            safe={safe}
                            needHelp={needHelp}
                            pending={pending}
                            responseRate={responseRate}
                          />
                          <div className={`admin-event-center-type-icon admin-event-center-type-icon--${event.type} admin-event-center-type-icon--wide`}>
                            <TypeIcon type={event.type} />
                          </div>
                          <div className="admin-event-center-event-text">
                            <div className="admin-event-center-event-title-row">
                              <strong className="admin-event-center-event-title">{titleDisplay}</strong>
                              <span className="muted-text small admin-event-center-event-type-inline">{typeLabel}</span>
                            </div>
                            <span className="muted-text small admin-event-center-event-sub admin-event-center-event-sub--mobile-time">
                              {createdLine}
                            </span>
                            <span className="muted-text small admin-event-center-event-type admin-event-center-event-type--wide">
                              {typeLabel}
                            </span>
                            <strong className="admin-event-center-event-title admin-event-center-event-title--wide">
                              {titleDisplay}
                            </strong>
                            <span className="muted-text small admin-event-center-event-sub admin-event-center-event-sub--wide">
                              {scopeTime}
                            </span>
                          </div>
                        </div>
                        <div className="admin-event-center-cell admin-event-center-cell--status">
                          <span
                            className={`admin-event-center-status-pill admin-event-center-status-pill--${isClosed ? 'closed' : 'active'}`}
                          >
                            {isClosed ? dash.closed : dash.ongoing}
                          </span>
                        </div>
                        <div className="admin-event-center-cell admin-event-center-cell--chev" aria-hidden>
                          <ChevronRight className="admin-event-center-chevron" size={20} />
                        </div>
                      </div>
                      <div className="admin-event-center-cell admin-event-center-cell--progress">
                        <div className="admin-event-center-progress-head">
                          <span className="admin-event-center-pct">{responseRate}%</span>
                        </div>
                        <SupervisorStackedProgressBar safe={safe} needHelp={needHelp} pending={pending} />
                        <span className="muted-text small admin-event-center-reported-line">
                          {p.adminEventCenterReportedOfTotal(reported, total)}
                        </span>
                      </div>
                      <div className="admin-event-center-cell admin-event-center-cell--stats">
                        <ul className="admin-event-center-stat-dots">
                          <li>
                            <span className="admin-event-center-dot admin-event-center-dot--safe" />
                            {statusBadge.safe} {safe}
                          </li>
                          <li>
                            <span className="admin-event-center-dot admin-event-center-dot--help" />
                            {statusBadge.needHelp} {needHelp}
                          </li>
                        </ul>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {filtered.length > 0 ? (
        <footer className="admin-event-center-footer">
          <span className="muted-text small admin-event-center-range">
            {p.adminEventCenterPageRange(
              filtered.length === 0 ? 0 : sliceFrom + 1,
              Math.min(sliceFrom + pageSize, filtered.length),
              filtered.length,
            )}
          </span>
          <div className="admin-event-center-pagination">
            <button
              type="button"
              className="btn ghost btn-sm admin-event-center-page-btn"
              disabled={safePage <= 1}
              onClick={() => setPage(Math.max(1, safePage - 1))}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <span className="muted-text small admin-event-center-page-num">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              className="btn ghost btn-sm admin-event-center-page-btn"
              disabled={safePage >= totalPages}
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
          <label className="admin-event-center-per-page muted-text small">
            {p.adminEventCenterPerPage}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label={p.adminEventCenterPerPage}
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </footer>
      ) : null}

      {tipVisible ? (
        <output className="admin-event-center-tip">
          <Lightbulb size={18} className="admin-event-center-tip-icon" aria-hidden />
          <p>{p.adminEventCenterTip}</p>
          <button
            type="button"
            className="admin-event-center-tip-close"
            aria-label={p.adminEventCenterTipDismissAria}
            onClick={() => setTipVisible(false)}
          >
            <X size={18} />
          </button>
        </output>
      ) : null}

      {variant === 'admin' && adminQuickCreate ? (
        <button
          type="button"
          className="portal-admin-create-extended"
          onClick={() => {
            adminQuickCreate.onPrepareCreate?.();
            setCreateModalOpen(true);
          }}
          aria-label={p.fabCreateEventAria}
          aria-haspopup="dialog"
        >
          <Plus size={22} strokeWidth={2.4} aria-hidden />
          <span>{p.createEventButton}</span>
        </button>
      ) : null}
    </section>
  );
}
