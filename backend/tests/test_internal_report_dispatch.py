"""
Integration tests for Pub/Sub report dispatch via internal endpoint.

Flow:
  Pub/Sub push → POST /api/internal/notifications/dispatch (kind="report")
    → SafetyResponseService.submit_response() writes to DB
    → if need_help: publish supervisor_alert (mocked in tests)
"""
from __future__ import annotations

import base64
import json

from tests.conftest import auth_headers

DISPATCH_URL = "/api/internal/notifications/dispatch"
MY_REPORTS = "/api/reports/me"


def _envelope(payload: dict) -> dict:
    data = base64.b64encode(json.dumps(payload).encode()).decode()
    return {"message": {"data": data}, "subscription": "projects/test/subscriptions/test"}


# ---------------------------------------------------------------------------
# Happy paths
# ---------------------------------------------------------------------------

def test_internal_report_safe_written_to_db(client, db, make_user, make_event):
    """kind=report status=safe → record created and readable via /api/reports/me."""
    emp = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")

    resp = client.post(DISPATCH_URL, json=_envelope({
        "kind": "report",
        "event_id": str(event.event_id),
        "user_id": str(emp.user_id),
        "status": "safe",
    }))
    assert resp.status_code == 200

    reports = client.get(MY_REPORTS, headers=auth_headers(emp)).json()["reports"]
    assert len(reports) == 1
    assert reports[0]["status"] == "safe"
    assert reports[0]["eventId"] == str(event.event_id)


def test_internal_report_need_help_written_with_comment(client, db, make_user, make_event):
    """kind=report need_help with comment/location → all fields persisted."""
    emp = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")

    resp = client.post(DISPATCH_URL, json=_envelope({
        "kind": "report",
        "event_id": str(event.event_id),
        "user_id": str(emp.user_id),
        "status": "need_help",
        "comment": "Injured",
        "location": "Building A",
    }))
    assert resp.status_code == 200

    reports = client.get(MY_REPORTS, headers=auth_headers(emp)).json()["reports"]
    assert reports[0]["status"] == "need_help"
    assert reports[0]["comment"] == "Injured"
    assert reports[0]["location"] == "Building A"


def test_internal_report_idempotent_upsert(client, db, make_user, make_event):
    """Processing the same report twice upserts, not duplicates."""
    emp = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")
    envelope = _envelope({
        "kind": "report",
        "event_id": str(event.event_id),
        "user_id": str(emp.user_id),
        "status": "safe",
    })

    client.post(DISPATCH_URL, json=envelope)
    client.post(DISPATCH_URL, json=envelope)

    reports = client.get(MY_REPORTS, headers=auth_headers(emp)).json()["reports"]
    assert len(reports) == 1


def test_internal_report_status_updated_on_second_delivery(client, db, make_user, make_event):
    """If Pub/Sub redelivers with updated status, the record is updated (upsert)."""
    emp = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")

    client.post(DISPATCH_URL, json=_envelope({
        "kind": "report", "event_id": str(event.event_id),
        "user_id": str(emp.user_id), "status": "need_help",
    }))
    client.post(DISPATCH_URL, json=_envelope({
        "kind": "report", "event_id": str(event.event_id),
        "user_id": str(emp.user_id), "status": "safe",
    }))

    reports = client.get(MY_REPORTS, headers=auth_headers(emp)).json()["reports"]
    assert len(reports) == 1
    assert reports[0]["status"] == "safe"


# ---------------------------------------------------------------------------
# Error cases
# ---------------------------------------------------------------------------

def test_internal_report_missing_event_id_returns_400(client, make_user):
    emp = make_user(email="emp@test.com", role="employee")
    resp = client.post(DISPATCH_URL, json=_envelope({
        "kind": "report",
        "user_id": str(emp.user_id),
        "status": "safe",
    }))
    assert resp.status_code == 400


def test_internal_report_missing_user_id_returns_400(client, make_event):
    event = make_event(status="active")
    resp = client.post(DISPATCH_URL, json=_envelope({
        "kind": "report",
        "event_id": str(event.event_id),
        "status": "safe",
    }))
    assert resp.status_code == 400
