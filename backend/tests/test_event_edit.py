"""
Integration tests for draft event editing:
  PUT /api/events/{event_id} — update a draft event (admin only)

Key scenarios:
- Admin can edit title, type, description, startAt, targetDepartmentIds
- Only draft events can be edited (409 for active/closed)
- 404 for non-existent event
- 403 for non-admin
- Departments are fully replaced on update
- Unknown event type returns 400
"""
from __future__ import annotations

import uuid

import pytest

from tests.conftest import auth_headers


def _update_url(event_id) -> str:
    return f"/api/events/{event_id}"


def _base_payload(dept_id: str) -> dict:
    return {
        "title": "Updated Title",
        "type": "Typhoon",
        "description": "Updated description",
        "startAt": "2026-06-01T09:00:00Z",
        "targetDepartmentIds": [dept_id],
    }


# ---------------------------------------------------------------------------
# Successful edits
# ---------------------------------------------------------------------------

def test_update_draft_event_title(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("R&D")
    event = make_event(status="draft", created_by=admin.user_id, department_ids=[dept.department_id])

    resp = client.put(
        _update_url(event.event_id),
        json={**_base_payload(str(dept.department_id)), "title": "New Title"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["event"]["title"] == "New Title"


def test_update_draft_event_description(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("R&D")
    event = make_event(status="draft", created_by=admin.user_id, department_ids=[dept.department_id])

    resp = client.put(
        _update_url(event.event_id),
        json={**_base_payload(str(dept.department_id)), "description": "New desc"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["event"]["description"] == "New desc"


def test_update_draft_event_replaces_departments(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    dept_a = make_department("Dept A")
    dept_b = make_department("Dept B")
    event = make_event(status="draft", created_by=admin.user_id, department_ids=[dept_a.department_id])

    resp = client.put(
        _update_url(event.event_id),
        json={**_base_payload(str(dept_a.department_id)), "targetDepartmentIds": [str(dept_b.department_id)]},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    dept_ids = resp.json()["event"]["targetDepartmentIds"]
    assert str(dept_b.department_id) in dept_ids
    assert str(dept_a.department_id) not in dept_ids


def test_update_draft_event_type(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("R&D")
    event = make_event(
        status="draft", event_type="Earthquake",
        created_by=admin.user_id, department_ids=[dept.department_id]
    )

    resp = client.put(
        _update_url(event.event_id),
        json={**_base_payload(str(dept.department_id)), "type": "Fire"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["event"]["type"] == "Fire"


# ---------------------------------------------------------------------------
# Status restrictions
# ---------------------------------------------------------------------------

def test_update_active_event_returns_409(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("R&D")
    event = make_event(status="active", created_by=admin.user_id, department_ids=[dept.department_id])

    resp = client.put(
        _update_url(event.event_id),
        json=_base_payload(str(dept.department_id)),
        headers=auth_headers(admin),
    )

    assert resp.status_code == 409


def test_update_closed_event_returns_409(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("R&D")
    event = make_event(status="closed", created_by=admin.user_id, department_ids=[dept.department_id])

    resp = client.put(
        _update_url(event.event_id),
        json=_base_payload(str(dept.department_id)),
        headers=auth_headers(admin),
    )

    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# Error cases
# ---------------------------------------------------------------------------

def test_update_event_not_found(client, make_user, make_department):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("R&D")

    resp = client.put(
        _update_url(uuid.uuid4()),
        json=_base_payload(str(dept.department_id)),
        headers=auth_headers(admin),
    )

    assert resp.status_code == 404


def test_update_event_unknown_type(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("R&D")
    event = make_event(status="draft", created_by=admin.user_id, department_ids=[dept.department_id])

    resp = client.put(
        _update_url(event.event_id),
        json={**_base_payload(str(dept.department_id)), "type": "NonExistentType"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 400


def test_update_event_forbidden_for_employee(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    emp = make_user(email="emp@test.com", role="employee")
    dept = make_department("R&D")
    event = make_event(status="draft", created_by=admin.user_id, department_ids=[dept.department_id])

    resp = client.put(
        _update_url(event.event_id),
        json=_base_payload(str(dept.department_id)),
        headers=auth_headers(emp),
    )

    assert resp.status_code == 403


def test_update_event_forbidden_for_supervisor(client, make_user, make_department, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    sup = make_user(email="sup@test.com", role="supervisor")
    dept = make_department("R&D")
    event = make_event(status="draft", created_by=admin.user_id, department_ids=[dept.department_id])

    resp = client.put(
        _update_url(event.event_id),
        json=_base_payload(str(dept.department_id)),
        headers=auth_headers(sup),
    )

    assert resp.status_code == 403
