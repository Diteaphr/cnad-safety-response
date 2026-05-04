"""
APScheduler: automated reminder scan every 15 minutes.

Local dev  (REDIS_ENABLED=false or USE_GCP=false):
  Runs in-process. Lock is skipped (single instance assumed).

Production (Cloud Run, REDIS_ENABLED=true):
  Redis distributed lock (SET NX + TTL=14 min) ensures only one Cloud Run
  instance runs the job at a time. Without the lock, each instance would
  independently scan and send duplicate reminders.

  Lock TTL is 14 minutes — slightly less than the 15-min interval — so the
  lock always expires before the next run even if an instance crashes mid-job.

Phase 3 migration path:
  Replace BackgroundScheduler with Cloud Scheduler + Cloud Tasks HTTP target.
  The scan logic in _scan_all_active_events() stays unchanged; only the trigger
  mechanism changes.
"""
from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import settings

logger = logging.getLogger(__name__)

_LOCK_KEY = "scheduler:reminder_scan"
_LOCK_TTL_SECONDS = 14 * 60

_scheduler: BackgroundScheduler | None = None


# ---------------------------------------------------------------------------
# Redis distributed lock
# ---------------------------------------------------------------------------

def _acquire_lock() -> bool:
    """SET NX + TTL. Returns True if this instance acquired the lock."""
    if not settings.redis_enabled:
        return True  # dev without Redis: single instance, always run
    try:
        import redis
        r = redis.from_url(settings.redis_url)
        acquired = bool(r.set(_LOCK_KEY, "1", nx=True, ex=_LOCK_TTL_SECONDS))
        r.close()
        return acquired
    except Exception:
        logger.warning("Redis lock unavailable; running reminder scan without lock")
        return True


def _release_lock() -> None:
    if not settings.redis_enabled:
        return
    try:
        import redis
        r = redis.from_url(settings.redis_url)
        r.delete(_LOCK_KEY)
        r.close()
    except Exception:
        logger.warning("Redis lock release failed", exc_info=False)


# ---------------------------------------------------------------------------
# Scan job
# ---------------------------------------------------------------------------

def _run_reminder_scan() -> None:
    """APScheduler entry point — acquire lock, scan, release."""
    if not _acquire_lock():
        logger.debug("Reminder scan skipped: another Cloud Run instance holds the lock")
        return

    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        _scan_all_active_events(db)
    except Exception:
        logger.exception("Reminder scan failed")
    finally:
        db.close()
        _release_lock()


def _scan_all_active_events(db) -> None:
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
        target_dept_ids = {ed.department_id for ed in event.event_departments}
        all_users = user_repo.list_all(db)

        def _is_employee(u) -> bool:
            return any(ur.role.role_name == "employee" for ur in u.user_roles)

        if target_dept_ids:
            employees = [
                u for u in all_users
                if _is_employee(u) and u.department_id in target_dept_ids
            ]
        else:
            employees = [u for u in all_users if _is_employee(u)]

        stats = dispatch_reminders(db, event.event_id, employees)
        logger.info(
            "Reminder scan: event %s (%s) → sent=%d already_safe=%d total=%d",
            event.event_id, event.title,
            stats["sent"], stats["already_safe"], stats["total"],
        )


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        _run_reminder_scan,
        trigger="interval",
        minutes=15,
        id="reminder_scan",
        next_run_time=None,  # don't fire immediately on startup
    )
    _scheduler.start()
    logger.info("APScheduler started: reminder_scan every 15 minutes")


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("APScheduler stopped")
