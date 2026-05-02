"""
Integration tests for:
  GET /api/notifications/me

Notifications are created by the reminders flow (POST /api/events/{id}/reminders).
Each user only sees their own notifications.
"""
from __future__ import annotations

import pytest

from tests.conftest import auth_headers

NOTIFICATIONS_ME = "/api/notifications/me"


def _reminders_url(event_id) -> str:
    return f"/api/events/{event_id}/reminders"


# ---------------------------------------------------------------------------
# Basic cases
# ---------------------------------------------------------------------------

def test_notifications_empty_initially(client, make_user):
    user = make_user(email="emp@test.com", role="employee")
    resp = client.get(NOTIFICATIONS_ME, headers=auth_headers(user))
    assert resp.status_code == 200
    assert resp.json()["notifications"] == []


def test_notifications_appear_after_reminder(client, make_user, make_event):
    sup = make_user(email="sup@test.com", role="supervisor")
    emp = make_user(email="emp@test.com", role="employee", manager_id=sup.user_id)
    event = make_event(status="active")

    client.post(_reminders_url(event.event_id), headers=auth_headers(sup))

    resp = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp))
    assert resp.status_code == 200
    notifs = resp.json()["notifications"]
    assert len(notifs) == 1
    n = notifs[0]
    assert n["channel"] == "fcm_reminder"
    assert n["status"] == "sent"
    assert n["eventId"] == str(event.event_id)
    assert n["sentAt"] is not None


def test_notifications_only_own(client, make_user, make_event):
    """Each team member sees only their own notification."""
    sup = make_user(email="sup@test.com", role="supervisor")
    emp1 = make_user(email="emp1@test.com", role="employee", manager_id=sup.user_id)
    emp2 = make_user(email="emp2@test.com", role="employee", manager_id=sup.user_id)
    event = make_event(status="active")

    client.post(_reminders_url(event.event_id), headers=auth_headers(sup))

    resp1 = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp1))
    resp2 = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp2))

    notifs1 = resp1.json()["notifications"]
    notifs2 = resp2.json()["notifications"]
    assert len(notifs1) == 1
    assert len(notifs2) == 1
    assert notifs1[0]["id"] != notifs2[0]["id"]


def test_supervisor_has_no_notifications(client, make_user, make_event):
    """Supervisor sends reminders but does not receive them themselves."""
    sup = make_user(email="sup@test.com", role="supervisor")
    _emp = make_user(email="emp@test.com", role="employee", manager_id=sup.user_id)
    event = make_event(status="active")

    client.post(_reminders_url(event.event_id), headers=auth_headers(sup))

    resp = client.get(NOTIFICATIONS_ME, headers=auth_headers(sup))
    assert resp.status_code == 200
    assert resp.json()["notifications"] == []


def test_notifications_idempotent_second_reminder(client, make_user, make_event):
    """Sending reminders twice does not duplicate the notification row."""
    sup = make_user(email="sup@test.com", role="supervisor")
    emp = make_user(email="emp@test.com", role="employee", manager_id=sup.user_id)
    event = make_event(status="active")

    client.post(_reminders_url(event.event_id), headers=auth_headers(sup))
    client.post(_reminders_url(event.event_id), headers=auth_headers(sup))

    resp = client.get(NOTIFICATIONS_ME, headers=auth_headers(emp))
    assert resp.status_code == 200
    # Idempotency: still exactly one notification record
    assert len(resp.json()["notifications"]) == 1


def test_notifications_unauthenticated(client):
    resp = client.get(NOTIFICATIONS_ME)
    assert resp.status_code in (401, 403)
