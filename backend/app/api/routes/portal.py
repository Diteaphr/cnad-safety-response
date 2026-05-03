"""HTTP layer for SPA — delegates to PortalService (business) + repositories (data)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.schemas.portal import CreateEventIn, DemoLoginIn, EventActionIn, LoginIn, RegisterIn, ReportIn
from app.services.portal_service import PortalService

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


@router.post("/events/{event_id}/activate")
def activate_event(
    event_id: str,
    actor: CurrentUser,
    db: Session = Depends(get_db),
    body: EventActionIn | None = None,
):
    eid = _parse_uuid(event_id, name="event_id")
    return _portal.activate_event(db, actor_id=actor, event_id=eid)


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


@router.get("/notifications/me")
def my_notifications(actor: CurrentUser, db: Session = Depends(get_db)):
    return {"notifications": _portal.notifications_for_user(db, actor)}
