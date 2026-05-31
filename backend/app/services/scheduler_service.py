"""
APScheduler: automated reminder scan every 15 minutes.

Local dev (USE_GCP=false):
  Runs in-process via APScheduler. No lock needed — single instance.

Production (USE_GCP=true):
  APScheduler is NOT started. A Cloud Scheduler job fires an HTTP POST to
  /api/internal/scheduler/reminder-scan every 15 minutes, calling
  scan_all_active_events() directly through the HTTP endpoint.
  Cloud Scheduler is an external singleton trigger — no distributed lock needed.

Migration from APScheduler:
  Create a Cloud Scheduler job in GCP Console:
    Schedule:  */15 * * * *
    Target:    HTTP POST {SERVICE_URL}/api/internal/scheduler/reminder-scan
    Auth:      OIDC token, service account = PUBSUB_SA_EMAIL
    Audience:  {SERVICE_URL}/api/internal/scheduler/reminder-scan
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import settings

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


# ---------------------------------------------------------------------------
# Scan logic — called by APScheduler (dev) or HTTP endpoint (prod)
# ---------------------------------------------------------------------------

_EMPLOYEE_BATCH_SIZE = 500


def scan_all_active_events(db) -> None:
    from app.repositories.event_repository import EventRepository
    from app.repositories.user_repository import UserRepository
    from app.services.notification_dispatch import dispatch_reminders

    event_repo = EventRepository()
    user_repo = UserRepository()

    active_events = [e for e in event_repo.list_all(db) if e.status == "active"]
    if not active_events:
        logger.debug("Reminder scan: no active events")
        return

    for event in active_events:
        total_sent = total_skipped = total = 0
        offset = 0
        while True:
            batch = user_repo.list_employees(db, limit=_EMPLOYEE_BATCH_SIZE, offset=offset)
            if not batch:
                break
            stats = dispatch_reminders(db, event.event_id, batch)
            total_sent += stats["sent"]
            total_skipped += stats["already_safe"]
            total += stats["total"]
            offset += _EMPLOYEE_BATCH_SIZE

        logger.info(
            "Reminder scan: event %s (%s) → sent=%d already_safe=%d total=%d",
            event.event_id, event.title,
            total_sent, total_skipped, total,
        )


def _run_reminder_scan() -> None:
    """APScheduler entry point (local dev only)."""
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        scan_all_active_events(db)
    except Exception:
        logger.exception("Reminder scan failed")
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

def start_scheduler() -> None:
    """Start APScheduler — local dev only. No-op when USE_GCP=true."""
    global _scheduler
    if settings.use_gcp:
        logger.info("APScheduler skipped: Cloud Scheduler handles reminders in production")
        return
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(daemon=True)
    now = datetime.now(timezone.utc)
    _scheduler.add_job(
        _run_reminder_scan,
        trigger="interval",
        minutes=15,
        id="reminder_scan",
        next_run_time=now + timedelta(minutes=15),
    )
    _scheduler.start()
    logger.info("APScheduler started: reminder_scan every 15 min")


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("APScheduler stopped")
