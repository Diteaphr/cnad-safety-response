"""
Portal API — business logic for frontend SPA (three-layer: called only from API routes).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.jwt import create_access_token
from app.core.passwords import hash_password, verify_password
from app.models.event import Event
from app.models.notification import Notification
from app.models.role import Role
from app.models.safety_response import SafetyResponse
from app.models.user import User
from app.models.user_role import UserRole
from app.repositories.department_repository import DepartmentRepository
from app.repositories.event_repository import EventRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.safety_response_repository import SafetyResponseRepository
from app.repositories.user_repository import UserRepository
from app.schemas.portal import CreateEventIn, LoginIn, ProfileUpdateIn, RegisterIn, ReportIn
from app.schemas.response import SafetyResponseCreate
from app.services.notification_service import NotificationService
from app.services.safety_response_service import SafetyResponseService


def _parse_iso(dt: str) -> datetime:
    if dt.endswith("Z"):
        dt = dt[:-1] + "+00:00"
    return datetime.fromisoformat(dt)


def _role_names(user: User) -> List[str]:
    return [ur.role.role_name for ur in user.user_roles]  # type: ignore[union-attr]


class PortalService:
    def __init__(self) -> None:
        self._users = UserRepository()
        self._depts = DepartmentRepository()
        self._events = EventRepository()
        self._responses = SafetyResponseRepository()
        self._notifications = NotificationRepository()
        self._response_svc = SafetyResponseService()
        self._notif_svc = NotificationService()

    def _user_out(self, user: User) -> dict[str, Any]:
        roles = _role_names(user)
        rcast: list[Any] = [
            x for x in roles if x in ("employee", "supervisor", "admin")
        ]
        return {
            "id": str(user.user_id),
            "name": user.name,
            "email": user.email,
            "departmentId": str(user.department_id) if user.department_id else "",
            "roles": rcast,
            "pushEnabled": True,
            "managerId": str(user.manager_id) if user.manager_id else None,
        }

    def _dept_out(self, d) -> dict[str, Any]:
        return {
            "id": str(d.department_id),
            "name": d.department_name,
            "parentId": str(d.parent_department_id) if d.parent_department_id else None,
        }

    def _event_out(self, event: Event, name_map: dict[uuid.UUID, str]) -> dict[str, Any]:
        tids = [str(ed.department_id) for ed in event.event_departments]
        first = None
        if event.event_departments:
            first = name_map.get(event.event_departments[0].department_id)
        st = event.start_time or event.created_at
        et = event.event_type
        if et not in ("Earthquake", "Typhoon", "Fire", "Other"):
            et = "Other"
        return {
            "id": str(event.event_id),
            "title": event.title,
            "type": et,
            "description": event.description or "",
            "targetDepartmentIds": tids,
            "status": event.status,
            "startAt": st.replace(tzinfo=timezone.utc).isoformat() if st.tzinfo is None else st.isoformat(),
            "cardDepartment": first,
            "venue": None,
        }

    def _response_out(self, r: SafetyResponse) -> dict[str, Any]:
        st = r.status
        if st not in ("safe", "need_help"):
            st = "safe"
        return {
            "id": str(r.response_id),
            "eventId": str(r.event_id),
            "userId": str(r.user_id),
            "status": st,
            "location": r.location,
            "comment": r.comment,
            "attachmentName": None,
            "attachmentSizeBytes": None,
            "updatedAt": r.responded_at.replace(tzinfo=timezone.utc).isoformat()
            if r.responded_at.tzinfo is None
            else r.responded_at.isoformat(),
        }

    def list_departments(self, db: Session) -> list[dict[str, Any]]:
        return [self._dept_out(d) for d in self._depts.list_all(db)]

    def list_users(self, db: Session) -> list[dict[str, Any]]:
        return [self._user_out(u) for u in self._users.list_all(db)]

    def list_events(self, db: Session) -> list[dict[str, Any]]:
        nm = self._depts.name_map(db)
        return [self._event_out(e, nm) for e in self._events.list_all(db)]

    def list_responses(self, db: Session) -> list[dict[str, Any]]:
        return [self._response_out(r) for r in self._responses.list_all(db)]

    def demo_accounts(self) -> list[dict[str, Any]]:
        from app.seeding import ids

        return [
            {
                "id": "employee",
                "label": "Employee Demo",
                "roles": ["employee"],
                "userId": str(ids.U_01),
            },
            {
                "id": "supervisor",
                "label": "Supervisor Demo",
                "roles": ["supervisor"],
                "userId": str(ids.U_02),
            },
            {
                "id": "admin",
                "label": "Admin Demo",
                "roles": ["admin"],
                "userId": str(ids.U_04),
            },
            {
                "id": "multi",
                "label": "Multi-role Demo",
                "roles": ["employee", "supervisor", "admin"],
                "userId": str(ids.U_02),
            },
        ]

    def bootstrap(self, db: Session, user_id: uuid.UUID) -> dict[str, Any]:
        user = self._users.get_by_id(db, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        nm = self._depts.name_map(db)
        events = [e for e in self._events.list_all(db) if e.status == "active"]
        events.sort(key=lambda e: e.created_at, reverse=True)
        active = events[0] if events else None
        my_report = None
        if active is not None:
            r = self._responses.get_by_event_and_user(db, active.event_id, user_id)
            if r is not None:
                my_report = self._response_out(r)
        roles = _role_names(user)
        return {
            "current_user": self._user_out(user),
            "active_event": self._event_out(active, nm) if active else None,
            "my_active_report": my_report,
            "capabilities": {
                "can_report": "employee" in roles,
                "can_view_team": "supervisor" in roles,
                "can_manage_events": "admin" in roles,
            },
        }

    def create_event(
        self, db: Session, *, actor_id: uuid.UUID, payload: CreateEventIn
    ) -> dict[str, Any]:
        if not self._users.user_has_role(db, actor_id, "admin"):
            raise HTTPException(status_code=403, detail="Admin only")
        try:
            st = _parse_iso(payload.startAt)
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Invalid startAt") from e
        dids: list[uuid.UUID] = []
        for s in payload.targetDepartmentIds:
            try:
                dids.append(uuid.UUID(s))
            except ValueError as e:
                raise HTTPException(
                    status_code=400, detail="Invalid department id"
                ) from e
        ev = self._events.create(
            db,
            title=payload.title,
            event_type=payload.type,
            description=payload.description,
            status="draft",
            created_by=actor_id,
            start_time=st,
        )
        self._events.add_departments(db, ev.event_id, dids)
        db.commit()
        nm = self._depts.name_map(db)
        full = self._events.get_by_id(db, ev.event_id)
        assert full is not None
        return {"message": "Event created", "event": self._event_out(full, nm)}

    def activate_event(self, db: Session, *, actor_id: uuid.UUID, event_id: uuid.UUID):
        if not self._users.user_has_role(db, actor_id, "admin"):
            raise HTTPException(status_code=403, detail="Admin only")
        ev = self._events.get_by_id(db, event_id)
        if ev is None:
            raise HTTPException(status_code=404, detail="Event not found")
        self._events.close_all_active_except(db, event_id)
        self._events.set_status(db, event_id, "active")
        db.commit()
        nm = self._depts.name_map(db)
        full = self._events.get_by_id(db, event_id)
        assert full is not None

        # Notification dispatch is intentionally NOT done here.
        # The route handler (portal.py) triggers it via BackgroundTask (dev) or
        # Pub/Sub publish (prod) after this method returns, keeping the service
        # layer free of transport concerns.
        return {"message": "Event activated", "event": self._event_out(full, nm)}

    def close_event(self, db: Session, *, actor_id: uuid.UUID, event_id: uuid.UUID):
        if not self._users.user_has_role(db, actor_id, "admin"):
            raise HTTPException(status_code=403, detail="Admin only")
        ev = self._events.get_by_id(db, event_id)
        if ev is None:
            raise HTTPException(status_code=404, detail="Event not found")
        self._events.set_status(db, event_id, "closed")
        db.commit()
        nm = self._depts.name_map(db)
        full = self._events.get_by_id(db, event_id)
        assert full is not None
        return {"message": "Event closed", "event": self._event_out(full, nm)}

    def submit_report(self, db: Session, payload: ReportIn) -> dict[str, Any]:
        try:
            eid = uuid.UUID(payload.eventId)
            uid = uuid.UUID(payload.userId)
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Invalid uuid") from e
        user = self._users.get_by_id(db, uid)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        if self._events.get_by_id(db, eid) is None:
            raise HTTPException(status_code=404, detail="Event not found")
        body = SafetyResponseCreate(
            status=payload.status,
            comment=payload.comment,
            location=payload.location,
        )
        row = self._response_svc.submit_response(db, event_id=eid, user_id=uid, payload=body)
        return {
            "status": "success",
            "message": "Report received successfully.",
            "data": self._response_out(row),
        }

    def reports_for_user(self, db: Session, user_id: uuid.UUID) -> list[dict[str, Any]]:
        if self._users.get_by_id(db, user_id) is None:
            raise HTTPException(status_code=404, detail="User not found")
        rows = self._responses.list_for_user(db, user_id)
        return [self._response_out(r) for r in rows]

    def supervisor_dashboard(
        self, db: Session, user_id: uuid.UUID, event_id: uuid.UUID | None = None
    ) -> dict[str, Any]:
        user = self._users.get_by_id(db, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        if "supervisor" not in _role_names(user):
            raise HTTPException(status_code=403, detail="Supervisor only")
        nm = self._depts.name_map(db)
        if event_id is not None:
            active_event = self._events.get_by_id(db, event_id)
            if active_event is None:
                raise HTTPException(status_code=404, detail="Event not found")
        else:
            events = [e for e in self._events.list_all(db) if e.status == "active"]
            events.sort(key=lambda e: e.created_at, reverse=True)
            active_event = events[0] if events else None
        if active_event is None:
            return {
                "event": None,
                "kpis": {"safe": 0, "need_help": 0, "responded": 0, "pending": 0},
                "team": [],
            }
        team_users = [
            u
            for u in self._users.list_subordinates(db, user_id)
            if "employee" in _role_names(u)
        ]
        team_ids = {u.user_id for u in team_users}
        reports = self._responses.list_for_event(db, active_event.event_id)
        latest_by_user: dict[uuid.UUID, SafetyResponse] = {}
        for r in reports:
            if r.user_id not in team_ids:
                continue
            prev = latest_by_user.get(r.user_id)
            if prev is None or r.responded_at > prev.responded_at:
                latest_by_user[r.user_id] = r

        def stats_for_users(ids_set: set[uuid.UUID]) -> dict[str, int]:
            safe_c = need_c = 0
            responded = 0
            for uid in ids_set:
                lr = latest_by_user.get(uid)
                if lr is None:
                    continue
                responded += 1
                if lr.status == "safe":
                    safe_c += 1
                elif lr.status == "need_help":
                    need_c += 1
            return {"safe": safe_c, "need_help": need_c, "responded": responded}

        st = stats_for_users(team_ids)
        team = []
        for u in team_users:
            lr = latest_by_user.get(u.user_id)
            dname = nm.get(u.department_id, "-") if u.department_id else "-"
            team.append(
                {
                    "user_id": str(u.user_id),
                    "name": u.name,
                    "department": dname,
                    "status": lr.status if lr else "pending",
                    "reported_at": lr.responded_at.isoformat() if lr else None,
                    "needs_follow_up": lr is None or lr.status == "need_help",
                }
            )
        pending = len(team_users) - st["responded"]
        return {
            "event": self._event_out(active_event, nm),
            "kpis": {**st, "pending": max(0, pending)},
            "team": sorted(team, key=lambda x: (x["status"] == "safe", x["name"])),
        }

    def admin_dashboard(
        self, db: Session, user_id: uuid.UUID, event_id: uuid.UUID | None = None
    ) -> dict[str, Any]:
        user = self._users.get_by_id(db, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        if "admin" not in _role_names(user):
            raise HTTPException(status_code=403, detail="Admin only")
        nm = self._depts.name_map(db)
        if event_id is not None:
            active_event = self._events.get_by_id(db, event_id)
            if active_event is None:
                raise HTTPException(status_code=404, detail="Event not found")
        else:
            events = [e for e in self._events.list_all(db) if e.status == "active"]
            events.sort(key=lambda e: e.created_at, reverse=True)
            active_event = events[0] if events else None
        if active_event is None:
            return {
                "event": None,
                "kpis": {
                    "safe": 0,
                    "need_help": 0,
                    "responded": 0,
                    "pending": 0,
                    "targeted": 0,
                },
                "departments": [],
            }
        targeted = [u for u in self._users.list_all(db) if "employee" in _role_names(u)]
        targeted_count = len(targeted)
        reports = self._responses.list_for_event(db, active_event.event_id)
        latest_by_user: dict[uuid.UUID, SafetyResponse] = {}
        for r in reports:
            prev = latest_by_user.get(r.user_id)
            if prev is None or r.responded_at > prev.responded_at:
                latest_by_user[r.user_id] = r
        responded = len(latest_by_user)
        safe_c = sum(1 for r in latest_by_user.values() if r.status == "safe")
        need_c = sum(1 for r in latest_by_user.values() if r.status == "need_help")
        pending = max(0, targeted_count - responded)
        dept_stats: dict[str, dict[str, Any]] = {}
        for u in targeted:
            if not u.department_id:
                continue
            dname = nm.get(u.department_id, "Unknown")
            bucket = dept_stats.setdefault(
                dname,
                {"department": dname, "safe": 0, "need_help": 0, "pending": 0},
            )
            lr = latest_by_user.get(u.user_id)
            if lr is None:
                bucket["pending"] += 1
            elif lr.status == "safe":
                bucket["safe"] += 1
            else:
                bucket["need_help"] += 1
        return {
            "event": self._event_out(active_event, nm),
            "kpis": {
                "safe": safe_c,
                "need_help": need_c,
                "responded": responded,
                "pending": pending,
                "targeted": targeted_count,
            },
            "departments": sorted(dept_stats.values(), key=lambda x: x["department"]),
        }

    # ------------------------------------------------------------------
    # Profile (self-service)
    # ------------------------------------------------------------------

    def _profile_out(self, user: User) -> dict[str, Any]:
        """Extended user dict that includes phone and employeeNo — for /users/me."""
        roles = _role_names(user)
        rcast: list[Any] = [x for x in roles if x in ("employee", "supervisor", "admin")]
        return {
            "id": str(user.user_id),
            "employeeNo": user.employee_no,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "departmentId": str(user.department_id) if user.department_id else None,
            "managerId": str(user.manager_id) if user.manager_id else None,
            "roles": rcast,
        }

    def get_profile(self, db: Session, user_id: uuid.UUID) -> dict[str, Any]:
        user = self._users.get_by_id(db, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        return self._profile_out(user)

    def update_profile(
        self, db: Session, user_id: uuid.UUID, payload: ProfileUpdateIn
    ) -> dict[str, Any]:
        if self._users.get_by_id(db, user_id) is None:
            raise HTTPException(status_code=404, detail="User not found")
        user = self._users.update_profile(
            db,
            user_id,
            name=payload.name.strip(),
            phone=payload.phone.strip() if payload.phone else None,
        )
        db.commit()
        return self._profile_out(user)

    def register(self, db: Session, payload: RegisterIn) -> dict[str, Any]:
        email = payload.email.strip().lower()
        if self._users.get_by_email(db, email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email is already registered.",
            )
        dept_uuid: uuid.UUID | None = None
        if payload.departmentId:
            try:
                dept_uuid = uuid.UUID(payload.departmentId.strip())
            except ValueError as e:
                raise HTTPException(
                    status_code=400, detail="Invalid department id"
                ) from e
            if self._depts.get_by_id(db, dept_uuid) is None:
                raise HTTPException(status_code=400, detail="Department not found")

        if payload.employeeNo and payload.employeeNo.strip():
            emp_no = payload.employeeNo.strip()
            if self._users.employee_no_exists(db, emp_no):
                raise HTTPException(
                    status_code=409,
                    detail="Employee number already in use.",
                )
        else:
            emp_no = f"REG-{uuid.uuid4().hex[:12].upper()}"
            while self._users.employee_no_exists(db, emp_no):
                emp_no = f"REG-{uuid.uuid4().hex[:12].upper()}"

        rid = db.execute(
            select(Role.role_id).where(Role.role_name == "employee")
        ).scalar_one_or_none()
        if rid is None:
            raise HTTPException(
                status_code=500, detail="Database missing employee role."
            )

        user = User(
            employee_no=emp_no,
            name=payload.name.strip(),
            email=email,
            phone=payload.phone.strip() if payload.phone else None,
            department_id=dept_uuid,
            manager_id=None,
            status="active",
            password_hash=hash_password(payload.password),
        )
        db.add(user)
        db.flush()
        db.add(UserRole(user_id=user.user_id, role_id=rid))
        db.commit()
        full = self._users.get_by_id(db, user.user_id)
        assert full is not None
        return {"message": "Registration successful.", "user": self._user_out(full)}

    def login(self, db: Session, payload: LoginIn) -> dict[str, Any]:
        user = self._users.get_by_email(db, payload.email.strip().lower())
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        roles = _role_names(user)
        token = create_access_token(user.user_id, roles)
        return {
            "user": self._user_out(user),
            "access_token": token,
            "token_type": "bearer",
        }

    def issue_demo_login_token(self, db: Session, *, user_id_str: str) -> dict[str, Any]:
        """僅發給種子資料的 Demo 使用者，供 SPA 下拉登入不需密碼。生產 env 請關閉。"""
        if settings.env.lower() in ("production", "prod"):
            raise HTTPException(
                status_code=403,
                detail="Demo authentication is disabled in production.",
            )
        try:
            uid = uuid.UUID(user_id_str.strip())
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Invalid user id.") from e
        allowed_ids = {acc["userId"] for acc in self.demo_accounts()}
        if str(uid) not in allowed_ids:
            raise HTTPException(
                status_code=403,
                detail="Demo login is restricted to seeded demo accounts.",
            )
        user = self._users.get_by_id(db, uid)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        roles = _role_names(user)
        token = create_access_token(user.user_id, roles)
        return {
            "user": self._user_out(user),
            "access_token": token,
            "token_type": "bearer",
        }

    # ------------------------------------------------------------------
    # Notifications
    # ------------------------------------------------------------------

    def _notif_out(self, n: Notification) -> dict[str, Any]:
        return {
            "id": str(n.notification_id),
            "eventId": str(n.event_id),
            "channel": n.channel,
            "status": n.status,
            "sentAt": n.sent_at.isoformat() if n.sent_at else None,
        }

    def notifications_for_user(
        self, db: Session, user_id: uuid.UUID
    ) -> list[dict[str, Any]]:
        if self._users.get_by_id(db, user_id) is None:
            raise HTTPException(status_code=404, detail="User not found")
        rows = self._notifications.list_for_user(db, user_id)
        return [self._notif_out(r) for r in rows]

    # ------------------------------------------------------------------
    # Supervisor: send reminders
    # ------------------------------------------------------------------

    def send_reminders(
        self, db: Session, *, actor_id: uuid.UUID, event_id: uuid.UUID
    ) -> dict[str, Any]:
        actor = self._users.get_by_id(db, actor_id)
        if actor is None:
            raise HTTPException(status_code=404, detail="User not found")
        if "supervisor" not in _role_names(actor):
            raise HTTPException(status_code=403, detail="Supervisor only")

        ev = self._events.get_by_id(db, event_id)
        if ev is None:
            raise HTTPException(status_code=404, detail="Event not found")
        if ev.status != "active":
            raise HTTPException(status_code=400, detail="Event is not active")

        team_users = [
            u
            for u in self._users.list_subordinates(db, actor_id)
            if "employee" in _role_names(u)
        ]

        from app.services.notification_dispatch import dispatch_reminders
        stats = dispatch_reminders(db, event_id, team_users)

        return {
            "message": "Reminders sent",
            "sent": stats["sent"],
            "already_safe": stats["already_safe"],
            "total_team": stats["total"],
        }
