"""
Integration tests for:
  POST /api/events/{event_id}/reminders

Requires: supervisor role, active event.
Skips users whose latest report status is "safe".
Idempotent: second call does not re-send if notification already "sent".
"""
from __future__ import annotations

import uuid

import pytest

from tests.conftest import auth_headers

REPORTS = "/api/reports"


def _reminders_url(event_id) -> str:
    return f"/api/events/{event_id}/reminders"


# ---------------------------------------------------------------------------
# Happy paths
# ---------------------------------------------------------------------------

def test_reminders_sends_to_pending_team(client, make_user, make_event):
    sup = make_user(email="sup@test.com", role="supervisor")
    emp = make_user(email="emp@test.com", role="employee", manager_id=sup.user_id)
    event = make_event(status="active")

    resp = client.post(_reminders_url(event.event_id), headers=auth_headers(sup))

    assert resp.status_code == 200
    body = resp.json()
    assert body["sent"] == 1
    assert body["already_safe"] == 0
    assert body["total_team"] == 1


def test_reminders_skips_safe_respondents(client, make_user, make_event):
    sup = make_user(email="sup@test.com", role="supervisor")
    emp = make_user(email="emp@test.com", role="employee", manager_id=sup.user_id)
    event = make_event(status="active")

    # emp reports safe first
    client.post(
        REPORTS,
        json={"eventId": str(event.event_id), "userId": str(emp.user_id), "status": "safe"},
        headers=auth_headers(emp),
    )

    resp = client.post(_reminders_url(event.event_id), headers=auth_headers(sup))
    assert resp.status_code == 200
    body = resp.json()
    assert body["sent"] == 0
    assert body["already_safe"] == 1
    assert body["total_team"] == 1


def test_reminders_sends_to_need_help_respondents(client, make_user, make_event):
    sup = make_user(email="sup@test.com", role="supervisor")
    emp = make_user(email="emp@test.com", role="employee", manager_id=sup.user_id)
    event = make_event(status="active")

    # emp reported "need_help" — should still receive reminder
    client.post(
        REPORTS,
        json={"eventId": str(event.event_id), "userId": str(emp.user_id), "status": "need_help"},
        headers=auth_headers(emp),
    )

    resp = client.post(_reminders_url(event.event_id), headers=auth_headers(sup))
    assert resp.status_code == 200
    assert resp.json()["sent"] == 1
    assert resp.json()["already_safe"] == 0


def test_reminders_no_subordinates(client, make_user, make_event):
    sup = make_user(email="sup@test.com", role="supervisor")
    event = make_event(status="active")

    resp = client.post(_reminders_url(event.event_id), headers=auth_headers(sup))
    assert resp.status_code == 200
    body = resp.json()
    assert body["sent"] == 0
    assert body["total_team"] == 0


def test_reminders_multiple_team_members(client, make_user, make_event):
    sup = make_user(email="sup@test.com", role="supervisor")
    emp1 = make_user(email="emp1@test.com", role="employee", manager_id=sup.user_id)
    emp2 = make_user(email="emp2@test.com", role="employee", manager_id=sup.user_id)
    emp3 = make_user(email="emp3@test.com", role="employee", manager_id=sup.user_id)
    event = make_event(status="active")

    # emp1 reports safe, emp2 reports need_help, emp3 is pending
    client.post(
        REPORTS,
        json={"eventId": str(event.event_id), "userId": str(emp1.user_id), "status": "safe"},
        headers=auth_headers(emp1),
    )
    client.post(
        REPORTS,
        json={"eventId": str(event.event_id), "userId": str(emp2.user_id), "status": "need_help"},
        headers=auth_headers(emp2),
    )

    resp = client.post(_reminders_url(event.event_id), headers=auth_headers(sup))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_team"] == 3
    assert body["already_safe"] == 1
    assert body["sent"] == 2  # emp2 (need_help) + emp3 (pending)


def test_reminders_idempotent(client, make_user, make_event):
    """Second call re-uses the existing notification row without crashing."""
    sup = make_user(email="sup@test.com", role="supervisor")
    _emp = make_user(email="emp@test.com", role="employee", manager_id=sup.user_id)
    event = make_event(status="active")

    r1 = client.post(_reminders_url(event.event_id), headers=auth_headers(sup))
    r2 = client.post(_reminders_url(event.event_id), headers=auth_headers(sup))

    assert r1.status_code == 200
    assert r2.status_code == 200
    # Both calls count emp as "sent" (notification exists but employee isn't "safe")
    assert r1.json()["sent"] == 1
    assert r2.json()["sent"] == 1


# ---------------------------------------------------------------------------
# Error / permission cases
# ---------------------------------------------------------------------------

def test_reminders_employee_role_403(client, make_user, make_event):
    emp = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")

    resp = client.post(_reminders_url(event.event_id), headers=auth_headers(emp))
    assert resp.status_code == 403


def test_reminders_draft_event_400(client, make_user, make_event):
    sup = make_user(email="sup@test.com", role="supervisor")
    event = make_event(status="draft")

    resp = client.post(_reminders_url(event.event_id), headers=auth_headers(sup))
    assert resp.status_code == 400


def test_reminders_closed_event_400(client, make_user, make_event):
    sup = make_user(email="sup@test.com", role="supervisor")
    event = make_event(status="closed")

    resp = client.post(_reminders_url(event.event_id), headers=auth_headers(sup))
    assert resp.status_code == 400


def test_reminders_event_not_found_404(client, make_user):
    sup = make_user(email="sup@test.com", role="supervisor")

    resp = client.post(_reminders_url(uuid.uuid4()), headers=auth_headers(sup))
    assert resp.status_code == 404


def test_reminders_unauthenticated(client, make_event):
    event = make_event(status="active")
    resp = client.post(_reminders_url(event.event_id))
    assert resp.status_code in (401, 403)
