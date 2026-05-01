import type { EventItem } from '../types';

export function EventCard({ event }: { event: EventItem }) {
  return (
    <section className="event-card">
      <div className="event-card-header">
        <h3>{event.title}</h3>
        <span className={`event-state ${event.status}`}>{event.status.toUpperCase()}</span>
      </div>
      <p>{event.description}</p>
      <div className="event-meta">
        <span>Type: {event.type}</span>
        <span>Start: {new Date(event.startAt).toLocaleString()}</span>
      </div>
    </section>
  );
}

