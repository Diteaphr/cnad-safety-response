"""Cover APScheduler local entrypoint."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.services.scheduler_service import _run_reminder_scan

pytestmark = pytest.mark.no_db


def test_run_reminder_scan_invokes_scan(monkeypatch):
    with patch("app.services.scheduler_service.scan_all_active_events") as scan:
        _run_reminder_scan()
    scan.assert_called_once()


def test_run_reminder_scan_logs_exception(monkeypatch):
    with patch(
        "app.services.scheduler_service.scan_all_active_events",
        side_effect=RuntimeError("scan failed"),
    ):
        _run_reminder_scan()
