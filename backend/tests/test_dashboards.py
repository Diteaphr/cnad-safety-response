"""
Integration tests for:
  GET /api/dashboard/supervisor?event_id=...
  GET /api/dashboard/admin?event_id=...

Key scenarios:
- With event_id → returns data for that specific event
- Without event_id → falls back to most recent active event
- Wrong role → 403
- Non-existent event_id → 404
"""
from __future__ import annotations

import pytest

from tests.conftest import auth_headers

SUP_DASH = "/api/dashboard/supervisor"
ADM_DASH = "/api/dashboard/admin"
REPORTS = "/api/reports"


# ---------------------------------------------------------------------------
# Supervisor dashboard
# ---------------------------------------------------------------------------

def test_supervisor_dashboard_with_event_id(client, make_user, make_event):
    sup = make_user(email="sup@test.com", role="supervisor")
    event = make_event(title="Target Event", status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["event"]["id"] == str(event.event_id)
    assert body["event"]["title"] == "Target Event"


def test_supervisor_dashboard_event_id_overrides_latest(client, make_user, make_event):
    """When event_id is given, dashboard must use that event even if another is newer."""
    sup = make_user(email="sup@test.com", role="supervisor")
    older_event = make_event(title="Older Event", status="active")
    newer_event = make_event(title="Newer Event", status="active")

    # Without event_id → newest active event (newer_event)
    resp_default = client.get(SUP_DASH, headers=auth_headers(sup))
    assert resp_default.json()["event"]["title"] == "Newer Event"

    # With event_id → the specific older event
    resp_specific = client.get(
        SUP_DASH,
        params={"event_id": str(older_event.event_id)},
        headers=auth_headers(sup),
    )
    assert resp_specific.json()["event"]["id"] == str(older_event.event_id)
    assert resp_specific.json()["event"]["title"] == "Older Event"


def test_supervisor_dashboard_without_event_id_uses_latest_active(client, make_user, make_event):
    sup = make_user(email="sup@test.com", role="supervisor")
    make_event(title="Old Event", status="closed")
    make_event(title="Active Event", status="active")

    resp = client.get(SUP_DASH, headers=auth_headers(sup))
    assert resp.status_code == 200
    assert resp.json()["event"]["title"] == "Active Event"


def test_supervisor_dashboard_no_active_event(client, make_user, make_event):
    sup = make_user(email="sup@test.com", role="supervisor")
    make_event(status="closed")

    resp = client.get(SUP_DASH, headers=auth_headers(sup))
    assert resp.status_code == 200
    assert resp.json()["event"] is None


def test_supervisor_dashboard_event_id_not_found_404(client, make_user):
    import uuid
    sup = make_user(email="sup@test.com", role="supervisor")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(uuid.uuid4())},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 404


def test_supervisor_dashboard_employee_role_403(client, make_user, make_event):
    emp = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(emp),
    )
    assert resp.status_code == 403


def test_supervisor_dashboard_shows_team_reports(client, make_user, make_event):
    """KPIs reflect subordinates' actual report status."""
    sup = make_user(email="sup@test.com", role="supervisor")
    emp = make_user(email="emp@test.com", role="employee", manager_id=sup.user_id)
    event = make_event(status="active")

    client.post(
        REPORTS,
        json={"eventId": str(event.event_id), "userId": str(emp.user_id), "status": "safe"},
        headers=auth_headers(emp),
    )

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["kpis"]["safe"] == 1
    assert body["kpis"]["pending"] == 0
    assert len(body["team"]) == 1
    assert body["team"][0]["status"] == "safe"


# ---------------------------------------------------------------------------
# Admin dashboard
# ---------------------------------------------------------------------------

def test_admin_dashboard_with_event_id(client, make_user, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    event = make_event(title="Admin Target", status="active")

    resp = client.get(
        ADM_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["event"]["id"] == str(event.event_id)
    assert body["event"]["title"] == "Admin Target"


def test_admin_dashboard_event_id_overrides_latest(client, make_user, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    older_event = make_event(title="Older", status="active")
    _newer_event = make_event(title="Newer", status="active")

    resp = client.get(
        ADM_DASH,
        params={"event_id": str(older_event.event_id)},
        headers=auth_headers(admin),
    )
    assert resp.json()["event"]["id"] == str(older_event.event_id)


def test_admin_dashboard_event_id_not_found_404(client, make_user):
    import uuid
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.get(
        ADM_DASH,
        params={"event_id": str(uuid.uuid4())},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 404


def test_admin_dashboard_employee_role_403(client, make_user, make_event):
    emp = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")

    resp = client.get(
        ADM_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(emp),
    )
    assert resp.status_code == 403


def test_admin_dashboard_unauthenticated(client):
    resp = client.get(ADM_DASH)
    assert resp.status_code in (401, 403)
