from datetime import datetime, timedelta, timezone
from typing import Dict, List, Literal, Optional

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

from app.core.config import settings
from app.core.database import get_db

app = FastAPI(title="Employee Safety & Response System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

redis_client = redis.from_url(settings.redis_url)


@app.on_event("shutdown")
async def shutdown_event():
    await redis_client.close()


@app.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    health_status = {"status": "ok", "db": "unknown", "redis": "unknown", "pubsub": "unknown"}

    try:
        await db.execute(text("SELECT 1"))
        health_status["db"] = "ok"
    except Exception as exc:
        health_status["db"] = f"error: {str(exc)}"
        health_status["status"] = "error"

    try:
        await redis_client.ping()
        health_status["redis"] = "ok"
    except Exception as exc:
        health_status["redis"] = f"error: {str(exc)}"
        health_status["status"] = "error"

    try:
        from app.core.pubsub import publisher

        project_path = f"projects/{settings.project_id}"
        list(publisher.list_topics(request={"project": project_path}))
        health_status["pubsub"] = "ok"
    except Exception as exc:
        health_status["pubsub"] = f"error: {str(exc)}"
        health_status["status"] = "error"

    return health_status


@app.get("/")
async def root():
    return {"message": "Welcome to the Employee Safety & Response System API - API is healthy"}


class ReportPayload(BaseModel):
    event_id: int
    user_id: int
    status: Literal["safe", "need_help"]
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    comment: Optional[str] = None


class EventCreatePayload(BaseModel):
    actor_user_id: int
    title: str = Field(min_length=2, max_length=120)
    event_type: Literal["earthquake", "fire", "flood", "other"] = "earthquake"
    description: Optional[str] = Field(default=None, max_length=300)
    target_departments: List[str] = Field(default_factory=list)


class EventActionPayload(BaseModel):
    actor_user_id: int


USERS: Dict[int, dict] = {
    101: {"id": 101, "name": "Maggie Chen", "roles": ["employee"], "department": "R&D", "manager_id": 201},
    102: {"id": 102, "name": "David Wang", "roles": ["employee"], "department": "R&D", "manager_id": 201},
    103: {"id": 103, "name": "Annie Liu", "roles": ["employee"], "department": "HR", "manager_id": 202},
    201: {"id": 201, "name": "Jeffery Liao", "roles": ["employee", "supervisor"], "department": "R&D", "manager_id": 301},
    202: {"id": 202, "name": "Kelly Lin", "roles": ["supervisor"], "department": "HR", "manager_id": 301},
    301: {"id": 301, "name": "System Admin", "roles": ["admin"], "department": "Operations", "manager_id": None},
}

EVENTS: List[dict] = [
    {
        "id": 1,
        "title": "Earthquake Safety Check",
        "event_type": "earthquake",
        "description": "M5+ earthquake reported. Please confirm your status now.",
        "status": "active",
        "target_departments": ["R&D", "HR", "Operations"],
        "created_at": datetime.now(timezone.utc) - timedelta(minutes=5),
        "activated_at": datetime.now(timezone.utc) - timedelta(minutes=4),
        "closed_at": None,
    }
]

REPORTS: List[dict] = []


def _require_user(user_id: int) -> dict:
    user = USERS.get(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _require_role(user_id: int, role: str) -> dict:
    user = _require_user(user_id)
    if role not in user["roles"]:
        raise HTTPException(status_code=403, detail=f"User lacks required role: {role}")
    return user


def _get_active_event() -> Optional[dict]:
    active = [event for event in EVENTS if event["status"] == "active"]
    if not active:
        return None
    return sorted(active, key=lambda item: item["id"], reverse=True)[0]


def _event_by_id(event_id: int) -> dict:
    event = next((item for item in EVENTS if item["id"] == event_id), None)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def _serialize_event(event: dict) -> dict:
    return {
        **event,
        "created_at": event["created_at"].isoformat(),
        "activated_at": event["activated_at"].isoformat() if event["activated_at"] else None,
        "closed_at": event["closed_at"].isoformat() if event["closed_at"] else None,
    }


def _serialize_report(report: dict) -> dict:
    return {**report, "reported_at": report["reported_at"].isoformat()}


def _event_stats(event_id: int, scoped_user_ids: Optional[set[int]] = None) -> dict:
    filtered = [
        report
        for report in REPORTS
        if report["event_id"] == event_id and (scoped_user_ids is None or report["user_id"] in scoped_user_ids)
    ]
    safe_count = sum(1 for report in filtered if report["status"] == "safe")
    need_help_count = sum(1 for report in filtered if report["status"] == "need_help")
    responded_ids = {report["user_id"] for report in filtered}
    return {"safe": safe_count, "need_help": need_help_count, "responded": len(responded_ids)}


@app.get("/api/users")
async def get_users():
    return {"users": list(USERS.values())}


@app.get("/api/events")
async def get_events():
    return {"events": [_serialize_event(item) for item in sorted(EVENTS, key=lambda x: x["id"], reverse=True)]}


@app.post("/api/events")
async def create_event(payload: EventCreatePayload):
    _require_role(payload.actor_user_id, "admin")
    new_id = max(item["id"] for item in EVENTS) + 1 if EVENTS else 1
    event = {
        "id": new_id,
        "title": payload.title,
        "event_type": payload.event_type,
        "description": payload.description,
        "status": "draft",
        "target_departments": payload.target_departments,
        "created_at": datetime.now(timezone.utc),
        "activated_at": None,
        "closed_at": None,
    }
    EVENTS.append(event)
    return {"message": "Event created", "event": _serialize_event(event)}


@app.post("/api/events/{event_id}/activate")
async def activate_event(event_id: int, payload: EventActionPayload):
    _require_role(payload.actor_user_id, "admin")
    event = _event_by_id(event_id)
    for item in EVENTS:
        if item["status"] == "active":
            item["status"] = "closed"
            item["closed_at"] = datetime.now(timezone.utc)
    event["status"] = "active"
    event["activated_at"] = datetime.now(timezone.utc)
    event["closed_at"] = None
    return {"message": "Event activated", "event": _serialize_event(event)}


@app.post("/api/events/{event_id}/close")
async def close_event(event_id: int, payload: EventActionPayload):
    _require_role(payload.actor_user_id, "admin")
    event = _event_by_id(event_id)
    event["status"] = "closed"
    event["closed_at"] = datetime.now(timezone.utc)
    return {"message": "Event closed", "event": _serialize_event(event)}


@app.get("/api/reports/me/{user_id}")
async def my_reports(user_id: int):
    _require_user(user_id)
    mine = [_serialize_report(item) for item in REPORTS if item["user_id"] == user_id]
    return {"reports": sorted(mine, key=lambda x: x["reported_at"], reverse=True)}


@app.post("/api/reports")
async def create_report(payload: ReportPayload):
    _require_user(payload.user_id)
    _event_by_id(payload.event_id)
    REPORTS[:] = [
        item for item in REPORTS if not (item["event_id"] == payload.event_id and item["user_id"] == payload.user_id)
    ]
    report = {
        "id": len(REPORTS) + 1,
        "event_id": payload.event_id,
        "user_id": payload.user_id,
        "status": payload.status,
        "location_lat": payload.location_lat,
        "location_lng": payload.location_lng,
        "comment": payload.comment,
        "reported_at": datetime.now(timezone.utc),
    }
    REPORTS.append(report)
    return {"status": "success", "message": "Report received successfully.", "data": _serialize_report(report)}


@app.get("/api/dashboard/supervisor/{user_id}")
async def supervisor_dashboard(user_id: int):
    supervisor = _require_role(user_id, "supervisor")
    active_event = _get_active_event()
    if active_event is None:
        return {"event": None, "kpis": {"safe": 0, "need_help": 0, "responded": 0, "pending": 0}, "team": []}

    team_users = [
        user for user in USERS.values() if user.get("manager_id") == supervisor["id"] and "employee" in user["roles"]
    ]
    team_ids = {user["id"] for user in team_users}
    stats = _event_stats(active_event["id"], team_ids)
    latest_by_user: Dict[int, dict] = {}
    for report in REPORTS:
        if report["event_id"] == active_event["id"] and report["user_id"] in team_ids:
            prev = latest_by_user.get(report["user_id"])
            if prev is None or report["reported_at"] > prev["reported_at"]:
                latest_by_user[report["user_id"]] = report

    team = []
    for user in team_users:
        report = latest_by_user.get(user["id"])
        team.append(
            {
                "user_id": user["id"],
                "name": user["name"],
                "department": user["department"],
                "status": report["status"] if report else "pending",
                "reported_at": report["reported_at"].isoformat() if report else None,
                "needs_follow_up": report is None or report["status"] == "need_help",
            }
        )
    pending = len(team_users) - stats["responded"]
    return {
        "event": _serialize_event(active_event),
        "kpis": {**stats, "pending": max(0, pending)},
        "team": sorted(team, key=lambda x: (x["status"] == "safe", x["name"])),
    }


@app.get("/api/dashboard/admin")
async def admin_dashboard(user_id: int = Query(...)):
    _require_role(user_id, "admin")
    active_event = _get_active_event()
    if active_event is None:
        return {
            "event": None,
            "kpis": {"safe": 0, "need_help": 0, "responded": 0, "pending": 0, "targeted": 0},
            "departments": [],
        }

    targeted_employees = [user for user in USERS.values() if "employee" in user["roles"]]
    targeted_count = len(targeted_employees)
    stats = _event_stats(active_event["id"])
    pending = targeted_count - stats["responded"]
    dept_stats: Dict[str, dict] = {}
    latest_report_by_user: Dict[int, dict] = {}
    for report in REPORTS:
        if report["event_id"] == active_event["id"]:
            prev = latest_report_by_user.get(report["user_id"])
            if prev is None or report["reported_at"] > prev["reported_at"]:
                latest_report_by_user[report["user_id"]] = report

    for user in targeted_employees:
        dept_name = user["department"]
        bucket = dept_stats.setdefault(dept_name, {"department": dept_name, "safe": 0, "need_help": 0, "pending": 0})
        report = latest_report_by_user.get(user["id"])
        if report is None:
            bucket["pending"] += 1
        elif report["status"] == "safe":
            bucket["safe"] += 1
        else:
            bucket["need_help"] += 1

    return {
        "event": _serialize_event(active_event),
        "kpis": {**stats, "pending": max(0, pending), "targeted": targeted_count},
        "departments": sorted(dept_stats.values(), key=lambda x: x["department"]),
    }


@app.get("/api/bootstrap")
async def bootstrap(user_id: int = Query(...)):
    user = _require_user(user_id)
    active_event = _get_active_event()
    report_for_active = None
    if active_event is not None:
        report_for_active = next(
            (
                _serialize_report(item)
                for item in sorted(REPORTS, key=lambda x: x["reported_at"], reverse=True)
                if item["event_id"] == active_event["id"] and item["user_id"] == user_id
            ),
            None,
        )
    return {
        "current_user": user,
        "active_event": _serialize_event(active_event) if active_event else None,
        "my_active_report": report_for_active,
        "capabilities": {
            "can_report": "employee" in user["roles"],
            "can_view_team": "supervisor" in user["roles"],
            "can_manage_events": "admin" in user["roles"],
        },
    }

