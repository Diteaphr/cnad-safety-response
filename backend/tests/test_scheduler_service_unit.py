"""Unit tests for scheduler_service scan and lifecycle."""

from __future__ import annotations

import pytest

from app.services import scheduler_service
from app.services.scheduler_service import (
    scan_all_active_events,
    start_scheduler,
    stop_scheduler,
)


def test_scan_all_active_events_no_op_when_none_active(db, make_event):
    make_event(status="closed")
    scan_all_active_events(db)


def test_scan_all_active_events_processes_active(db, make_user, make_department, make_event):
    dept = make_department("Scan Dept")
    make_user(
        email="scan-emp@test.com",
        role="employee",
        department_id=dept.department_id,
    )
    make_event(status="active")
    scan_all_active_events(db)


@pytest.mark.no_db
def test_start_scheduler_skipped_when_use_gcp(monkeypatch):
    monkeypatch.setattr("app.services.scheduler_service.settings.use_gcp", True)
    scheduler_service._scheduler = None
    start_scheduler()
    assert scheduler_service._scheduler is None


@pytest.mark.no_db
def test_start_and_stop_scheduler_local_dev(monkeypatch):
    monkeypatch.setattr("app.services.scheduler_service.settings.use_gcp", False)
    stop_scheduler()
    start_scheduler()
    try:
        assert scheduler_service._scheduler is not None
    finally:
        stop_scheduler()
    assert scheduler_service._scheduler is None


@pytest.mark.no_db
def test_start_scheduler_noop_when_already_running(monkeypatch):
    monkeypatch.setattr("app.services.scheduler_service.settings.use_gcp", False)
    stop_scheduler()
    start_scheduler()
    try:
        first = scheduler_service._scheduler
        start_scheduler()
        assert scheduler_service._scheduler is first
    finally:
        stop_scheduler()
