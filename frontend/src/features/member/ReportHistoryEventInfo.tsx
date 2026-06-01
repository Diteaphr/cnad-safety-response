import { useLocale } from '../../locale/LocaleContext';
import { getStrings } from '../../locale/strings';
import { formatEventImpactScope, stripRedundantStatusFromTitle } from '../../lib/adminEventDisplay';
import type { Department, EventItem } from '../../types';
import { formatEmployeeCardTime } from './memberFormat';

type ReportHistoryEventInfoProps = Readonly<{
  event: EventItem;
  departments: Department[];
  titleId?: string;
}>;

export function ReportHistoryEventInfo(props: ReportHistoryEventInfoProps) {
  const { event, departments, titleId } = props;
  const { locale } = useLocale();
  const strings = getStrings(locale);
  const deptLabel = formatEventImpactScope(event, departments, strings.portal);
  const eventTimeSource = event.startAt ?? event.createdAt;
  const metaLine = [deptLabel, formatEmployeeCardTime(eventTimeSource, locale)]
    .filter((part) => part && part !== '—')
    .join(' · ');

  return (
    <div className="report-history-event-info">
      <div className="report-history-card-title-row">
        <span className="report-history-card-title" id={titleId}>
          {stripRedundantStatusFromTitle(event.title)}
        </span>
        <span className="report-history-card-type">{event.type}</span>
      </div>
      {metaLine ? <span className="report-history-card-meta muted-text subtle">{metaLine}</span> : null}
    </div>
  );
}
