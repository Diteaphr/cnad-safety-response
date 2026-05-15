"""
Portal API — business logic for frontend SPA (three-layer: called only from API routes).
"""

from __future__ import annotations

import secrets
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
from app.repositories.event_type_repository import EventTypeRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.safety_response_repository import SafetyResponseRepository
from app.repositories.user_notification_preference_repository import (
    UserNotificationPreferenceRepository,
)
from app.repositories.user_repository import UserRepository
from app.schemas.portal import AdminUserCreateIn, AdminUserUpdateIn, ChangePasswordIn, CreateEventIn, DepartmentCreateIn, DepartmentUpdateIn, EventTypeCreateIn, LoginIn, ProfileUpdateIn, RegisterIn, ReportIn
from app.schemas.response import SafetyResponseCreate
from app.services.notification_service import NotificationService
from app.services.safety_response_service import SafetyResponseService


def _needs_profile_completion(user: User) -> bool:
    return not (user.phone and str(user.phone).strip())


def _parse_iso(dt: str) -> datetime:
    if dt.endswith("Z"):
        dt = dt[:-1] + "+00:00"
    return datetime.fromisoformat(dt)


def _role_names(user: User) -> List[str]:
    return [ur.role.role_name for ur in user.user_roles]  # type: ignore[union-attr]


