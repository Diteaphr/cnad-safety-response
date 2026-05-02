from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.models.event import Event
from app.models.event_department import EventDepartment


class EventRepository:
    def create(
        self,
        db: Session,
        *,
        title: str,
        event_type: str,
        description: Optional[str],
        status: str,
        created_by: uuid.UUID,
        start_time,
    ) -> Event:
        event = Event(
            title=title,
            event_type=event_type,
            description=description,
            status=status,
            created_by=created_by,
            start_time=start_time,
        )
        db.add(event)
        db.flush()
        return event

    def add_departments(
        self, db: Session, event_id: uuid.UUID, department_ids: list[uuid.UUID]
    ) -> list[EventDepartment]:
        rows: list[EventDepartment] = []
        for did in department_ids:
            row = EventDepartment(event_id=event_id, department_id=did)
            db.add(row)
            rows.append(row)
        db.flush()
        return rows

    def get_by_id(self, db: Session, event_id: uuid.UUID) -> Optional[Event]:
        stmt = (
            select(Event)
            .options(selectinload(Event.event_departments))
            .where(Event.event_id == event_id)
        )
        return db.execute(stmt).scalar_one_or_none()

    def list_all(self, db: Session) -> list[Event]:
        stmt = (
            select(Event)
            .options(selectinload(Event.event_departments))
            .order_by(Event.created_at.desc())
        )
        return list(db.scalars(stmt).all())

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
