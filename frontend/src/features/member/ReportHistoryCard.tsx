import { Check, LifeBuoy, Pencil } from 'lucide-react';
import { useLocale } from '../../locale/LocaleContext';
import { getStrings } from '../../locale/strings';
import type { Department, EventItem, SafetyResponse } from '../../types';
import { ReportHistoryEventInfo } from './ReportHistoryEventInfo';

type ReportHistoryCardProps = Readonly<{
  event: EventItem;
  latest: SafetyResponse;
  departments: Department[];
  editable?: boolean;
  onEdit?: () => void;
}>;

export function ReportHistoryCard(props: ReportHistoryCardProps) {
  const { event, latest, departments, editable = false, onEdit } = props;
  const { locale } = useLocale();
  const strings = getStrings(locale);
  const isSafe = latest.status === 'safe';

  return (
    <div className="report-history-card">
      <span
        className={`report-history-status-icon${isSafe ? ' report-history-status-icon--safe' : ' report-history-status-icon--need'}`}
        aria-hidden
      >
        {isSafe ? <Check size={17} strokeWidth={3} /> : <LifeBuoy size={16} strokeWidth={2.25} />}
      </span>

      <div className="report-history-card-main">
        <ReportHistoryEventInfo event={event} departments={departments} />
      </div>

      {editable ? (
        <button
          type="button"
          className="report-history-edit-btn"
          aria-label={strings.employee.historyEditAria}
          onClick={onEdit}
        >
          <Pencil size={16} strokeWidth={2} aria-hidden />
          <span className="report-history-edit-label">{strings.employee.historyEditLabel}</span>
        </button>
      ) : null}
    </div>
  );
}
