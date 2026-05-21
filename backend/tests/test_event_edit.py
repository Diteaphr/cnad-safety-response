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


def test_update_event_stores_target_department_ids(client, make_user, make_department, make_event):
    """targetDepartmentIds in the PUT body is stored and returned in the response."""
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
    returned_ids = set(resp.json()["event"]["targetDepartmentIds"])
    assert str(dept_a.department_id) in returned_ids
    assert str(dept_b.department_id) in returned_ids


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


# ---------------------------------------------------------------------------
# targetDepartmentIds — create / update / subtree expansion
# ---------------------------------------------------------------------------

def test_create_event_with_no_target_depts_is_company_wide(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.post(
        "/api/events",
        json=_base_payload(),
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["event"]["targetDepartmentIds"] == []


def test_create_event_stores_target_department_ids(client, make_user, make_department):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("Engineering")

    resp = client.post(
        "/api/events",
        json={**_base_payload(), "targetDepartmentIds": [str(dept.department_id)]},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert str(dept.department_id) in resp.json()["event"]["targetDepartmentIds"]


def test_create_event_target_dept_auto_expands_children(client, make_user, make_department):
    """Selecting a parent department automatically includes its child in the response."""
    admin = make_user(email="admin@test.com", role="admin")
    parent = make_department("R&D")
    child = make_department("Frontend", parent_id=parent.department_id)

    resp = client.post(
        "/api/events",
        json={**_base_payload(), "targetDepartmentIds": [str(parent.department_id)]},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    returned_ids = set(resp.json()["event"]["targetDepartmentIds"])
    assert str(parent.department_id) in returned_ids
    assert str(child.department_id) in returned_ids


def test_create_event_nonexistent_dept_returns_400(client, make_user):
    import uuid as _uuid
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.post(
        "/api/events",
        json={**_base_payload(), "targetDepartmentIds": [str(_uuid.uuid4())]},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 400


def test_update_event_to_company_wide_clears_target_depts(client, make_user, make_department, make_event):
    """PUT with empty targetDepartmentIds clears existing targeting."""
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("Ops")
    event = make_event(
        status="active",
        created_by=admin.user_id,
        target_department_ids=[dept.department_id],
    )

    resp = client.put(
        _update_url(event.event_id),
        json={**_base_payload(), "targetDepartmentIds": []},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["event"]["targetDepartmentIds"] == []
