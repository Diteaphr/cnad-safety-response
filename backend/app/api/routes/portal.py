"""HTTP layer for SPA — delegates to PortalService (business) + repositories (data)."""

from __future__ import annotations

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import SessionLocal, get_db
from app.schemas.portal import AdminUserCreateIn, AdminUserUpdateIn, CreateEventIn, DemoLoginIn, EventActionIn, LoginIn, ProfileUpdateIn, RegisterIn, ReportIn
from app.services.portal_service import PortalService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["portal"])

_portal = PortalService()

CurrentUser = Annotated[uuid.UUID, Depends(get_current_user)]


def _parse_uuid(s: str, *, name: str) -> uuid.UUID:
    try:
        return uuid.UUID(s.strip())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid {name}") from e


# ------------------------------------------------------------------
# Public endpoints (no auth required)
# ------------------------------------------------------------------

@router.get("/departments")
def get_departments(db: Session = Depends(get_db)):
    return {"departments": _portal.list_departments(db)}


@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    return {"users": _portal.list_users(db)}


@router.get("/events")
def get_events(db: Session = Depends(get_db)):
    return {"events": _portal.list_events(db)}


@router.get("/reports")
def get_all_reports(db: Session = Depends(get_db)):
    return {"reports": _portal.list_responses(db)}


@router.get("/demo-accounts")
def demo_accounts():
    return {"accounts": _portal.demo_accounts()}


@router.post("/auth/register")
def register_account(payload: RegisterIn, db: Session = Depends(get_db)):
    return _portal.register(db, payload)


@router.post("/auth/login")
def login_with_email(payload: LoginIn, db: Session = Depends(get_db)):
    return _portal.login(db, payload)


@router.post("/auth/demo-login")
def demo_login(payload: DemoLoginIn, db: Session = Depends(get_db)):
    return _portal.issue_demo_login_token(db, user_id_str=payload.userId.strip())


# ------------------------------------------------------------------
# Protected endpoints (JWT required)
# ------------------------------------------------------------------

@router.get("/bootstrap")
def bootstrap(actor: CurrentUser, db: Session = Depends(get_db)):
    return _portal.bootstrap(db, actor)


@router.post("/events")
def create_event(
    payload: CreateEventIn,
    actor: CurrentUser,
    db: Session = Depends(get_db),
):
    return _portal.create_event(db, actor_id=actor, payload=payload)


def _dispatch_activation_background(event_id: uuid.UUID) -> None:
    """Run notification fan-out in a background task (dev mode without Pub/Sub)."""
    from app.services.notification_dispatch import dispatch_activation_notifications
    db = SessionLocal()
    try:
        dispatch_activation_notifications(db, event_id)
    except Exception:
        logger.exception("Background activation dispatch failed for event %s", event_id)
    finally:
        db.close()


@router.post("/events/{event_id}/activate")
def activate_event(
    event_id: str,
    actor: CurrentUser,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    body: EventActionIn | None = None,
):
    eid = _parse_uuid(event_id, name="event_id")
    result = _portal.activate_event(db, actor_id=actor, event_id=eid)

    if settings.use_gcp:
        # Production: publish one trigger message to Pub/Sub.
        # The /api/internal/notifications/dispatch endpoint handles the fan-out
        # when Pub/Sub push delivers the message to Cloud Run.
        from app.services.integrations.pubsub_placeholder import publish_notification_event
        publish_notification_event({"kind": "activation", "event_id": str(eid)})
    else:
        # Dev: run notification fan-out in a background task.
        # FastAPI sends the HTTP response first, then executes the task —
        # mimicking Pub/Sub's async behaviour without requiring a real broker.
        background_tasks.add_task(_dispatch_activation_background, eid)

    return result


@router.post("/events/{event_id}/close")
def close_event(
    event_id: str,
    actor: CurrentUser,
    db: Session = Depends(get_db),
):
    eid = _parse_uuid(event_id, name="event_id")
    return _portal.close_event(db, actor_id=actor, event_id=eid)


@router.post("/events/{event_id}/reminders")
def send_reminders(
    event_id: str,
    actor: CurrentUser,
    db: Session = Depends(get_db),
):
    eid = _parse_uuid(event_id, name="event_id")
    return _portal.send_reminders(db, actor_id=actor, event_id=eid)


@router.post("/reports")
def create_report(
    payload: ReportIn,
    actor: CurrentUser,
    db: Session = Depends(get_db),
):
    return _portal.submit_report(db, payload)


@router.get("/reports/me")
def my_reports(actor: CurrentUser, db: Session = Depends(get_db)):
    return {"reports": _portal.reports_for_user(db, actor)}


@router.get("/dashboard/supervisor")
def supervisor_dashboard(
    actor: CurrentUser,
    db: Session = Depends(get_db),
    event_id: str | None = Query(default=None),
):
    eid = _parse_uuid(event_id, name="event_id") if event_id else None
    return _portal.supervisor_dashboard(db, actor, event_id=eid)


@router.get("/dashboard/admin")
def admin_dashboard(
    actor: CurrentUser,
    db: Session = Depends(get_db),
    event_id: str | None = Query(default=None),
):
    eid = _parse_uuid(event_id, name="event_id") if event_id else None
    return _portal.admin_dashboard(db, actor, event_id=eid)


@router.get("/admin/users")
def admin_list_users(actor: CurrentUser, db: Session = Depends(get_db)):
    return {"users": _portal.admin_list_users(db, actor)}


@router.post("/admin/users")
def admin_create_user(
    payload: AdminUserCreateIn,
    actor: CurrentUser,
    db: Session = Depends(get_db),
):
    return _portal.admin_create_user(db, actor, payload)


@router.put("/admin/users/{user_id}")
def admin_update_user(
    user_id: str,
    payload: AdminUserUpdateIn,
    actor: CurrentUser,
    db: Session = Depends(get_db),
):
    uid = _parse_uuid(user_id, name="user_id")
    return _portal.admin_update_user(db, actor, uid, payload)


@router.get("/users/me")
def get_my_profile(actor: CurrentUser, db: Session = Depends(get_db)):
    return _portal.get_profile(db, actor)


@router.put("/users/me")
def update_my_profile(
    payload: ProfileUpdateIn,
    actor: CurrentUser,
    db: Session = Depends(get_db),
):
    return _portal.update_profile(db, actor, payload)


@router.get("/notifications/me")
def my_notifications(actor: CurrentUser, db: Session = Depends(get_db)):
    return {"notifications": _portal.notifications_for_user(db, actor)}
