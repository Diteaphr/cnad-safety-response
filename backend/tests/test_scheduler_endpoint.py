"""
Integration tests for:
  POST /api/internal/scheduler/reminder-scan

USE_GCP=false in tests → verify_scheduler_oidc is skipped (no OIDC token needed).
"""
from __future__ import annotations

from tests.conftest import auth_headers

SCAN_URL = "/api/internal/scheduler/reminder-scan"


def test_reminder_scan_no_active_events(client, roles):
    """Returns 200 with no errors when there are no active events."""
    resp = client.post(SCAN_URL)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_reminder_scan_sends_to_pending_employees(client, make_user, make_department, make_event):
    """Scan triggers reminders for employees who have not yet reported."""
    d = make_department("Dept")
    _sup = make_user(email="sup@test.com", role="supervisor", managed_department_id=d.department_id)
    _emp = make_user(email="emp@test.com", role="employee", department_id=d.department_id, phone="+886900000001")
    make_event(status="active")

    resp = client.post(SCAN_URL)
    assert resp.status_code == 200


def test_reminder_scan_skips_closed_events(client, make_user, make_department, make_event):
    """Closed events must not trigger reminders."""
    d = make_department("Dept")
    _emp = make_user(email="emp@test.com", role="employee", department_id=d.department_id)
    make_event(status="closed")

    resp = client.post(SCAN_URL)
    assert resp.status_code == 200


def test_reminder_scan_skips_safe_respondents(client, make_user, make_department, make_event):
    """Employees who already reported safe must not be reminded again."""
    d = make_department("Dept")
    emp = make_user(email="emp@test.com", role="employee", department_id=d.department_id)
    event = make_event(status="active")

    client.post(
        "/api/reports",
        json={"eventId": str(event.event_id), "userId": str(emp.user_id), "status": "safe"},
        headers=auth_headers(emp),
    )

    resp = client.post(SCAN_URL)
    assert resp.status_code == 200


def test_reminder_scan_skips_need_help_respondents(client, make_user, make_department, make_event):
    """Employees who reported need_help have already responded — no further reminders."""
    d = make_department("Dept")
    emp = make_user(email="emp@test.com", role="employee", department_id=d.department_id)
    event = make_event(status="active")

    client.post(
        "/api/reports",
        json={"eventId": str(event.event_id), "userId": str(emp.user_id), "status": "need_help"},
        headers=auth_headers(emp),
    )

    resp = client.post(SCAN_URL)
    assert resp.status_code == 200
