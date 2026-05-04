import { useLocale } from '../locale/LocaleContext';
import { getStrings } from '../locale/strings';
import type { EventItem } from '../types';

function typeLabel(eventType: EventItem['type'], p: ReturnType<typeof getStrings>['portal']): string {
  switch (eventType) {
    case 'Earthquake':
      return p.eventTypeEarthquake;
    case 'Typhoon':
      return p.eventTypeTyphoon;
    case 'Fire':
      return p.eventTypeFire;
    case 'Other':
      return p.eventTypeOther;
    default:
      return eventType;
  }
}

export function EventCard({ event }: { event: EventItem }) {
  const { locale } = useLocale();
  const p = getStrings(locale).portal;
  const localeTag = locale === 'en' ? 'en-US' : 'zh-TW';
  const chipLabel =
    event.status === 'draft' ? p.eventChipDraft : event.status === 'active' ? p.eventChipActive : p.eventChipClosed;
  const body = event.description?.trim() ? event.description.trim() : p.noDescription;

  return (
    <section className="event-card">
      <div className="event-card-header">
        <h3>{event.title}</h3>
        <span className={`event-state ${event.status}`}>{chipLabel}</span>
      </div>
      <p className="event-card-body-text">{body}</p>
      <div className="event-card-meta-row" aria-label={`${p.eventLabelType}; ${p.eventLabelStart}`}>
        <span>
          {p.eventLabelType}: {typeLabel(event.type, p)}
        </span>
        <span>
          {p.eventLabelStart}:{' '}
          {new Date(event.startAt).toLocaleString(localeTag, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>
      </div>
    </section>
  );
}
