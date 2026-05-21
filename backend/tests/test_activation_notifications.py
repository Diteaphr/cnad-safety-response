"""
Integration tests for notification delivery logic:

  POST /api/events
    - Creates an active event and schedules activation fan-out (BackgroundTask).

  dispatch_activation_notifications (company-wide)
    - All employees receive FCM activation (not scoped by department)
    - Supervisors and admins receive nothing
    - Idempotent: calling dispatch twice does not duplicate notification rows
    - SMS fallback when FCM fails (user has phone)
    - No SMS fallback when user has no phone

  POST /api/events/{id}/reminders
    - SMS fallback when FCM fails (user has phone)
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

from app.services.notification_dispatch import dispatch_activation_notifications
from tests.conftest import auth_headers

NOTIFICATIONS_ME = "/api/notifications/me"
CREATE_EVENT = "/api/events"


def _reminders_url(event_id) -> str:
    return f"/api/events/{event_id}/reminders"


def _notifs_by_channel(notifs: list[dict]) -> dict[str, dict]:
    return {n["channel"]: n for n in notifs}


# ---------------------------------------------------------------------------
# create_event — immediate active + activation dispatch
# ---------------------------------------------------------------------------

def test_create_event_is_active_and_dispatches_activation(
    client, make_user, make_department
):
    """POST /api/events creates an active event and runs activation fan-out."""
    admin = make_user(email="admin@test.com", role="admin")
    target_dept = make_department("Engineering")
    emp_in = make_user(
        email="emp_in@test.com", role="employee", department_id=target_dept.department_id
    )

    body = {
        "title": "New Live Event",
        "type": "Earthquake",
        "description": "integration",
        "startAt": datetime.now(timezone.utc).isoformat(),
        "targetDepartmentIds": [],
    }
    resp = client.post(CREATE_EVENT, json=body, headers=auth_headers(admin))
    assert resp.status_code == 200
    assert resp.json()["event"]["status"] == "active"
    assert resp.json()["event"]["targetDepartmentIds"] == []

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp_in)).json()["notifications"]
    assert len(notifs) == 1
    assert notifs[0]["channel"] == "fcm_activation"
    assert notifs[0]["status"] == "sent"


# ---------------------------------------------------------------------------
# dispatch_activation_notifications — company-wide
# ---------------------------------------------------------------------------

def test_activation_notifies_all_employees_independent_of_department(
    client, db, make_user, make_event, make_department
):
    """Employees in any department receive activation (company-wide event)."""
    target_dept = make_department("Engineering")
    other_dept = make_department("Marketing")

    emp_in = make_user(
        email="emp_in@test.com", role="employee", department_id=target_dept.department_id
    )
    emp_out = make_user(
        email="emp_out@test.com", role="employee", department_id=other_dept.department_id
    )

    event = make_event(status="active")
    dispatch_activation_notifications(db, event.event_id)

    for emp in (emp_in, emp_out):
        notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
        assert len(notifs) == 1
        assert notifs[0]["channel"] == "fcm_activation"
        assert notifs[0]["status"] == "sent"


def test_activation_does_not_notify_supervisors_or_admins(
    client, db, make_user, make_event
):
    admin = make_user(email="admin@test.com", role="admin")
    sup = make_user(email="sup@test.com", role="supervisor")

    event = make_event(status="active")
    dispatch_activation_notifications(db, event.event_id)

    for non_emp in (admin, sup):
        notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(non_emp)).json()["notifications"]
        assert notifs == []


def test_activation_notifications_idempotent(
    client, db, make_user, make_event
):
    """Calling dispatch twice does not duplicate notification rows."""
    emp = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")

    dispatch_activation_notifications(db, event.event_id)
    dispatch_activation_notifications(db, event.event_id)

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
    fcm_rows = [n for n in notifs if n["channel"] == "fcm_activation"]
    assert len(fcm_rows) == 1, "Exactly one FCM activation row expected (idempotent)"


def test_activate_sms_fallback_when_fcm_fails(
    client, db, make_user, make_event, make_department
):
    dept = make_department("Field Ops")
    emp = make_user(
        email="emp@test.com",
        role="employee",
        phone="+886912345678",
        department_id=dept.department_id,
    )
    event = make_event(status="active")

    with patch("app.services.notification_dispatch.send_fcm_mock", return_value=False):
        dispatch_activation_notifications(db, event.event_id)

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
    by_channel = _notifs_by_channel(notifs)

    assert by_channel["fcm_activation"]["status"] == "failed"
    assert "sms_activation" in by_channel, "SMS fallback row should have been created"
    assert by_channel["sms_activation"]["status"] == "sent"


def test_activate_no_sms_fallback_when_user_has_no_phone(
    client, db, make_user, make_event, make_department
):
    dept = make_department("IT")
    emp = make_user(
        email="emp@test.com",
        role="employee",
        phone=None,
        department_id=dept.department_id,
    )
    event = make_event(status="active")

    with patch("app.services.notification_dispatch.send_fcm_mock", return_value=False):
        dispatch_activation_notifications(db, event.event_id)

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
    by_channel = _notifs_by_channel(notifs)

    assert by_channel["fcm_activation"]["status"] == "failed"
    assert "sms_activation" not in by_channel, "No phone → no SMS row"


# ---------------------------------------------------------------------------
# dispatch_activation_notifications — department-targeted events
# ---------------------------------------------------------------------------

def test_activation_notifies_only_employees_in_targeted_department(
    client, db, make_user, make_event, make_department
):
    """Targeted event: only employees in the target department receive notification."""
    dept_a = make_department("Engineering")
    dept_b = make_department("Marketing")
    emp_a = make_user(email="emp_a@test.com", role="employee", department_id=dept_a.department_id)
    emp_b = make_user(email="emp_b@test.com", role="employee", department_id=dept_b.department_id)

    event = make_event(status="active", target_department_ids=[dept_a.department_id])
    dispatch_activation_notifications(db, event.event_id)

    notifs_a = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp_a)).json()["notifications"]
    notifs_b = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp_b)).json()["notifications"]

    assert len(notifs_a) == 1
    assert notifs_a[0]["channel"] == "fcm_activation"
    assert notifs_b == [], "Employee outside targeted dept must not be notified"


def test_activation_targeted_dept_includes_child_dept_employees(
    client, db, make_user, make_event, make_department
):
    """When event stores parent+child depts, employee in child dept is also notified."""
    parent = make_department("R&D")
    child = make_department("Frontend", parent_id=parent.department_id)
    emp_parent = make_user(email="ep@test.com", role="employee", department_id=parent.department_id)
    emp_child = make_user(email="ec@test.com", role="employee", department_id=child.department_id)
    emp_other = make_user(email="eo@test.com", role="employee")  # no dept

    # Simulate what the API does: expand_subtree stores both parent and child
    event = make_event(
        status="active",
        target_department_ids=[parent.department_id, child.department_id],
    )
    dispatch_activation_notifications(db, event.event_id)

    for emp in (emp_parent, emp_child):
        notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
        assert len(notifs) == 1, f"{emp.email} should receive notification"

    other_notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp_other)).json()["notifications"]
    assert other_notifs == []


# ---------------------------------------------------------------------------
# send_reminders — SMS fallback
# ---------------------------------------------------------------------------

def test_reminder_sms_fallback_when_fcm_fails(
    client, make_user, make_department, make_event
):
    d = make_department("T")
    sup = make_user(email="sup@test.com", role="supervisor", managed_department_id=d.department_id)
    emp = make_user(
        email="emp@test.com",
        role="employee",
        phone="+886987654321",
        department_id=d.department_id,
    )
    event = make_event(status="active")

    with patch("app.services.notification_dispatch.send_fcm_mock", return_value=False):
        resp = client.post(_reminders_url(event.event_id), headers=auth_headers(sup))
    assert resp.status_code == 200

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
    by_channel = _notifs_by_channel(notifs)

    assert by_channel["fcm_reminder"]["status"] == "failed"
    assert "sms_reminder" in by_channel
    assert by_channel["sms_reminder"]["status"] == "sent"


def test_reminder_no_sms_fallback_when_user_has_no_phone(
    client, make_user, make_department, make_event
):
    d = make_department("T")
    sup = make_user(email="sup@test.com", role="supervisor", managed_department_id=d.department_id)
    emp = make_user(
        email="emp@test.com",
        role="employee",
        phone=None,
        department_id=d.department_id,
    )
    event = make_event(status="active")

    with patch("app.services.notification_dispatch.send_fcm_mock", return_value=False):
        client.post(_reminders_url(event.event_id), headers=auth_headers(sup))

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
    by_channel = _notifs_by_channel(notifs)

    assert by_channel["fcm_reminder"]["status"] == "failed"
    assert "sms_reminder" not in by_channel
