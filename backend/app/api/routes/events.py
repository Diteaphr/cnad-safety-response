from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_actor_user_id
from app.core.database import get_db
from app.schemas.event import EventCreate, EventOut
from app.schemas.response import SafetyResponseCreate, SafetyResponseOut
from app.services.event_service import EventService
from app.services.safety_response_service import SafetyResponseService

router = APIRouter(prefix="/events", tags=["events"])

_event_service = EventService()
_response_service = SafetyResponseService()


@router.post("", response_model=EventOut)
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
    actor_user_id: uuid.UUID = Depends(get_actor_user_id),
):
    event = _event_service.create_event(db, actor_user_id=actor_user_id, payload=payload)
    return event


@router.post("/{event_id}/responses", response_model=SafetyResponseOut)
def submit_response(
    event_id: uuid.UUID,
    payload: SafetyResponseCreate,
    db: Session = Depends(get_db),
    actor_user_id: uuid.UUID = Depends(get_actor_user_id),
):
    return _response_service.submit_response(
        db,
        event_id=event_id,
        user_id=actor_user_id,
        payload=payload,
    )


@router.get("/{event_id}/responses", response_model=List[SafetyResponseOut])
def list_responses(event_id: uuid.UUID, db: Session = Depends(get_db)):
    rows = _response_service.list_responses(db, event_id)
    return rows
