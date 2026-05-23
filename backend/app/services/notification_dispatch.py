"""
Notification fan-out logic — shared across three callers:

  1. portal_service.activate_event (via BackgroundTask in dev, Pub/Sub in prod)
  2. portal_service.send_reminders (supervisor manual trigger)
  3. scheduler_service (automated 15-min reminder scan)
  4. api/routes/internal.py (Pub/Sub push endpoint in prod)

── Activation dispatch ──────────────────────────────────────────────────────

Production (USE_GCP=true + PUBSUB_NOTIFICATION_TOPIC set):
  dispatch_activation_notifications()
    └── _pubsub_fan_out(): publish one Pub/Sub message per employee.
        Each message → Cloud Run instance → dispatch_single_user_notification()
        Cloud Run auto-scales horizontally; no single-instance connection limit.
        30k users → ~30k messages → multiple instances in parallel.

Dev / fallback (USE_GCP=false):
  dispatch_activation_notifications()
    └── _batch_fcm_dispatch(): send_fcm_batch() + ThreadPoolExecutor (local).

── Reminder dispatch ────────────────────────────────────────────────────────
  Sequential deliver_with_fallback (reminder audience is small).
"""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.safety_response import SafetyResponse
from app.models.user import User
from app.repositories.event_repository import EventRepository
from app.repositories.safety_response_repository import SafetyResponseRepository
from app.repositories.user_repository import UserRepository
from app.services.integrations.mock_notification_channels import (
    send_fcm_batch,
    send_fcm_mock,
    send_twilio_sms_mock,
)
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

_notif_svc = NotificationService()
_event_repo = EventRepository()
_user_repo = UserRepository()
_response_repo = SafetyResponseRepository()


def _is_employee(user: User) -> bool:
    return any(ur.role.role_name == "employee" for ur in user.user_roles)


def _employees_targeted_by_event(db: Session, event_id: uuid.UUID) -> list[User]:
    """Return employees in scope for this event.

    Company-wide (no target_departments): all employees.
    Targeted (target_departments set): only employees whose primary
    department is in the expanded target set stored at event creation.
    """
    event = _event_repo.get_by_id(db, event_id)
    if event is None:
        return []
    if not event.target_departments:
        return [u for u in _user_repo.list_all(db) if _is_employee(u)]
    target_dept_ids = [d.department_id for d in event.target_departments]
    return [u for u in _user_repo.list_by_department_ids(db, target_dept_ids) if _is_employee(u)]


# ── Public entry points ───────────────────────────────────────────────────────

def dispatch_activation_notifications(db: Session, event_id: uuid.UUID) -> int:
    """Fan-out activation notifications to all target employees.

    Routes to Pub/Sub per-user fan-out (prod) or direct batch FCM (dev).
    Returns count of employees targeted.
    """
    event = _event_repo.get_by_id(db, event_id)
    if event is None:
        logger.warning("dispatch_activation_notifications: event %s not found", event_id)
        return 0

    employees = _employees_targeted_by_event(db, event_id)
    if not employees:
        logger.info("dispatch_activation_notifications: event %s — no target employees", event_id)
        return 0

    if settings.use_gcp and settings.pubsub_notification_topic:
        return _pubsub_fan_out(employees, event)
    return _batch_fcm_dispatch(db, employees, event)


def dispatch_single_user_notification(
    db: Session,
    *,
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    token: str,
    phone: Optional[str],
    title: str,
    body: str,
) -> None:
    """Send FCM (+ SMS fallback) to a single user.

    Called by the internal Pub/Sub push endpoint for each user_fcm message.
    deliver_with_fallback handles idempotency: if already sent, no-op.
    """
    _notif_svc.deliver_with_fallback(
        db,
        event_id=event_id,
        user_id=user_id,
        primary_channel="fcm_activation",
        primary_send_fn=lambda: send_fcm_mock(
            device_token=token,
            title=title,
            body=body,
            data={"event_id": str(event_id)},
        ),
        fallback_channel="sms_activation" if phone else None,
        fallback_send_fn=(
            lambda: send_twilio_sms_mock(
                to_e164=phone,
                body=f"【安全確認】{body}",
            )
        ) if phone else None,
    )


# ── Private helpers ───────────────────────────────────────────────────────────

def _pubsub_fan_out(employees: list[User], event) -> int:
    """Publish one Pub/Sub message per employee (production path).

    Each message is consumed by a separate Cloud Run invocation so the
    workload is distributed across auto-scaled instances — no single-instance
    connection pool limit applies.
    """
    from app.services.integrations.pubsub_placeholder import publish_user_notifications_batch

    messages = [
        {
            "kind": "user_fcm",
            "event_id": str(event.event_id),
            "user_id": str(user.user_id),
            "token": user.fcm_token or str(user.user_id),
            "phone": user.phone,
            "title": "緊急安全確認",
            "body": f"請立即回報您的安全狀態：{event.title}",
        }
        for user in employees
    ]
    count = publish_user_notifications_batch(messages)
    logger.info(
        "dispatch_activation_notifications: event %s → published %d user_fcm messages (Pub/Sub fan-out)",
        event.event_id,
        count,
    )
    return count


