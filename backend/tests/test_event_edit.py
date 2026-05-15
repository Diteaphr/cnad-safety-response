"""
Integration tests for active event editing:
  PUT /api/events/{event_id} — update an active event (admin only)

Key scenarios:
- Admin can edit title, type, description, startAt on active events
- Closed events return 409
- targetDepartmentIds in the body is ignored; API always returns [] (company-wide)
- 404 for non-existent event
- 403 for non-admin
- Unknown event type returns 400
"""
from __future__ import annotations

import uuid

import pytest

from tests.conftest import auth_headers


def _update_url(event_id) -> str:
    return f"/api/events/{event_id}"


def _base_payload() -> dict:
    return {
        "title": "Updated Title",
        "type": "Typhoon",
        "description": "Updated description",
        "startAt": "2026-06-01T09:00:00Z",
        "targetDepartmentIds": [],
    }


def test_update_active_event_title(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("R&D")
    event = make_event(status="active", created_by=admin.user_id)

    resp = client.put(
        _update_url(event.event_id),
        json={**_base_payload(), "title": "New Title"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["event"]["title"] == "New Title"
    assert resp.json()["event"]["targetDepartmentIds"] == []


def test_update_active_event_description(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("R&D")
    event = make_event(status="active", created_by=admin.user_id)

    resp = client.put(
        _update_url(event.event_id),
        json={**_base_payload(), "description": "New desc"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["event"]["description"] == "New desc"


def test_update_active_event_target_department_ids_ignored(client, make_user, make_department, make_event):
    """Payload may send department IDs; response is always company-wide (empty list)."""
    admin = make_user(email="admin@test.com", role="admin")
    dept_a = make_department("Dept A")
    dept_b = make_department("Dept B")
    event = make_event(status="active", created_by=admin.user_id)

    resp = client.put(
        _update_url(event.event_id),
        json={
            **_base_payload(),
            "targetDepartmentIds": [str(dept_a.department_id), str(dept_b.department_id)],
        },
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["event"]["targetDepartmentIds"] == []


def test_update_active_event_type(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("R&D")
    event = make_event(status="active", event_type="Earthquake", created_by=admin.user_id)

    resp = client.put(
        _update_url(event.event_id),
        json={**_base_payload(), "type": "Fire"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["event"]["type"] == "Fire"


def test_update_closed_event_returns_409(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("R&D")
    event = make_event(status="closed", created_by=admin.user_id)

    resp = client.put(
        _update_url(event.event_id),
        json=_base_payload(),
        headers=auth_headers(admin),
    )

    assert resp.status_code == 409


def test_update_event_not_found(client, make_user, make_department):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("R&D")

    resp = client.put(
        _update_url(uuid.uuid4()),
        json=_base_payload(),
        headers=auth_headers(admin),
    )

    assert resp.status_code == 404


def test_update_event_unknown_type(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("R&D")
    event = make_event(status="active", created_by=admin.user_id)

    resp = client.put(
        _update_url(event.event_id),
        json={**_base_payload(), "type": "NonExistentType"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 400


def test_update_event_forbidden_for_employee(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    emp = make_user(email="emp@test.com", role="employee")
    dept = make_department("R&D")
    event = make_event(status="active", created_by=admin.user_id)

    resp = client.put(
        _update_url(event.event_id),
        json=_base_payload(),
        headers=auth_headers(emp),
    )

    assert resp.status_code == 403


def test_update_event_forbidden_for_supervisor(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    sup = make_user(email="sup@test.com", role="supervisor")
    dept = make_department("R&D")
    event = make_event(status="active", created_by=admin.user_id)

    resp = client.put(
        _update_url(event.event_id),
        json=_base_payload(),
        headers=auth_headers(sup),
    )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# location / venue field
# ---------------------------------------------------------------------------

def test_create_event_with_location(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.post(
        "/api/events",
        json={**_base_payload(), "location": "台北總部 3F"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["event"]["venue"] == "台北總部 3F"


def test_create_event_without_location_returns_null(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.post(
        "/api/events",
        json=_base_payload(),
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["event"]["venue"] is None


def test_update_event_location(client, make_user, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    event = make_event(status="active", created_by=admin.user_id)

    resp = client.put(
        _update_url(event.event_id),
        json={**_base_payload(), "location": "高雄分部 B1"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["event"]["venue"] == "高雄分部 B1"
