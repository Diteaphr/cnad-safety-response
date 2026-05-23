"""
Tests for supervisor_alert notification dispatch.

Flow:
  Employee reports need_help
    → safety_response_service publishes kind="supervisor_alert" to Pub/Sub
    → POST /api/internal/notifications/dispatch
    → dispatch_supervisor_alert()
    → FCM to supervisor (+ SMS fallback)

Tests cover:
  - FCM sent to supervisor when employee reports need_help
  - No alert when employee has no department / no supervisor
  - SMS fallback when FCM fails and supervisor has phone
  - No SMS when supervisor has no phone
  - Idempotency: second delivery is a no-op
  - Invalid payload → 400
"""
from __future__ import annotations

import base64
import json
from unittest.mock import patch

from app.services.notification_dispatch import dispatch_supervisor_alert
from tests.conftest import auth_headers

DISPATCH_URL = "/api/internal/notifications/dispatch"
NOTIFICATIONS_ME = "/api/notifications/me"

FCM_FN = "app.services.notification_dispatch.send_fcm_mock"
SMS_FN = "app.services.notification_dispatch.send_twilio_sms_mock"


def _envelope(payload: dict) -> dict:
    data = base64.b64encode(json.dumps(payload).encode()).decode()
    return {"message": {"data": data}, "subscription": "projects/test/subscriptions/test"}


def _alert_payload(event_id, employee_user_id) -> dict:
    return {
        "kind": "supervisor_alert",
        "event_id": str(event_id),
        "user_id": str(employee_user_id),
    }


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

def test_supervisor_receives_fcm_when_employee_reports_need_help(
    client, db, make_user, make_event, make_department
):
    dept = make_department("Engineering")
    sup = make_user(email="sup@test.com", role="supervisor", managed_department_id=dept.department_id)
    emp = make_user(email="emp@test.com", role="employee", department_id=dept.department_id)
    event = make_event(status="active")

    with patch(FCM_FN, return_value=True):
        resp = client.post(DISPATCH_URL, json=_envelope(_alert_payload(event.event_id, emp.user_id)))

    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(sup)).json()["notifications"]
    alert_rows = [n for n in notifs if n["channel"] == "fcm_supervisor_alert"]
    assert len(alert_rows) == 1
    assert alert_rows[0]["status"] == "sent"


def test_supervisor_alert_via_dispatch_function_directly(
    client, db, make_user, make_event, make_department
):
    """dispatch_supervisor_alert() can be called directly (not only via endpoint)."""
    dept = make_department("Ops")
    sup = make_user(email="sup@test.com", role="supervisor", managed_department_id=dept.department_id)
    emp = make_user(email="emp@test.com", role="employee", department_id=dept.department_id)
    event = make_event(status="active")

    with patch(FCM_FN, return_value=True):
        dispatch_supervisor_alert(db, event_id=event.event_id, employee_user_id=emp.user_id)

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(sup)).json()["notifications"]
    assert any(n["channel"] == "fcm_supervisor_alert" and n["status"] == "sent" for n in notifs)


# ---------------------------------------------------------------------------
# No supervisor cases
# ---------------------------------------------------------------------------

def test_no_alert_when_employee_has_no_department(
    client, db, make_user, make_event
):
    """Employee with no department → no supervisor → no notification sent."""
    emp = make_user(email="emp@test.com", role="employee")  # no department_id
    event = make_event(status="active")

    with patch(FCM_FN, return_value=True) as mock_fcm:
        resp = client.post(DISPATCH_URL, json=_envelope(_alert_payload(event.event_id, emp.user_id)))

    assert resp.status_code == 200
    mock_fcm.assert_not_called()


def test_no_alert_when_department_has_no_manager(
    client, db, make_user, make_event, make_department
):
    """Department with no manager set → no notification sent."""
    dept = make_department("Unmanaged")
    emp = make_user(email="emp@test.com", role="employee", department_id=dept.department_id)
    event = make_event(status="active")

    with patch(FCM_FN, return_value=True) as mock_fcm:
        resp = client.post(DISPATCH_URL, json=_envelope(_alert_payload(event.event_id, emp.user_id)))

    assert resp.status_code == 200
    mock_fcm.assert_not_called()


# ---------------------------------------------------------------------------
# SMS fallback
# ---------------------------------------------------------------------------

def test_sms_fallback_when_fcm_fails_and_supervisor_has_phone(
    client, db, make_user, make_event, make_department
):
    dept = make_department("Field")
    sup = make_user(
        email="sup@test.com", role="supervisor",
        managed_department_id=dept.department_id,
        phone="+886912345678",
    )
    emp = make_user(email="emp@test.com", role="employee", department_id=dept.department_id)
    event = make_event(status="active")

    with patch(FCM_FN, return_value=False), patch(SMS_FN, return_value=True):
        client.post(DISPATCH_URL, json=_envelope(_alert_payload(event.event_id, emp.user_id)))

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(sup)).json()["notifications"]
    by_channel = {n["channel"]: n for n in notifs}
    assert by_channel["fcm_supervisor_alert"]["status"] == "failed"
    assert "sms_supervisor_alert" in by_channel
    assert by_channel["sms_supervisor_alert"]["status"] == "sent"


def test_no_sms_fallback_when_supervisor_has_no_phone(
    client, db, make_user, make_event, make_department
):
    dept = make_department("IT")
    sup = make_user(
        email="sup@test.com", role="supervisor",
        managed_department_id=dept.department_id,
        phone=None,
    )
    emp = make_user(email="emp@test.com", role="employee", department_id=dept.department_id)
    event = make_event(status="active")

    with patch(FCM_FN, return_value=False):
        client.post(DISPATCH_URL, json=_envelope(_alert_payload(event.event_id, emp.user_id)))

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(sup)).json()["notifications"]
    by_channel = {n["channel"]: n for n in notifs}
    assert by_channel["fcm_supervisor_alert"]["status"] == "failed"
    assert "sms_supervisor_alert" not in by_channel


# ---------------------------------------------------------------------------
# Idempotency
# ---------------------------------------------------------------------------

def test_supervisor_alert_idempotent(
    client, db, make_user, make_event, make_department
):
    """Delivering the same supervisor_alert twice → only one notification row."""
    dept = make_department("QA")
    sup = make_user(email="sup@test.com", role="supervisor", managed_department_id=dept.department_id)
    emp = make_user(email="emp@test.com", role="employee", department_id=dept.department_id)
    event = make_event(status="active")
    envelope = _envelope(_alert_payload(event.event_id, emp.user_id))

    with patch(FCM_FN, return_value=True):
        client.post(DISPATCH_URL, json=envelope)
        client.post(DISPATCH_URL, json=envelope)

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(sup)).json()["notifications"]
    alert_rows = [n for n in notifs if n["channel"] == "fcm_supervisor_alert"]
    assert len(alert_rows) == 1, "deliver_with_fallback must be idempotent"


# ---------------------------------------------------------------------------
# Invalid payloads → 400
# ---------------------------------------------------------------------------

def test_supervisor_alert_missing_event_id_returns_400(client, make_user):
    emp = make_user(email="emp@test.com", role="employee")
    resp = client.post(DISPATCH_URL, json=_envelope({
        "kind": "supervisor_alert",
        "user_id": str(emp.user_id),
    }))
    assert resp.status_code == 400


def test_supervisor_alert_missing_user_id_returns_400(client, make_event):
    event = make_event(status="active")
    resp = client.post(DISPATCH_URL, json=_envelope({
        "kind": "supervisor_alert",
        "event_id": str(event.event_id),
    }))
    assert resp.status_code == 400
