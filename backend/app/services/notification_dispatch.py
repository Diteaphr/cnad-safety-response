"""
Notification fan-out logic — shared across three callers:

  1. portal_service.activate_event (via BackgroundTask in dev, Pub/Sub in prod)
  2. portal_service.send_reminders (supervisor manual trigger)
  3. scheduler_service (automated 15-min reminder scan)
  4. api/routes/internal.py (Pub/Sub push endpoint in prod)

Keeping the dispatch logic here avoids duplication and makes it easy to
swap the mock senders for real Firebase Admin SDK / Twilio when going live.
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.orm import Session

from app.models.safety_response import SafetyResponse
from app.models.user import User
from app.repositories.event_repository import EventRepository
from app.repositories.safety_response_repository import SafetyResponseRepository
from app.repositories.user_repository import UserRepository
from app.services.integrations.mock_notification_channels import (
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
    """
    Return employees targeted by the event.
    If the event has target departments, only include employees in those departments.
    If no target departments are set, include all employees (company-wide event).
    """
    event = _event_repo.get_by_id(db, event_id)
    if event is None:
        return []
    target_dept_ids = {ed.department_id for ed in event.event_departments}
    all_users = _user_repo.list_all(db)
    if target_dept_ids:
        return [
            u for u in all_users
            if _is_employee(u) and u.department_id in target_dept_ids
        ]
    return [u for u in all_users if _is_employee(u)]


def dispatch_activation_notifications(db: Session, event_id: uuid.UUID) -> int:
    """
    Send FCM (+ SMS fallback) to all employees targeted by the event.

    Called after event is activated. Returns count of employees notified.

    Production swap: replace send_fcm_mock / send_twilio_sms_mock in
    mock_notification_channels.py with real Firebase Admin SDK / Twilio calls.
    The device_token placeholder (str(user_id)) must be replaced with the
    user's real FCM registration token once the User model stores it.
    """
    event = _event_repo.get_by_id(db, event_id)
    if event is None:
        logger.warning("dispatch_activation_notifications: event %s not found", event_id)
        return 0

    employees = _employees_targeted_by_event(db, event_id)
    for user in employees:
        _notif_svc.deliver_with_fallback(
            db,
            event_id=event_id,
            user_id=user.user_id,
            primary_channel="fcm_activation",
            primary_send_fn=lambda u=user: send_fcm_mock(
                device_token=str(u.user_id),
                title="緊急安全確認",
                body=f"請立即回報您的安全狀態：{event.title}",
                data={"event_id": str(event_id)},
            ),
            fallback_channel="sms_activation" if user.phone else None,
            fallback_send_fn=(
                lambda u=user: send_twilio_sms_mock(
                    to_e164=u.phone,
                    body=f"【安全確認】請立即回報您的安全狀態：{event.title}",
                )
            ) if user.phone else None,
        )
    logger.info(
        "dispatch_activation_notifications: event %s → %d employees notified",
        event_id, len(employees),
    )
    return len(employees)


def dispatch_reminders(
    db: Session,
    event_id: uuid.UUID,
    employees: list[User],
) -> dict[str, int]:
    """
    Send FCM reminders (+ SMS fallback) to employees who have not yet reported safe.

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
                device_token=str(u.user_id),
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
