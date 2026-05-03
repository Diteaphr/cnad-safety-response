import type { ReactNode } from 'react';
import type { EventUiStatus } from '../../locale/strings';

const STATUS_CLASS: Record<EventUiStatus, string> = {
  active: 'dash-event-status dash-event-status--active',
  resolved: 'dash-event-status dash-event-status--resolved',
  monitoring: 'dash-event-status dash-event-status--monitoring',
  escalated: 'dash-event-status dash-event-status--escalated',
};

/** Event summary ribbon — typography aligned with supervisor reference. */
export function EventOverviewCard({
  icon,
  typeLabel,
  title,
  uiStatus,
  statusLabel,
  description,
  lastUpdatedFormatted,
  tailNote,
}: {
  icon?: ReactNode;
  typeLabel: string;
  title: string;
  uiStatus: EventUiStatus;
  statusLabel: string;
  description: string;
  lastUpdatedFormatted: string | null;
  tailNote?: string;
}) {
  return (
    <article className="dash-event-overview">
      <div className="dash-event-overview-inner">
        <div className="dash-event-overview-left">
          <div className="dash-event-icon" aria-hidden>
            {icon ?? <span className="dash-event-icon-fallback" />}
          </div>
          <div>
            <p className="dash-event-type muted-text">{typeLabel}</p>
            <h2 className="dash-event-title">{title}</h2>
            {lastUpdatedFormatted ? (
              <p className="dash-event-updated muted-text">{lastUpdatedFormatted}</p>
            ) : null}
          </div>
        </div>
        <div className="dash-event-overview-center">
          <span className={STATUS_CLASS[uiStatus]}>{statusLabel}</span>
        </div>
        <div className="dash-event-overview-right">
          <p className="dash-event-description">{description}</p>
          {tailNote ? <p className="dash-event-tail muted-text">{tailNote}</p> : null}
        </div>
      </div>
    </article>
  );
}
