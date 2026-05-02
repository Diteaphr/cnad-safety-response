"""HTTP layer for SPA — delegates to PortalService (business) + repositories (data)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.portal import CreateEventIn, EventActionIn, LoginIn, RegisterIn, ReportIn
from app.services.portal_service import PortalService

router = APIRouter(prefix="/api", tags=["portal"])

_portal = PortalService()


def _parse_uuid(s: str, *, name: str) -> uuid.UUID:
    try:
        return uuid.UUID(s.strip())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid {name}") from e


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


@router.get("/bootstrap")
def bootstrap(
    user_id: str = Query(..., description="Current user UUID"),
    db: Session = Depends(get_db),
):
    uid = _parse_uuid(user_id, name="user_id")
    return _portal.bootstrap(db, uid)


@router.post("/events")
def create_event(
    payload: CreateEventIn,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id")
    actor = _parse_uuid(x_user_id, name="X-User-Id")
    return _portal.create_event(db, actor_id=actor, payload=payload)


@router.post("/events/{event_id}/activate")
def activate_event(
    event_id: str,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    body: EventActionIn | None = None,
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id")
    actor = _parse_uuid(x_user_id, name="X-User-Id")
    eid = _parse_uuid(event_id, name="event_id")
    return _portal.activate_event(db, actor_id=actor, event_id=eid)


@router.post("/events/{event_id}/close")
def close_event(
    event_id: str,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id")
    actor = _parse_uuid(x_user_id, name="X-User-Id")
    eid = _parse_uuid(event_id, name="event_id")
    return _portal.close_event(db, actor_id=actor, event_id=eid)


@router.post("/reports")
def create_report(payload: ReportIn, db: Session = Depends(get_db)):
    return _portal.submit_report(db, payload)


@router.get("/reports/me/{user_id}")
def my_reports(user_id: str, db: Session = Depends(get_db)):
    uid = _parse_uuid(user_id, name="user_id")
    return {"reports": _portal.reports_for_user(db, uid)}


@router.get("/dashboard/supervisor/{user_id}")
def supervisor_dashboard(user_id: str, db: Session = Depends(get_db)):
    uid = _parse_uuid(user_id, name="user_id")
    return _portal.supervisor_dashboard(db, uid)


@router.get("/dashboard/admin")
def admin_dashboard(
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    uid = _parse_uuid(user_id, name="user_id")
    return _portal.admin_dashboard(db, uid)
