import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Flame,
  HelpCircle,
  Lightbulb,
  Plus,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { AdminEventListRow, Department } from '../../types';
import { useLocale } from '../../locale/LocaleContext';
import { getStrings } from '../../locale/strings';
import {
  AdminQuickCreateFormFields,
  type EventFormState,
} from './EventAndAdminPages';
import { scrollPortalMainToTop } from '../../lib/scrollPortalMain';

function typeLabel(ev: string, p: ReturnType<typeof getStrings>['portal']) {
  switch (ev) {
    case 'Earthquake':
      return p.eventTypeEarthquake;
    case 'Typhoon':
      return p.eventTypeTyphoon;
    case 'Fire':
      return p.eventTypeFire;
    case 'Other':
      return p.eventTypeOther;
    default:
      return ev;
  }
}

function TypeIcon({ type }: { type: string }) {
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

function scopeOnly(
  row: AdminEventListRow,
  departments: Department[],
  p: ReturnType<typeof getStrings>['portal'],
): string {
  const ev = row.event;
  const tids = ev.targetDepartmentIds ?? [];
  if (tids.length === 0) return p.adminScopeAllEmployees;
  if (ev.cardDepartment?.trim()) return ev.cardDepartment.trim();
  const names = tids
    .map((id) => departments.find((d) => d.id === id)?.name)
    .filter(Boolean) as string[];
  if (names.length === 0) return `—`;
  if (names.length <= 2) return names.join('、');
  return `${names[0]} · +${names.length - 1}`;
}

function stripRedundantStatusFromTitle(title: string): string {
  return title
    .replace(/（進行中）|（已結案）|（已結束）/g, '')
    .replace(/\s*\(In progress\)\s*|\s*\(Closed\)\s*|\s*\(Resolved\)\s*/gi, '')
    .trim();
}

/** 事件開始時間（後端 start_time）；未設定時顯示 — */
function formatEventStart(iso: string | null, locale: string): string {
  if (iso == null || iso === '') return '—';
  const loc = locale === 'en' ? 'en-US' : 'zh-TW';
  return new Date(iso).toLocaleString(loc, { dateStyle: 'short', timeStyle: 'short' });
}

export function AdminEventCenterPage({
  rows,
  departments,
  onSelectEvent,
  adminQuickCreate,
}: {
  rows: AdminEventListRow[];
  departments: Department[];
  onSelectEvent: (eventId: string) => void;
  adminQuickCreate: {
    eventForm: EventFormState;
    setEventForm: (value: EventFormState) => void;
    eventTypeCatalog: { name: string }[] | null;
    departments: Department[];
    onSubmitCreate: () => Promise<boolean>;
  };
}) {
  const { locale } = useLocale();
  const { portal: p, dash, statusBadge } = getStrings(locale);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [searchText, setSearchText] = useState('');
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
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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

  const onRowKeyDown = (eventId: string) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onSelectEvent(eventId);
  };

  return (
    <section className="page-section admin-event-center">
      {createModalOpen ? (
        <div
          className="modal-backdrop admin-create-event-backdrop"
          role="presentation"
          onClick={() => !createSubmitting && setCreateModalOpen(false)}
        >
          <div
            className="modal admin-create-event-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-create-event-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="admin-create-event-title">{p.adminOverviewCreateTitle}</h3>
            <p className="muted-text small">{p.adminOverviewCreateBody}</p>
            <AdminQuickCreateFormFields
              p={p}
              eventForm={adminQuickCreate.eventForm}
              setEventForm={adminQuickCreate.setEventForm}
              eventTypeCatalog={adminQuickCreate.eventTypeCatalog}
              departments={adminQuickCreate.departments}
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
          </div>
        </div>
      ) : null}

      <header className="admin-event-center-header">
        <div>
          <h2 className="admin-event-center-title">{p.eventManagement}</h2>
          <p className="muted-text admin-event-center-sub">{p.adminEventCenterSubtitle}</p>
        </div>
      </header>

      <div className="admin-event-center-toolbar">
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
        <div className="admin-event-center-toolbar-right">
          <input
            type="search"
            className="admin-event-center-search"
            placeholder={p.adminEventCenterSearchPlaceholder}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label={p.adminEventCenterSearchPlaceholder}
          />
        </div>
      </div>

      <div className="admin-event-center-table-wrap">
        <div className="admin-event-center-table">
          {pageRows.length === 0 ? (
            <p className="empty muted-text admin-event-center-empty">{p.adminEventCenterEmpty}</p>
          ) : (
            <>
              <div className="admin-event-center-thead" role="row">
                <span className="admin-event-center-th admin-event-center-th--event">{p.adminEventCenterColEvent}</span>
                <span className="admin-event-center-th">{p.adminEventCenterColStatus}</span>
                <span className="admin-event-center-th">{p.adminEventCenterColProgress}</span>
                <span className="admin-event-center-th">{p.adminEventCenterColStats}</span>
                <span className="admin-event-center-th admin-event-center-th--chev" aria-hidden />
              </div>
              <div className="admin-event-center-tbody" role="presentation">
                {pageRows.map((row) => {
                  const { event, total, safe, needHelp, pending, responseRate, reported } = row;
                  const progressTone = responseRate >= 70 ? 'is-high' : 'is-mid';
                  const barWidth = total > 0 ? Math.min(100, responseRate) : 0;
                  const scopeTime = `${scopeOnly(row, departments, p)} · ${formatEventStart(event.startAt, locale)}`;
                  const titleDisplay = stripRedundantStatusFromTitle(event.title);
                  return (
                    <div
                      key={event.id}
                      className="admin-event-center-row"
                      role="row"
                      tabIndex={0}
                      onClick={onRowClick(event.id)}
                      onKeyDown={onRowKeyDown(event.id)}
                      aria-label={event.title}
                    >
                      <div className="admin-event-center-card-head">
                        <div className="admin-event-center-cell admin-event-center-cell--event">
                          <div className={`admin-event-center-type-icon admin-event-center-type-icon--${event.type}`}>
                            <TypeIcon type={event.type} />
                          </div>
                          <div className="admin-event-center-event-text">
                            <span className="muted-text small admin-event-center-event-type">
                              {typeLabel(event.type, p)}
                            </span>
                            <strong className="admin-event-center-event-title">{titleDisplay}</strong>
                            <span className="muted-text small admin-event-center-event-sub">{scopeTime}</span>
                          </div>
                        </div>
                        <div className="admin-event-center-cell admin-event-center-cell--status">
                          <span
                            className={`admin-event-center-status-pill admin-event-center-status-pill--${event.status === 'closed' ? 'closed' : 'active'}`}
                          >
                            {event.status === 'closed' ? dash.closed : dash.ongoing}
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
                        <div className={`admin-event-center-progress-track ${progressTone}`}>
                          <div className="admin-event-center-progress-fill" style={{ width: `${barWidth}%` }} />
                        </div>
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
                          <li>
                            <span className="admin-event-center-dot admin-event-center-dot--pending" />
                            {statusBadge.pending} {pending}
                          </li>
                        </ul>
                      </div>
                    </div>
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
        <div className="admin-event-center-tip" role="status">
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
        </div>
      ) : null}

      <button
        type="button"
        className="portal-admin-create-extended"
        onClick={() => setCreateModalOpen(true)}
        aria-label={p.fabCreateEventAria}
        aria-haspopup="dialog"
      >
        <Plus size={22} strokeWidth={2.4} aria-hidden />
        <span>{p.createEventButton}</span>
      </button>
    </section>
  );
}
