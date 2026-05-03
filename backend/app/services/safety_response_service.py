import re
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.safety_response_repository import SafetyResponseRepository
from app.schemas.response import SafetyResponseCreate
from app.services.integrations import pubsub_placeholder as pubsub
from app.services.integrations import redis_placeholder as redis_stats

_NEED_HELP = re.compile(r"need[_\s-]?help", re.IGNORECASE)


class SafetyResponseService:
    def __init__(self) -> None:
        self._responses = SafetyResponseRepository()

    def submit_response(
        self,
        db: Session,
        *,
        event_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: SafetyResponseCreate,
    ):
        try:
            row = self._responses.upsert(
                db,
                event_id=event_id,
                user_id=user_id,
                status=payload.status,
                comment=payload.comment,
                location=payload.location,
            )
            db.commit()
        except Exception:
            db.rollback()
            raise

        redis_stats.refresh_dashboard_statistics(str(event_id))

        if _NEED_HELP.search(payload.status or ""):
            pubsub.publish_supervisor_alert(
                pubsub.build_need_help_payload(event_id, user_id)
            )

        refreshed = self._responses.get_by_event_and_user(db, event_id, user_id)
        if refreshed is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Safety response not found after upsert.",
            )
        return refreshed

    def list_responses(self, db: Session, event_id: uuid.UUID):
        return self._responses.list_for_event(db, event_id)
