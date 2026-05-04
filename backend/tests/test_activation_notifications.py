"""
Integration tests for notification delivery logic:

  POST /api/events/{id}/activate
    - FCM pushed to employees in targeted departments only
    - No target departments → all employees notified (company-wide event)
    - Idempotent: activating twice doesn't duplicate notification rows
    - SMS fallback triggered when FCM fails (user has phone)
    - No SMS fallback when user has no phone

  POST /api/events/{id}/reminders
    - SMS fallback triggered when FCM fails (user has phone)
    - No SMS fallback when user has no phone

How SMS fallback is tested:
  send_fcm_mock is patched to return False inside portal_service so that
  deliver_with_idempotency marks the FCM row as "failed", which causes
  deliver_with_fallback to attempt the SMS channel next.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest

from tests.conftest import auth_headers

NOTIFICATIONS_ME = "/api/notifications/me"


def _activate_url(event_id) -> str:
    return f"/api/events/{event_id}/activate"


def _reminders_url(event_id) -> str:
    return f"/api/events/{event_id}/reminders"


def _notifs_by_channel(notifs: list[dict]) -> dict[str, dict]:
    """Index a list of notification dicts by channel name for easy lookup."""
    return {n["channel"]: n for n in notifs}


# ---------------------------------------------------------------------------
# activate_event — department filtering
# ---------------------------------------------------------------------------

def test_activate_notifies_targeted_dept_employees(
    client, make_user, make_event, make_department
):
    """Only employees whose department is in the event's targetDepartmentIds receive FCM."""
    admin = make_user(email="admin@test.com", role="admin")
    target_dept = make_department("Engineering")
    other_dept = make_department("Marketing")

    emp_in = make_user(
        email="emp_in@test.com", role="employee", department_id=target_dept.department_id
    )
    emp_out = make_user(
        email="emp_out@test.com", role="employee", department_id=other_dept.department_id
    )

    event = make_event(status="draft", department_ids=[target_dept.department_id])

    resp = client.post(_activate_url(event.event_id), headers=auth_headers(admin))
    assert resp.status_code == 200

    notifs_in = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp_in)).json()["notifications"]
    notifs_out = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp_out)).json()["notifications"]

    assert len(notifs_in) == 1
    assert notifs_in[0]["channel"] == "fcm_activation"
    assert notifs_in[0]["status"] == "sent"

    # Employee in the non-targeted department must receive nothing
    assert len(notifs_out) == 0


def test_activate_no_target_depts_notifies_all_employees(
    client, make_user, make_event, make_department
):
    """An event with no target departments is company-wide: all employees get FCM."""
    admin = make_user(email="admin@test.com", role="admin")
    dept_a = make_department("Dept A")
    dept_b = make_department("Dept B")

    emp_a = make_user(email="a@test.com", role="employee", department_id=dept_a.department_id)
    emp_b = make_user(email="b@test.com", role="employee", department_id=dept_b.department_id)

    # No department_ids → company-wide
    event = make_event(status="draft")

    client.post(_activate_url(event.event_id), headers=auth_headers(admin))

    for emp in (emp_a, emp_b):
        notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
        assert len(notifs) == 1
        assert notifs[0]["channel"] == "fcm_activation"
        assert notifs[0]["status"] == "sent"


def test_activate_does_not_notify_supervisors_or_admins(
    client, make_user, make_event
):
    """Activation notifications go to employees only, not supervisors or admins."""
    admin = make_user(email="admin@test.com", role="admin")
    sup = make_user(email="sup@test.com", role="supervisor")

    event = make_event(status="draft")
    client.post(_activate_url(event.event_id), headers=auth_headers(admin))

    for non_emp in (admin, sup):
        notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(non_emp)).json()["notifications"]
        assert notifs == []


# ---------------------------------------------------------------------------
# activate_event — idempotency
# ---------------------------------------------------------------------------

def test_activate_notifications_idempotent(
    client, make_user, make_event
):
    """Calling activate twice does not duplicate notification rows (idempotency guard)."""
    admin = make_user(email="admin@test.com", role="admin")
    emp = make_user(email="emp@test.com", role="employee")
    event = make_event(status="draft")

    client.post(_activate_url(event.event_id), headers=auth_headers(admin))
    # Second activate: event is already active; notifications already sent
    client.post(_activate_url(event.event_id), headers=auth_headers(admin))

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
    fcm_rows = [n for n in notifs if n["channel"] == "fcm_activation"]
    assert len(fcm_rows) == 1, "Exactly one FCM activation row expected (idempotent)"


# ---------------------------------------------------------------------------
# activate_event — SMS fallback
# ---------------------------------------------------------------------------

def test_activate_sms_fallback_when_fcm_fails(
    client, make_user, make_event, make_department
):
    """When FCM fails, users with a phone number receive an SMS notification instead."""
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("Field Ops")
    emp = make_user(
        email="emp@test.com",
        role="employee",
        phone="+886912345678",
        department_id=dept.department_id,
    )
    event = make_event(status="draft", department_ids=[dept.department_id])

    with patch("app.services.notification_dispatch.send_fcm_mock", return_value=False):
        resp = client.post(_activate_url(event.event_id), headers=auth_headers(admin))
    assert resp.status_code == 200

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
    by_channel = _notifs_by_channel(notifs)

    assert by_channel["fcm_activation"]["status"] == "failed"
    assert "sms_activation" in by_channel, "SMS fallback row should have been created"
    assert by_channel["sms_activation"]["status"] == "sent"


def test_activate_no_sms_fallback_when_user_has_no_phone(
    client, make_user, make_event, make_department
):
    """Users without a phone number receive no SMS row even when FCM fails."""
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("IT")
    emp = make_user(
        email="emp@test.com",
        role="employee",
        phone=None,  # no phone
        department_id=dept.department_id,
    )
    event = make_event(status="draft", department_ids=[dept.department_id])

    with patch("app.services.notification_dispatch.send_fcm_mock", return_value=False):
        client.post(_activate_url(event.event_id), headers=auth_headers(admin))

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
    by_channel = _notifs_by_channel(notifs)

    assert by_channel["fcm_activation"]["status"] == "failed"
    assert "sms_activation" not in by_channel, "No phone → no SMS row"


# ---------------------------------------------------------------------------
# send_reminders — SMS fallback
# ---------------------------------------------------------------------------

def test_reminder_sms_fallback_when_fcm_fails(
    client, make_user, make_event
):
    """When the supervisor sends reminders and FCM fails, SMS is sent to users with a phone."""
    sup = make_user(email="sup@test.com", role="supervisor")
    emp = make_user(
        email="emp@test.com",
        role="employee",
        phone="+886987654321",
        manager_id=sup.user_id,
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
    client, make_user, make_event
):
    """When FCM fails and the user has no phone, only the failed FCM row is created."""
    sup = make_user(email="sup@test.com", role="supervisor")
    emp = make_user(
        email="emp@test.com",
        role="employee",
        phone=None,
        manager_id=sup.user_id,
    )
    event = make_event(status="active")

    with patch("app.services.notification_dispatch.send_fcm_mock", return_value=False):
        client.post(_reminders_url(event.event_id), headers=auth_headers(sup))

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
    by_channel = _notifs_by_channel(notifs)

    assert by_channel["fcm_reminder"]["status"] == "failed"
    assert "sms_reminder" not in by_channel
