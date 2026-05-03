"""
Integration tests for:
  POST /api/reports      — submit a safety report
  GET  /api/reports/me   — list own reports
"""
from __future__ import annotations

import uuid

import pytest

from tests.conftest import auth_headers

REPORTS = "/api/reports"
MY_REPORTS = "/api/reports/me"


# ---------------------------------------------------------------------------
# POST /api/reports
# ---------------------------------------------------------------------------

def test_submit_report_safe(client, make_user, make_event):
    user = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")
    resp = client.post(
        REPORTS,
        json={"eventId": str(event.event_id), "userId": str(user.user_id), "status": "safe"},
        headers=auth_headers(user),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "success"
    assert body["data"]["status"] == "safe"
    assert body["data"]["eventId"] == str(event.event_id)


def test_submit_report_need_help(client, make_user, make_event):
    user = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")
    resp = client.post(
        REPORTS,
        json={
            "eventId": str(event.event_id),
            "userId": str(user.user_id),
            "status": "need_help",
            "comment": "Injured",
            "location": "Building A",
        },
        headers=auth_headers(user),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "need_help"
    assert data["comment"] == "Injured"
    assert data["location"] == "Building A"


def test_submit_report_unknown_event_404(client, make_user):
    user = make_user(email="emp@test.com", role="employee")
    resp = client.post(
        REPORTS,
        json={"eventId": str(uuid.uuid4()), "userId": str(user.user_id), "status": "safe"},
        headers=auth_headers(user),
    )
    assert resp.status_code == 404


def test_submit_report_unknown_user_404(client, make_user, make_event):
    user = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")
    resp = client.post(
        REPORTS,
        json={"eventId": str(event.event_id), "userId": str(uuid.uuid4()), "status": "safe"},
        headers=auth_headers(user),
    )
    assert resp.status_code == 404


def test_submit_report_unauthenticated(client, make_user, make_event):
    user = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")
    resp = client.post(
        REPORTS,
        json={"eventId": str(event.event_id), "userId": str(user.user_id), "status": "safe"},
    )
    assert resp.status_code in (401, 403)


def test_submit_report_invalid_status_422(client, make_user, make_event):
    user = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")
    resp = client.post(
        REPORTS,
        json={"eventId": str(event.event_id), "userId": str(user.user_id), "status": "unknown"},
        headers=auth_headers(user),
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/reports/me
# ---------------------------------------------------------------------------

def test_my_reports_empty(client, make_user):
    user = make_user(email="emp@test.com", role="employee")
    resp = client.get(MY_REPORTS, headers=auth_headers(user))
    assert resp.status_code == 200
    assert resp.json()["reports"] == []


def test_my_reports_after_submit(client, make_user, make_event):
    user = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")
    client.post(
        REPORTS,
        json={"eventId": str(event.event_id), "userId": str(user.user_id), "status": "need_help"},
        headers=auth_headers(user),
    )
    resp = client.get(MY_REPORTS, headers=auth_headers(user))
    assert resp.status_code == 200
    reports = resp.json()["reports"]
    assert len(reports) == 1
    assert reports[0]["status"] == "need_help"


def test_my_reports_isolation(client, make_user, make_event):
    """Two users each only see their own reports."""
    emp1 = make_user(email="emp1@test.com", role="employee")
    emp2 = make_user(email="emp2@test.com", role="employee")
    event = make_event(status="active")

    client.post(
        REPORTS,
        json={"eventId": str(event.event_id), "userId": str(emp1.user_id), "status": "safe"},
        headers=auth_headers(emp1),
    )

    resp1 = client.get(MY_REPORTS, headers=auth_headers(emp1))
    resp2 = client.get(MY_REPORTS, headers=auth_headers(emp2))

    assert len(resp1.json()["reports"]) == 1
    assert resp2.json()["reports"] == []


def test_my_reports_unauthenticated(client):
    resp = client.get(MY_REPORTS)
    assert resp.status_code in (401, 403)
