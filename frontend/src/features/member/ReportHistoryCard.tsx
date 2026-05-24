import { Check, LifeBuoy, Pencil } from 'lucide-react';
import { useLocale } from '../../locale/LocaleContext';
import { getStrings } from '../../locale/strings';
import { stripRedundantStatusFromTitle } from '../../lib/adminEventDisplay';
import type { EventItem, SafetyResponse } from '../../types';
import { formatEmployeeCardTime } from './memberFormat';

export function ReportHistoryCard({
  event,
  latest,
  currentDepartment,
  editable = false,
  onEdit,
}: {
  event: EventItem;
  latest: SafetyResponse;
  currentDepartment: string;
  editable?: boolean;
  onEdit?: () => void;
}) {
  const { locale } = useLocale();
  const ec = getStrings(locale).employee;
  const isSafe = latest.status === 'safe';
  const deptLabel = event.cardDepartment ?? currentDepartment;
  const eventTimeSource = event.startAt ?? event.createdAt;
  const metaLine = [deptLabel, formatEmployeeCardTime(eventTimeSource, locale)].filter(Boolean).join(' · ');

  return (
    <div className="report-history-card">
      <span
        className={`report-history-status-icon${isSafe ? ' report-history-status-icon--safe' : ' report-history-status-icon--need'}`}
        aria-hidden
      >
        {isSafe ? <Check size={17} strokeWidth={3} /> : <LifeBuoy size={16} strokeWidth={2.25} />}
      </span>

      <div className="report-history-card-main">
        <div className="report-history-card-title-row">
          <span className="report-history-card-title">{stripRedundantStatusFromTitle(event.title)}</span>
          <span className="report-history-card-type">{event.type}</span>
        </div>
        <span className="report-history-card-meta muted-text subtle">{metaLine}</span>
      </div>

      {editable ? (
        <button
          type="button"
          className="report-history-edit-btn"
          aria-label={ec.historyEditAria}
          onClick={onEdit}
        >
          <Pencil size={16} strokeWidth={2} aria-hidden />
          <span className="report-history-edit-label">{ec.historyEditLabel}</span>
        </button>
      ) : null}
    </div>
  );
}
