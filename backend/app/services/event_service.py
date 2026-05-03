import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.event_repository import EventRepository
from app.repositories.user_repository import UserRepository
from app.schemas.event import EventCreate
from app.services.integrations import pubsub_placeholder as pubsub

ADMIN_ROLE = "admin"


class EventService:
    def __init__(self) -> None:
        self._events = EventRepository()
        self._users = UserRepository()

    def create_event(
        self, db: Session, *, actor_user_id: uuid.UUID, payload: EventCreate
    ):
        if not self._users.user_has_role(db, actor_user_id, ADMIN_ROLE):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can create events.",
            )
        try:
            event = self._events.create(
                db,
                title=payload.title,
                event_type=payload.event_type,
                description=payload.description,
                status=payload.status,
                created_by=actor_user_id,
                start_time=payload.start_time,
            )
            self._events.add_departments(db, event.event_id, payload.department_ids)
            db.commit()
        except Exception:
            db.rollback()
            raise

        pubsub.publish_notification_event(
            pubsub.build_event_created_payload(event.event_id, actor_user_id)
        )

        full = self._events.get_by_id(db, event.event_id)
        if full is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Event persist failed after commit.",
            )
        return full
