from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notification import Notification


class NotificationRepository:
    def get_by_event_user_channel(
        self, db: Session, event_id: uuid.UUID, user_id: uuid.UUID, channel: str
    ) -> Optional[Notification]:
        stmt = select(Notification).where(
            Notification.event_id == event_id,
            Notification.user_id == user_id,
            Notification.channel == channel,
        )
        return db.execute(stmt).scalar_one_or_none()

    def list_for_user(
        self, db: Session, user_id: uuid.UUID
    ) -> list[Notification]:
        stmt = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.sent_at.desc())
        )
        return list(db.scalars(stmt).all())

    def create_or_update_status(
        self,
        db: Session,
        *,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
        channel: str,
        status: str,
        sent_at: Optional[datetime] = None,
    ) -> Notification:
        row = self.get_by_event_user_channel(db, event_id, user_id, channel)
        if row is None:
            row = Notification(
                event_id=event_id,
                user_id=user_id,
                channel=channel,
                status=status,
                sent_at=sent_at,
            )
            db.add(row)
        else:
            row.status = status
            row.sent_at = sent_at
        db.flush()
        return row