class PortalService:
    def __init__(self) -> None:
        self._users = UserRepository()
        self._notif_prefs = UserNotificationPreferenceRepository()
        self._depts = DepartmentRepository()
        self._events = EventRepository()
        self._event_types = EventTypeRepository()
        self._responses = SafetyResponseRepository()
        self._notifications = NotificationRepository()
        self._response_svc = SafetyResponseService()
        self._notif_svc = NotificationService()

    def _attach_push_prefs(self, db: Session, user: User, out: dict[str, Any]) -> dict[str, Any]:
        pref = user.notification_preference
        if pref is None:
            pref = self._notif_prefs.ensure_for_user(db, user.user_id)
        out.update(self._notif_prefs.row_to_api_dict(pref))
        return out

    def _user_out(self, db: Session, user: User) -> dict[str, Any]:
        roles = _role_names(user)
        rcast: list[Any] = [
            x for x in roles if x in ("employee", "supervisor", "admin")
        ]
        pd = self._users.get_primary_department_id(db, user.user_id)
        dm = self._users.derived_manager_id(db, user.user_id)
        out = {
            "id": str(user.user_id),
            "name": user.name,
            "email": user.email,
            "departmentId": str(pd) if pd else "",
            "roles": rcast,
            "managerId": str(dm) if dm else None,
            "employeeCode": user.employee_no,
            "phone": user.phone or None,
            "needsProfileCompletion": _needs_profile_completion(user),
        }
        return self._attach_push_prefs(db, user, out)

    def _dept_out(self, d) -> dict[str, Any]:
        return {
            "id": str(d.department_id),
            "name": d.department_name,
            "parentId": str(d.parent_department_id) if d.parent_department_id else None,
        }

    def _event_out(self, event: Event, name_map: dict[uuid.UUID, str]) -> dict[str, Any]:
        st = event.start_time or event.created_at
        et = event.event_type
        return {
            "id": str(event.event_id),
            "title": event.title,
            "type": et,
            "description": event.description or "",
            "targetDepartmentIds": [],
            "status": event.status,
            "startAt": st.replace(tzinfo=timezone.utc).isoformat() if st.tzinfo is None else st.isoformat(),
            "cardDepartment": None,
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

    def list_event_types(self, db: Session) -> list[dict[str, Any]]:
        rows = self._event_types.list_all(db)
        return [
            {
                "id": str(r.event_type_id),
                "code": r.code,
                "name": r.name,
            }
            for r in rows
        ]

    def list_departments(self, db: Session) -> list[dict[str, Any]]:
        return [self._dept_out(d) for d in self._depts.list_all(db)]

    def list_users(self, db: Session) -> list[dict[str, Any]]:
        return [self._user_out(db, u) for u in self._users.list_all(db)]

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
                "label": "Employee — employee_1",
                "roles": ["employee"],
                "userId": str(ids.user_key(2)),
            },
            {
                "id": "supervisor",
                "label": "Supervisor — employee_2",
                "roles": ["supervisor"],
                "userId": str(ids.user_key(3)),
            },
            {
                "id": "admin",
                "label": "Admin — admin@test.com",
                "roles": ["admin"],
                "userId": str(ids.user_key(1)),
            },
            {
                "id": "multi",
                "label": "Multi-role — employee_3",
                "roles": ["employee", "supervisor", "admin"],
                "userId": str(ids.user_key(4)),
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
            "current_user": self._user_out(db, user),
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
        custom = (payload.custom_type_name or "").strip()
        if payload.type.strip().lower() == "other" and custom:
            et = self._event_types.get_or_create_by_display_name(db, custom)
        else:
            et = self._event_types.get_by_label(db, payload.type)
            if et is None:
                raise HTTPException(status_code=400, detail="Unknown event type")
        ev = self._events.create(
            db,
            title=payload.title,
            event_type_id=et.event_type_id,
            description=payload.description,
            status="active",
            created_by=actor_id,
            start_time=st,
        )
        db.commit()
        nm = self._depts.name_map(db)
        full = self._events.get_by_id(db, ev.event_id)
        assert full is not None
        return {"message": "Event created", "event": self._event_out(full, nm)}

    def update_event(
        self, db: Session, *, actor_id: uuid.UUID, event_id: uuid.UUID, payload: CreateEventIn
    ) -> dict[str, Any]:
        if not self._users.user_has_role(db, actor_id, "admin"):
            raise HTTPException(status_code=403, detail="Admin only")
        ev = self._events.get_by_id(db, event_id)
        if ev is None:
            raise HTTPException(status_code=404, detail="Event not found")
        if ev.status != "active":
            raise HTTPException(
                status_code=409, detail="Only active events can be edited"
            )
        try:
            st = _parse_iso(payload.startAt)
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Invalid startAt") from e
        custom = (payload.custom_type_name or "").strip()
        if payload.type.strip().lower() == "other" and custom:
            et = self._event_types.get_or_create_by_display_name(db, custom)
        else:
            et = self._event_types.get_by_label(db, payload.type)
            if et is None:
                raise HTTPException(status_code=400, detail="Unknown event type")
        self._events.update(
            db,
            event_id,
            title=payload.title,
            event_type_id=et.event_type_id,
            description=payload.description,
            start_time=st,
        )
        db.commit()
        db.expire_all()
        nm = self._depts.name_map(db)
        full = self._events.get_by_id(db, event_id)
        assert full is not None
        return {"message": "Event updated", "event": self._event_out(full, nm)}

    def activate_event(self, db: Session, *, actor_id: uuid.UUID, event_id: uuid.UUID):
        if not self._users.user_has_role(db, actor_id, "admin"):
            raise HTTPException(status_code=403, detail="Admin only")
        ev = self._events.get_by_id(db, event_id)
        if ev is None:
            raise HTTPException(status_code=404, detail="Event not found")
        if ev.status == "closed":
            raise HTTPException(status_code=400, detail="Cannot activate a closed event")
        dispatched = False
        if ev.status != "active":
            self._events.set_status(db, event_id, "active")
            dispatched = True
        db.commit()
        nm = self._depts.name_map(db)
        full = self._events.get_by_id(db, event_id)
        assert full is not None

        # Notification dispatch is intentionally NOT done here.
        # The route handler (portal.py) triggers it via BackgroundTask (dev) or
        # Pub/Sub publish (prod) after this method returns, keeping the service
        # layer free of transport concerns.
        return {
            "message": "Event activated" if dispatched else "Already active",
            "event": self._event_out(full, nm),
            "dispatched": dispatched,
        }

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
        self,
        db: Session,
        user_id: uuid.UUID,
        event_id: uuid.UUID | None = None,
        view_as: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        actor = self._users.get_by_id(db, user_id)
        if actor is None:
            raise HTTPException(status_code=404, detail="User not found")
        if "supervisor" not in _role_names(actor):
            raise HTTPException(status_code=403, detail="Supervisor only")

        # view_as: allow drilling into a subordinate manager's team
        if view_as is not None:
            target = self._users.get_by_id(db, view_as)
            if target is None:
                raise HTTPException(status_code=404, detail="Target user not found")
            if not self._users.is_subordinate_of(db, actor_id=user_id, target_id=view_as):
                raise HTTPException(status_code=403, detail="Cannot view this team")
            target_manager_id = view_as
        else:
            target_manager_id = user_id

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
                "kpis": {"safe": 0, "need_help": 0, "responded": 0, "pending": 0, "total": 0},
                "team": [],
                "view_as": str(view_as) if view_as else None,
            }

        # KPI: SQL aggregate over ALL recursive subordinates — no User objects loaded
        kpis = self._responses.kpi_for_manager_subordinates(
            db, event_id=active_event.event_id, manager_id=target_manager_id
        )

        # Team: direct reports only (primary dept's department.manager_id == target manager)
        direct_reports = self._users.list_subordinates(db, target_manager_id)
        employee_ids = [u.user_id for u in direct_reports if "employee" in _role_names(u)]
        latest_responses = self._responses.latest_for_users(
            db, active_event.event_id, employee_ids
        )

        prim = self._users.primary_department_map(db, [u.user_id for u in direct_reports])
        team = []
        for u in direct_reports:
            u_roles = _role_names(u)
            did = prim.get(u.user_id)
            dname = nm.get(did, "-") if did else "-"
            if "supervisor" in u_roles:
                sub_kpis = self._responses.kpi_for_manager_subordinates(
                    db, event_id=active_event.event_id, manager_id=u.user_id
                )
                team.append({
                    "user_id": str(u.user_id),
                    "name": u.name,
                    "department": dname,
                    "is_supervisor": True,
                    "status": None,
                    "reported_at": None,
                    "needs_follow_up": sub_kpis["pending"] > 0 or sub_kpis["need_help"] > 0,
                    "phone": u.phone,
                    "sub_team_summary": sub_kpis,
                })
            else:
                lr = latest_responses.get(u.user_id)
                team.append({
                    "user_id": str(u.user_id),
                    "name": u.name,
                    "department": dname,
                    "is_supervisor": False,
                    "status": lr.status if lr else "pending",
                    "reported_at": lr.responded_at.isoformat() if lr else None,
                    "needs_follow_up": lr is None or lr.status == "need_help",
                    "phone": u.phone,
                    "sub_team_summary": None,
                })

        return {
            "event": self._event_out(active_event, nm),
            "kpis": kpis,
            "team": sorted(team, key=lambda x: (not x["needs_follow_up"], x["name"])),
            "view_as": str(view_as) if view_as else None,
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
            active_event = self._events.latest_active(db)
        if active_event is None:
            return {
                "event": None,
                "kpis": {"safe": 0, "need_help": 0, "responded": 0, "pending": 0, "targeted": 0},
                "departments": [],
            }
        kpis = self._responses.admin_kpi(db, event_id=active_event.event_id)
        departments = self._responses.admin_dept_stats(db, event_id=active_event.event_id)
        return {
            "event": self._event_out(active_event, nm),
            "kpis": kpis,
            "departments": departments,
        }

    # ------------------------------------------------------------------
    # Profile (self-service)
    # ------------------------------------------------------------------

    def _profile_out(self, db: Session, user: User) -> dict[str, Any]:
        """Extended user dict that includes phone and employeeNo — for /users/me."""
        roles = _role_names(user)
        rcast: list[Any] = [x for x in roles if x in ("employee", "supervisor", "admin")]
        pd = self._users.get_primary_department_id(db, user.user_id)
        dm = self._users.derived_manager_id(db, user.user_id)
        out = {
            "id": str(user.user_id),
            "employeeNo": user.employee_no,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "departmentId": str(pd) if pd else None,
            "managerId": str(dm) if dm else None,
            "roles": rcast,
            "needsProfileCompletion": _needs_profile_completion(user),
        }
        return self._attach_push_prefs(db, user, out)

    def get_profile(self, db: Session, user_id: uuid.UUID) -> dict[str, Any]:
        user = self._users.get_by_id(db, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        return self._profile_out(db, user)

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
        if (
            payload.push_enabled is not None
            or payload.push_emergency_enabled is not None
            or payload.push_reminder_enabled is not None
            or payload.push_escalation_enabled is not None
        ):
            self._notif_prefs.apply_partial(
                db,
                user_id,
                push_master_enabled=payload.push_enabled,
                push_emergency_enabled=payload.push_emergency_enabled,
                push_reminder_enabled=payload.push_reminder_enabled,
                push_escalation_enabled=payload.push_escalation_enabled,
            )
        db.commit()
        db.expire_all()
        refreshed = self._users.get_by_id(db, user_id)
        assert refreshed is not None
        return self._profile_out(db, refreshed)

    def change_password(
        self, db: Session, user_id: uuid.UUID, payload: ChangePasswordIn
    ) -> dict[str, Any]:
        user = self._users.get_by_id(db, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        if not user.password_hash or not verify_password(payload.currentPassword, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        self._users.update_password(db, user_id, new_hash=hash_password(payload.newPassword))
        db.commit()
        return {"message": "Password changed successfully."}

    # ------------------------------------------------------------------
    # Admin: user management
    # ------------------------------------------------------------------

    def _parse_optional_uuid(self, value: str | None, *, field: str) -> uuid.UUID | None:
        if not value:
            return None
        try:
            return uuid.UUID(value.strip())
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid {field}") from e

    def admin_deactivate_user(
        self, db: Session, actor_id: uuid.UUID, user_id: uuid.UUID
    ) -> dict[str, Any]:
        if not self._users.user_has_role(db, actor_id, "admin"):
            raise HTTPException(status_code=403, detail="Admin only")
        if actor_id == user_id:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
        user = self._users.get_by_id(db, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        if user.status == "inactive":
            raise HTTPException(status_code=409, detail="Account is already inactive")
        self._users.set_status(db, user_id, status="inactive")
        db.commit()
        return {"message": "Account deactivated."}

    def admin_activate_user(
        self, db: Session, actor_id: uuid.UUID, user_id: uuid.UUID
    ) -> dict[str, Any]:
        if not self._users.user_has_role(db, actor_id, "admin"):
            raise HTTPException(status_code=403, detail="Admin only")
        user = self._users.get_by_id(db, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        if user.status == "active":
            raise HTTPException(status_code=409, detail="Account is already active")
        self._users.set_status(db, user_id, status="active")
        db.commit()
        return {"message": "Account activated."}

    def admin_reset_password(
        self, db: Session, actor_id: uuid.UUID, user_id: uuid.UUID
    ) -> dict[str, Any]:
        if not self._users.user_has_role(db, actor_id, "admin"):
            raise HTTPException(status_code=403, detail="Admin only")
        if self._users.get_by_id(db, user_id) is None:
            raise HTTPException(status_code=404, detail="User not found")
        default_password = "Welcome@1234"
        self._users.update_password(db, user_id, new_hash=hash_password(default_password))
        db.commit()
        return {"message": "Password reset.", "temporaryPassword": default_password}

    # ------------------------------------------------------------------
    # Admin: event type management
    # ------------------------------------------------------------------

    def admin_create_event_type(
        self, db: Session, actor_id: uuid.UUID, payload: EventTypeCreateIn
    ) -> dict[str, Any]:
        if not self._users.user_has_role(db, actor_id, "admin"):
            raise HTTPException(status_code=403, detail="Admin only")
        name = payload.name.strip()
        if self._event_types.get_by_label(db, name) is not None:
            raise HTTPException(status_code=409, detail="Event type already exists")
        row = self._event_types.get_or_create_by_display_name(db, name)
        db.commit()
        return {"id": str(row.event_type_id), "code": row.code, "name": row.name}

    # ------------------------------------------------------------------
    # Admin: department management
    # ------------------------------------------------------------------

    def admin_create_department(
        self, db: Session, actor_id: uuid.UUID, payload: DepartmentCreateIn
    ) -> dict[str, Any]:
        if not self._users.user_has_role(db, actor_id, "admin"):
            raise HTTPException(status_code=403, detail="Admin only")
        parent_id = self._parse_optional_uuid(payload.parentId, field="parentId")
        if parent_id and self._depts.get_by_id(db, parent_id) is None:
            raise HTTPException(status_code=400, detail="Parent department not found")
        dept = self._depts.create(db, name=payload.name.strip(), parent_id=parent_id)
        db.commit()
        return self._dept_out(dept)

    def admin_update_department(
        self, db: Session, actor_id: uuid.UUID, dept_id: uuid.UUID, payload: DepartmentUpdateIn
    ) -> dict[str, Any]:
        if not self._users.user_has_role(db, actor_id, "admin"):
            raise HTTPException(status_code=403, detail="Admin only")
        if self._depts.get_by_id(db, dept_id) is None:
            raise HTTPException(status_code=404, detail="Department not found")
        parent_id = self._parse_optional_uuid(payload.parentId, field="parentId")
        if parent_id:
            if self._depts.get_by_id(db, parent_id) is None:
                raise HTTPException(status_code=400, detail="Parent department not found")
            if parent_id == dept_id:
                raise HTTPException(status_code=400, detail="Department cannot be its own parent")
        dept = self._depts.update(db, dept_id, name=payload.name.strip(), parent_id=parent_id)
        db.commit()
        return self._dept_out(dept)

    def admin_delete_department(
        self, db: Session, actor_id: uuid.UUID, dept_id: uuid.UUID
    ) -> dict[str, Any]:
        if not self._users.user_has_role(db, actor_id, "admin"):
            raise HTTPException(status_code=403, detail="Admin only")
        if self._depts.get_by_id(db, dept_id) is None:
            raise HTTPException(status_code=404, detail="Department not found")
        if self._depts.has_members(db, dept_id):
            raise HTTPException(status_code=409, detail="Department still has members")
        if self._depts.has_sub_departments(db, dept_id):
            raise HTTPException(status_code=409, detail="Department still has sub-departments")
        self._depts.delete(db, dept_id)
        db.commit()
        return {"message": "Department deleted."}

    def admin_list_users(
        self, db: Session, actor_id: uuid.UUID, dept_id: uuid.UUID | None = None
    ) -> list[dict[str, Any]]:
        if not self._users.user_has_role(db, actor_id, "admin"):
            raise HTTPException(status_code=403, detail="Admin only")
        if dept_id is not None:
            if self._depts.get_by_id(db, dept_id) is None:
                raise HTTPException(status_code=404, detail="Department not found")
            users = self._users.list_by_department(db, dept_id)
        else:
            users = self._users.list_all(db)
        return [self._profile_out(db, u) for u in users]

    def admin_create_user(
        self, db: Session, actor_id: uuid.UUID, payload: AdminUserCreateIn
    ) -> dict[str, Any]:
        if not self._users.user_has_role(db, actor_id, "admin"):
            raise HTTPException(status_code=403, detail="Admin only")

        email = payload.email.strip().lower()
        if self._users.get_by_email(db, email):
            raise HTTPException(status_code=409, detail="Email already registered.")

        dept_id = self._parse_optional_uuid(payload.departmentId, field="departmentId")
        if dept_id and self._depts.get_by_id(db, dept_id) is None:
            raise HTTPException(status_code=400, detail="Department not found")

        emp_no = payload.employeeNo.strip()
        if self._users.employee_no_exists(db, emp_no):
            raise HTTPException(status_code=409, detail="Employee number already in use.")

        raw_pw = (payload.password or "").strip()
        temporary_password: str | None = None
        if raw_pw:
            pw_plain = raw_pw
        else:
            temporary_password = secrets.token_urlsafe(16)
            pw_plain = temporary_password

        user = User(
            employee_no=emp_no,
            name=payload.name.strip(),
            email=email,
            phone=payload.phone.strip(),
            status="active",
            password_hash=hash_password(pw_plain),
        )
        db.add(user)
        db.flush()
        self._notif_prefs.ensure_for_user(db, user.user_id)
        self._users.set_primary_department(db, user.user_id, dept_id)
        self._users.set_roles(db, user.user_id, payload.roles)
        db.commit()

        full = self._users.get_by_id(db, user.user_id)
        assert full is not None
        out: dict[str, Any] = {"message": "User created.", "user": self._profile_out(db, full)}
        if temporary_password is not None:
            out["temporaryPassword"] = temporary_password
        return out

    def admin_update_user(
        self, db: Session, actor_id: uuid.UUID, user_id: uuid.UUID, payload: AdminUserUpdateIn
    ) -> dict[str, Any]:
        if not self._users.user_has_role(db, actor_id, "admin"):
            raise HTTPException(status_code=403, detail="Admin only")

        if self._users.get_by_id(db, user_id) is None:
            raise HTTPException(status_code=404, detail="User not found")

        dept_id = self._parse_optional_uuid(payload.departmentId, field="departmentId")
        if dept_id and self._depts.get_by_id(db, dept_id) is None:
            raise HTTPException(status_code=400, detail="Department not found")

        self._users.update_user_admin(
            db,
            user_id,
            name=payload.name.strip(),
            phone=payload.phone.strip() if payload.phone else None,
            department_id=dept_id,
        )
        self._users.set_roles(db, user_id, payload.roles)
        db.commit()
        # expire_all forces SQLAlchemy to re-query from DB rather than serve
        # user_roles from the identity-map cache (needed when expire_on_commit=False)
        db.expire_all()

        full = self._users.get_by_id(db, user_id)
        assert full is not None
        return self._profile_out(db, full)

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
            status="active",
            password_hash=hash_password(payload.password),
        )
        db.add(user)
        db.flush()
        self._users.set_primary_department(db, user.user_id, dept_uuid)
        db.add(UserRole(user_id=user.user_id, role_id=rid))
        self._notif_prefs.ensure_for_user(db, user.user_id)
        db.commit()
        full = self._users.get_by_id(db, user.user_id)
        assert full is not None
        return {"message": "Registration successful.", "user": self._user_out(db, full)}

    def login(self, db: Session, payload: LoginIn) -> dict[str, Any]:
        user = self._users.get_by_email(db, payload.email.strip().lower())
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if user.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive.",
            )
        roles = _role_names(user)
        token = create_access_token(user.user_id, roles)
        return {
            "user": self._user_out(db, user),
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
            "user": self._user_out(db, user),
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
        out: list[dict[str, Any]] = []
        for r in rows:
            d = self._notif_out(r)
            ev = self._events.get_by_id(db, r.event_id)
            d["eventTitle"] = ev.title if ev else ""
            out.append(d)
        return out

    def failed_notifications_for_event(
        self, db: Session, *, actor_id: uuid.UUID, event_id: uuid.UUID
    ) -> list[dict[str, Any]]:
        actor = self._users.get_by_id(db, actor_id)
        if actor is None:
            raise HTTPException(status_code=404, detail="User not found")
        if "admin" not in _role_names(actor):
            raise HTTPException(status_code=403, detail="Admin only")

        ev = self._events.get_by_id(db, event_id)
        if ev is None:
            raise HTTPException(status_code=404, detail="Event not found")

        rows = self._notifications.list_failed_for_event(db, event_id, channel_contains="reminder")
        out: list[dict[str, Any]] = []
        for n in rows:
            u = self._users.get_by_id(db, n.user_id)
            out.append(
                {
                    "id": str(n.notification_id),
                    "eventId": str(n.event_id),
                    "userId": str(n.user_id),
                    "userName": u.name if u else "Unknown",
                    "department": (u.department.name if (u and u.department) else None),
                    "channel": n.channel,
                    "status": n.status,
                    "sentAt": n.sent_at.isoformat() if n.sent_at else None,
                }
            )
        return out

    def retry_failed_notification(
        self, db: Session, *, actor_id: uuid.UUID, notification_id: uuid.UUID
    ) -> dict[str, Any]:
        actor = self._users.get_by_id(db, actor_id)
        if actor is None:
            raise HTTPException(status_code=404, detail="User not found")
        if "admin" not in _role_names(actor):
            raise HTTPException(status_code=403, detail="Admin only")

        row = self._notifications.get_by_id(db, notification_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Notification not found")

        target_user = self._users.get_by_id(db, row.user_id)
        ev = self._events.get_by_id(db, row.event_id)
        if target_user is None or ev is None:
            raise HTTPException(status_code=404, detail="Notification target context not found")

        def _retry_send() -> bool:
            title = "安全確認提醒"
            body = f"請盡快回報您的安全狀態：{ev.title}"
            if "sms" in row.channel.lower():
                title = "簡訊提醒"
                body = f"請回報活動「{ev.title}」的安全狀態"
            return send_fcm_mock(
                device_token=str(target_user.user_id),
                title=title,
                body=body,
                data={"event_id": str(ev.event_id), "retry": "true"},
            )

        updated = self._notif_svc.deliver_with_idempotency(
            db,
            event_id=row.event_id,
            user_id=row.user_id,
            channel=row.channel,
            send_fn=_retry_send,
        )
        return self._notif_out(updated)

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
            for u in self._users.list_all_subordinates(db, actor_id)
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