def _batch_fcm_dispatch(db: Session, employees: list[User], event) -> int:
    """Direct parallel batch FCM dispatch (dev / fallback path).

    Phase 1: send_fcm_batch() — parallel I/O, no DB session.
    Phase 2: persist results + SMS fallback — sequential DB writes.
    """
    fcm_payloads = [
        {
            "token": user.fcm_token or str(user.user_id),
            "title": "緊急安全確認",
            "body": f"請立即回報您的安全狀態：{event.title}",
            "data": {"event_id": str(event.event_id)},
        }
        for user in employees
    ]
    fcm_results: list[bool] = send_fcm_batch(fcm_payloads)

    for user, fcm_ok in zip(employees, fcm_results):
        _notif_svc.deliver_with_idempotency(
            db,
            event_id=event.event_id,
            user_id=user.user_id,
            channel="fcm_activation",
            send_fn=lambda ok=fcm_ok: ok,
        )
        if not fcm_ok and user.phone:
            _notif_svc.deliver_with_idempotency(
                db,
                event_id=event.event_id,
                user_id=user.user_id,
                channel="sms_activation",
                send_fn=lambda u=user: send_twilio_sms_mock(
                    to_e164=u.phone,
                    body=f"【安全確認】請立即回報您的安全狀態：{event.title}",
                ),
            )

    logger.info(
        "dispatch_activation_notifications: event %s → %d employees notified (batch FCM)",
        event.event_id,
        len(employees),
    )
    return len(employees)


def _find_supervisor(db: Session, employee: User) -> Optional[User]:
    """Return the manager of the employee's primary department, or None."""
    from sqlalchemy import select

    from app.models.department import Department
    from app.models.user_department import UserDepartment

    ud = db.execute(
        select(UserDepartment).where(
            UserDepartment.user_id == employee.user_id,
            UserDepartment.is_primary == True,  # noqa: E712
        )
    ).scalar_one_or_none()
    if ud is None:
        return None

    dept = db.get(Department, ud.department_id)
    if dept is None or dept.manager_id is None:
        return None

    return db.get(User, dept.manager_id)


def dispatch_supervisor_alert(
    db: Session,
    *,
    event_id: uuid.UUID,
    employee_user_id: uuid.UUID,
) -> None:
    """Send FCM alert to the supervisor of an employee who reported need_help.

    Looks up the employee's primary department manager and delivers via
    deliver_with_fallback (idempotent: supervisor gets at most one alert per event).
    """
    event = _event_repo.get_by_id(db, event_id)
    if event is None:
        logger.warning("dispatch_supervisor_alert: event %s not found", event_id)
        return

    employee = db.get(User, employee_user_id)
    if employee is None:
        logger.warning("dispatch_supervisor_alert: employee %s not found", employee_user_id)
        return

    supervisor = _find_supervisor(db, employee)
    if supervisor is None:
        logger.info(
            "dispatch_supervisor_alert: no supervisor for employee %s, skipping",
            employee_user_id,
        )
        return

    token = supervisor.fcm_token or str(supervisor.user_id)
    _notif_svc.deliver_with_fallback(
        db,
        event_id=event_id,
        user_id=supervisor.user_id,
        primary_channel="fcm_supervisor_alert",
        primary_send_fn=lambda: send_fcm_mock(
            device_token=token,
            title="需要協助通知",
            body=f"{employee.name} 在事件「{event.title}」中回報需要協助",
            data={"event_id": str(event_id), "employee_id": str(employee_user_id)},
        ),
        fallback_channel="sms_supervisor_alert" if supervisor.phone else None,
        fallback_send_fn=(
            lambda: send_twilio_sms_mock(
                to_e164=supervisor.phone,
                body=f"【需要協助】{employee.name} 在「{event.title}」中回報需要協助，請立即跟進。",
            )
        ) if supervisor.phone else None,
    )
    logger.info(
        "dispatch_supervisor_alert: event=%s employee=%s supervisor=%s",
        event_id, employee_user_id, supervisor.user_id,
    )


def dispatch_reminders(
    db: Session,
    event_id: uuid.UUID,
    employees: list[User],
) -> dict[str, int]:
    """Send FCM reminders (+ SMS fallback) to employees who have not yet reported safe.

    employees: the candidate set — caller decides scope (team or company-wide).
    Employees who have already reported "safe" are skipped.

    Returns {"sent": N, "already_safe": N, "total": N}.
    """
    event = _event_repo.get_by_id(db, event_id)
    if event is None:
        logger.warning("dispatch_reminders: event %s not found", event_id)
        return {"sent": 0, "already_safe": 0, "total": 0}

    reports = _response_repo.list_for_event(db, event_id)
    latest_by_user: dict[uuid.UUID, SafetyResponse] = {}
    for r in reports:
        prev = latest_by_user.get(r.user_id)
        if prev is None or r.responded_at > prev.responded_at:
            latest_by_user[r.user_id] = r

    sent = already_safe = 0
    for user in employees:
        lr = latest_by_user.get(user.user_id)
        if lr is not None and lr.status == "safe":
            already_safe += 1
            continue
        _notif_svc.deliver_with_fallback(
            db,
            event_id=event_id,
            user_id=user.user_id,
            primary_channel="fcm_reminder",
            primary_send_fn=lambda u=user: send_fcm_mock(
                device_token=u.fcm_token or str(u.user_id),
                title="安全確認提醒",
                body=f"請盡快回報您的安全狀態：{event.title}",
                data={"event_id": str(event_id)},
            ),
            fallback_channel="sms_reminder" if user.phone else None,
            fallback_send_fn=(
                lambda u=user: send_twilio_sms_mock(
                    to_e164=u.phone,
                    body=f"【安全確認提醒】{event.title} 請回報您的安全狀態。",
                )
            ) if user.phone else None,
        )
        sent += 1

    return {"sent": sent, "already_safe": already_safe, "total": len(employees)}
