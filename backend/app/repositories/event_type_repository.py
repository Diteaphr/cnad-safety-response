from __future__ import annotations

import re
import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.event_type import EventType


class EventTypeRepository:
    def get_by_id(self, db: Session, event_type_id: uuid.UUID) -> Optional[EventType]:
        return db.get(EventType, event_type_id)

    def get_by_label(self, db: Session, label: str) -> Optional[EventType]:
        """Match display name or code (case-insensitive)."""
        raw = label.strip()
        if not raw:
            return None
        lowered = raw.lower()
        stmt = select(EventType).where(
            (func.lower(EventType.name) == lowered)
            | (func.lower(EventType.code) == lowered)
        )
        return db.execute(stmt).scalar_one_or_none()

    def list_all(self, db: Session) -> list[EventType]:
        stmt = select(EventType).order_by(EventType.code.asc())
        return list(db.scalars(stmt).all())

    def _slug_code(self, label: str) -> str:
        ascii_slug = re.sub(r"[^a-z0-9]+", "_", label.lower().strip())
        ascii_slug = ascii_slug.strip("_")[:60]
        if ascii_slug:
            return ascii_slug
        return f"custom_{uuid.uuid4().hex[:12]}"

    def get_or_create_by_display_name(self, db: Session, display_name: str) -> EventType:
        """Reuse existing row if name matches (case-insensitive); else insert with unique code."""
        name = display_name.strip()
        if not name:
            raise ValueError("display_name must be non-empty")
        existing = self.get_by_label(db, name)
        if existing is not None:
            return existing
        base = self._slug_code(name)
        code = base
        for n in range(0, 200):
            clash = db.execute(
                select(EventType.event_type_id).where(EventType.code == code)
            ).scalar_one_or_none()
            if clash is None:
                break
            suffix = uuid.uuid4().hex[:8] if n > 50 else str(n + 1)
            code = f"{base}_{suffix}"[:64]
        row = EventType(event_type_id=uuid.uuid4(), code=code, name=name)
        db.add(row)
        db.flush()
        return row
