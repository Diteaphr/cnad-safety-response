"""
Tests for POST /api/internal/notifications/dispatch — kind="user_fcm".

The internal endpoint is the Pub/Sub push target.  Each message carries one
employee's details; the handler calls dispatch_single_user_notification which
uses deliver_with_fallback for idempotency + SMS fallback.

Pub/Sub push envelope:
  {"message": {"data": "<base64(json)>"}, "subscription": "..."}
"""
from __future__ import annotations

import base64
import json
import uuid
from unittest.mock import patch

from tests.conftest import auth_headers

DISPATCH_URL = "/api/internal/notifications/dispatch"
NOTIFICATIONS_ME = "/api/notifications/me"

FCM_FN = "app.services.notification_dispatch.send_fcm_mock"
SMS_FN = "app.services.notification_dispatch.send_twilio_sms_mock"


def _envelope(payload: dict) -> dict:
    """Wrap a dict in a Pub/Sub push envelope (base64-encoded data field)."""
    data = base64.b64encode(json.dumps(payload).encode()).decode()
    return {"message": {"data": data}, "subscription": "projects/test/subscriptions/test-sub"}


def _user_fcm_payload(event_id, user_id, *, token="tok123", phone=None,
                      title="緊急安全確認", body="請立即回報") -> dict:
    return {
        "kind": "user_fcm",
        "event_id": str(event_id),
        "user_id": str(user_id),
        "token": token,
        "phone": phone,
        "title": title,
        "body": body,
    }


# ---------------------------------------------------------------------------
# Happy path — FCM delivered
# ---------------------------------------------------------------------------

def test_user_fcm_fcm_success_logs_sent(client, make_user, make_event):
    """Valid user_fcm message → FCM sent → fcm_activation row status=sent."""
    emp = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")

    with patch(FCM_FN, return_value=True):
        resp = client.post(
            DISPATCH_URL,
            json=_envelope(_user_fcm_payload(event.event_id, emp.user_id)),
        )

    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
    fcm_rows = [n for n in notifs if n["channel"] == "fcm_activation"]
    assert len(fcm_rows) == 1
    assert fcm_rows[0]["status"] == "sent"


# ---------------------------------------------------------------------------
# SMS fallback
# ---------------------------------------------------------------------------

def test_user_fcm_sms_fallback_when_fcm_fails_and_user_has_phone(
    client, make_user, make_event
):
    """FCM failure + user has phone → sms_activation row created with status=sent."""
    emp = make_user(email="emp@test.com", role="employee", phone="+886912345678")
    event = make_event(status="active")

    with patch(FCM_FN, return_value=False), patch(SMS_FN, return_value=True):
        resp = client.post(
            DISPATCH_URL,
            json=_envelope(_user_fcm_payload(
                event.event_id, emp.user_id, phone="+886912345678"
            )),
        )

    assert resp.status_code == 200

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
    by_channel = {n["channel"]: n for n in notifs}
    assert by_channel["fcm_activation"]["status"] == "failed"
    assert "sms_activation" in by_channel
    assert by_channel["sms_activation"]["status"] == "sent"


def test_user_fcm_no_sms_fallback_when_user_has_no_phone(
    client, make_user, make_event
):
    """FCM failure + no phone → only fcm_activation row (failed), no SMS row."""
    emp = make_user(email="emp@test.com", role="employee", phone=None)
    event = make_event(status="active")

    with patch(FCM_FN, return_value=False):
        resp = client.post(
            DISPATCH_URL,
            json=_envelope(_user_fcm_payload(event.event_id, emp.user_id, phone=None)),
        )

    assert resp.status_code == 200

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
    by_channel = {n["channel"]: n for n in notifs}
    assert by_channel["fcm_activation"]["status"] == "failed"
    assert "sms_activation" not in by_channel


# ---------------------------------------------------------------------------
# Idempotency
# ---------------------------------------------------------------------------

def test_user_fcm_idempotent_second_delivery_is_noop(client, make_user, make_event):
    """Delivering the same user_fcm message twice must not create duplicate rows."""
    emp = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")
    envelope = _envelope(_user_fcm_payload(event.event_id, emp.user_id))

    with patch(FCM_FN, return_value=True):
        client.post(DISPATCH_URL, json=envelope)
        client.post(DISPATCH_URL, json=envelope)

    notifs = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp)).json()["notifications"]
    fcm_rows = [n for n in notifs if n["channel"] == "fcm_activation"]
    assert len(fcm_rows) == 1, "deliver_with_fallback must be idempotent"


# ---------------------------------------------------------------------------
# Invalid payloads → 400
# ---------------------------------------------------------------------------

def test_user_fcm_missing_event_id_returns_400(client, make_user):
    emp = make_user(email="emp@test.com", role="employee")
    bad_payload = {
        "kind": "user_fcm",
        # event_id intentionally omitted
        "user_id": str(emp.user_id),
        "token": "tok",
    }
    resp = client.post(DISPATCH_URL, json=_envelope(bad_payload))
    assert resp.status_code == 400


def test_user_fcm_missing_user_id_returns_400(client, make_event):
    event = make_event(status="active")
    bad_payload = {
        "kind": "user_fcm",
        "event_id": str(event.event_id),
        # user_id intentionally omitted
        "token": "tok",
    }
    resp = client.post(DISPATCH_URL, json=_envelope(bad_payload))
    assert resp.status_code == 400


def test_user_fcm_invalid_uuid_event_id_returns_400(client):
    bad_payload = {
        "kind": "user_fcm",
        "event_id": "not-a-uuid",
        "user_id": str(uuid.uuid4()),
        "token": "tok",
    }
    resp = client.post(DISPATCH_URL, json=_envelope(bad_payload))
    assert resp.status_code == 400


def test_dispatch_invalid_base64_returns_400(client):
    """Malformed Pub/Sub envelope (invalid base64) → 400."""
    resp = client.post(
        DISPATCH_URL,
        json={"message": {"data": "!!!not-valid-base64!!!"}, "subscription": "x"},
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Unknown kind — acknowledged without error
# ---------------------------------------------------------------------------

def test_unknown_kind_returns_200(client):
    """Unknown kind must be acknowledged (200) without raising an error."""
    resp = client.post(
        DISPATCH_URL,
        json=_envelope({"kind": "future_kind", "data": "whatever"}),
    )
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
