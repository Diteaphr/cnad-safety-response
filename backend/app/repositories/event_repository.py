from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.models.event import Event


class EventRepository:
    def create(
        self,
        db: Session,
        *,
        title: str,
        event_type_id: uuid.UUID,
        description: Optional[str],
        location: Optional[str],
        status: str,
        created_by: uuid.UUID,
        start_time,
    ) -> Event:
        event = Event(
            title=title,
            event_type_id=event_type_id,
            description=description,
            location=location,
            status=status,
            created_by=created_by,
            start_time=start_time,
        )
        db.add(event)
        db.flush()
        return event

    def update(
        self,
        db: Session,
        event_id: uuid.UUID,
        *,
        title: str,
        event_type_id: uuid.UUID,
        description: Optional[str],
        location: Optional[str],
        start_time,
    ) -> None:
        ev = db.get(Event, event_id)
        if ev is None:
            raise ValueError(f"Event {event_id} not found")
        ev.title = title
        ev.event_type_id = event_type_id
        ev.description = description
        ev.location = location
        ev.start_time = start_time
        db.flush()

    def get_by_id(self, db: Session, event_id: uuid.UUID) -> Optional[Event]:
        stmt = (
            select(Event)
            .options(selectinload(Event.event_type_row))
            .where(Event.event_id == event_id)
        )
        return db.execute(stmt).scalar_one_or_none()

    def list_all(self, db: Session) -> list[Event]:
        stmt = (
            select(Event)
            .options(selectinload(Event.event_type_row))
            .order_by(Event.created_at.desc())
        )
        return list(db.scalars(stmt).all())

    def latest_active(self, db: Session) -> Optional[Event]:
        stmt = (
            select(Event)
            .options(selectinload(Event.event_type_row))
            .where(Event.status == "active")
            .order_by(Event.created_at.desc())
            .limit(1)
        )
        return db.execute(stmt).scalar_one_or_none()

    def list_active_ids(self, db: Session) -> list[uuid.UUID]:
        stmt = select(Event.event_id).where(Event.status == "active")
        return list(db.scalars(stmt).all())

    def set_status(self, db: Session, event_id: uuid.UUID, status: str) -> None:
        ev = db.get(Event, event_id)
        if ev:
            ev.status = status
            db.flush()

    def close_all_active_except(
        self, db: Session, keep_event_id: uuid.UUID
    ) -> None:
        db.execute(
            update(Event)
            .where(Event.status == "active", Event.event_id != keep_event_id)
            .values(status="closed")
        )
        db.flush()
