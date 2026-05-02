from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.safety_response import SafetyResponse


class SafetyResponseRepository:
    def upsert(
        self,
        db: Session,
        *,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
        status: str,
        comment: Optional[str],
        location: Optional[str],
    ) -> SafetyResponse:
        now = datetime.now(timezone.utc)
        new_id = uuid.uuid4()
        stmt = (
            insert(SafetyResponse)
            .values(
                response_id=new_id,
                event_id=event_id,
                user_id=user_id,
                status=status,
                comment=comment,
                location=location,
                responded_at=now,
            )
            .on_conflict_do_update(
                constraint="uq_safety_responses_event_user",
                set_={
                    "status": status,
                    "comment": comment,
                    "location": location,
                    "responded_at": now,
                },
            )
        )
        db.execute(stmt)
        row = self.get_by_event_and_user(db, event_id, user_id)
        if row is None:
            raise RuntimeError("Upsert did not produce a row")
        return row

    def get_by_event_and_user(
        self, db: Session, event_id: uuid.UUID, user_id: uuid.UUID
    ) -> Optional[SafetyResponse]:
        stmt = select(SafetyResponse).where(
            SafetyResponse.event_id == event_id,
            SafetyResponse.user_id == user_id,
        )
        return db.execute(stmt).scalar_one_or_none()

    def list_for_event(self, db: Session, event_id: uuid.UUID) -> list[SafetyResponse]:
        stmt = select(SafetyResponse).where(SafetyResponse.event_id == event_id)
        return list(db.scalars(stmt).all())

    def list_for_user(self, db: Session, user_id: uuid.UUID) -> list[SafetyResponse]:
        stmt = (
            select(SafetyResponse)
            .where(SafetyResponse.user_id == user_id)
            .order_by(SafetyResponse.responded_at.desc())
        )
        return list(db.scalars(stmt).all())

    def list_all(self, db: Session) -> list[SafetyResponse]:
        stmt = select(SafetyResponse)
        return list(db.scalars(stmt).all())
