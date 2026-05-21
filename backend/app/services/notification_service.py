"""
Idempotent notification sending: check PostgreSQL before calling external providers.

External calls (FCM / SMS) must run outside DB transactions.

Local dev: pass send_fn from app.services.integrations.mock_notification_channels
(send_fcm_mock / send_twilio_sms_mock). Production: swap for real providers.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.repositories.notification_repository import NotificationRepository

SENT_STATUS = "sent"
PENDING_STATUS = "pending"
FAILED_STATUS = "failed"


class NotificationService:
    def __init__(self) -> None:
        self._repo = NotificationRepository()

    def should_send(
        self, db: Session, event_id: uuid.UUID, user_id: uuid.UUID, channel: str
    ) -> bool:
        row = self._repo.get_by_event_user_channel(db, event_id, user_id, channel)
        if row is not None and row.status == SENT_STATUS:
            return False
        return True

    def deliver_with_idempotency(
        self,
        db: Session,
        *,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
        channel: str,
        send_fn: Callable[[], bool],
    ) -> Notification:
        """
        1) If already Sent -> return existing without calling send_fn.
        2) Mark Pending inside a short transaction.
        3) Commit, then call send_fn() outside the transaction.
        4) New transaction to persist Sent/Failed.
        """
        existing = self._repo.get_by_event_user_channel(
            db, event_id, user_id, channel
        )
        if existing is not None and existing.status == SENT_STATUS:
            return existing

        try:
            self._repo.create_or_update_status(
                db,
                event_id=event_id,
                user_id=user_id,
                channel=channel,
                status=PENDING_STATUS,
                sent_at=None,
            )
            db.commit()
        except Exception:
            db.rollback()
            raise

        ok = False
        try:
            ok = bool(send_fn())
        except Exception:
            ok = False

        try:
            row = self._repo.create_or_update_status(
                db,
                event_id=event_id,
                user_id=user_id,
                channel=channel,
                status=SENT_STATUS if ok else FAILED_STATUS,
                sent_at=datetime.now(timezone.utc) if ok else None,
            )
            db.commit()
        except Exception:
            db.rollback()
            raise
        return row

    def deliver_with_fallback(
        self,
        db: Session,
        *,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
        primary_channel: str,
        primary_send_fn: Callable[[], bool],
        fallback_channel: str | None = None,
        fallback_send_fn: Callable[[], bool] | None = None,
    ) -> None:
        """Send via primary channel; if it fails and a fallback is given, try that too."""
        result = self.deliver_with_idempotency(
            db,
            event_id=event_id,
            user_id=user_id,
            channel=primary_channel,
            send_fn=primary_send_fn,
        )
        if result.status == FAILED_STATUS and fallback_channel and fallback_send_fn:
            self.deliver_with_idempotency(
                db,
                event_id=event_id,
                user_id=user_id,
                channel=fallback_channel,
                send_fn=fallback_send_fn,
            )

    def to_dict(self, n: Notification) -> dict[str, Any]:
        return {
            "notification_id": str(n.notification_id),
            "event_id": str(n.event_id),
            "user_id": str(n.user_id),
            "channel": n.channel,
            "status": n.status,
            "sent_at": n.sent_at.isoformat() if n.sent_at else None,
        }
