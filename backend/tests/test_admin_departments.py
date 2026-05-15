"""
Integration tests for admin department management:
  POST   /api/admin/departments          — create department (admin only)
  PUT    /api/admin/departments/{id}     — update department (admin only)
  DELETE /api/admin/departments/{id}     — delete department (admin only)

Key scenarios:
- Only admin can access these endpoints (403 for others)
- Create: sets name and optional parentId
- Create: rejects non-existent parentId
- Update: can rename and re-parent
- Update: 404 for non-existent department
- Update: 400 if department set as its own parent
- Delete: succeeds when department is empty
- Delete: 409 when department has members
- Delete: 409 when department has sub-departments
- Delete: 404 for non-existent department
"""
from __future__ import annotations

import uuid

import pytest

from tests.conftest import auth_headers

ADMIN_DEPTS = "/api/admin/departments"


def _update_url(dept_id) -> str:
    return f"/api/admin/departments/{dept_id}"


def _delete_url(dept_id) -> str:
    return f"/api/admin/departments/{dept_id}"


# ---------------------------------------------------------------------------
# POST /api/admin/departments
# ---------------------------------------------------------------------------

def test_admin_create_department_basic(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.post(
        ADMIN_DEPTS,
        json={"name": "Engineering"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Engineering"
    assert body["parentId"] is None
    assert "id" in body


def test_admin_create_department_with_parent(client, make_user, make_department):
    admin = make_user(email="admin@test.com", role="admin")
    parent = make_department("Operations")

    resp = client.post(
        ADMIN_DEPTS,
        json={"name": "Plant B", "parentId": str(parent.department_id)},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["parentId"] == str(parent.department_id)


def test_admin_create_department_invalid_parent(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.post(
        ADMIN_DEPTS,
        json={"name": "Ghost Dept", "parentId": str(uuid.uuid4())},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 400


def test_admin_create_department_forbidden_for_employee(client, make_user):
    emp = make_user(email="emp@test.com", role="employee")

    resp = client.post(
        ADMIN_DEPTS,
        json={"name": "New Dept"},
        headers=auth_headers(emp),
    )

    assert resp.status_code == 403


def test_admin_create_department_forbidden_for_supervisor(client, make_user):
    sup = make_user(email="sup@test.com", role="supervisor")

    resp = client.post(
        ADMIN_DEPTS,
        json={"name": "New Dept"},
        headers=auth_headers(sup),
    )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# PUT /api/admin/departments/{id}
# ---------------------------------------------------------------------------

def test_admin_update_department_rename(client, make_user, make_department):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("Old Name")

    resp = client.put(
        _update_url(dept.department_id),
        json={"name": "New Name"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


def test_admin_update_department_set_parent(client, make_user, make_department):
    admin = make_user(email="admin@test.com", role="admin")
    parent = make_department("Parent")
    child = make_department("Child")

    resp = client.put(
        _update_url(child.department_id),
        json={"name": "Child", "parentId": str(parent.department_id)},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["parentId"] == str(parent.department_id)


def test_admin_update_department_remove_parent(client, make_user, make_department):
    admin = make_user(email="admin@test.com", role="admin")
    parent = make_department("Parent")
    child = make_department("Child")
    # First set parent
    client.put(
        _update_url(child.department_id),
        json={"name": "Child", "parentId": str(parent.department_id)},
        headers=auth_headers(admin),
    )
    # Then remove parent
    resp = client.put(
        _update_url(child.department_id),
        json={"name": "Child"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["parentId"] is None


def test_admin_update_department_self_parent(client, make_user, make_department):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("Engineering")

    resp = client.put(
        _update_url(dept.department_id),
        json={"name": "Engineering", "parentId": str(dept.department_id)},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 400


def test_admin_update_department_not_found(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.put(
        _update_url(uuid.uuid4()),
        json={"name": "X"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 404


def test_admin_update_department_forbidden_for_employee(client, make_user, make_department):
    emp = make_user(email="emp@test.com", role="employee")
    dept = make_department("Engineering")

    resp = client.put(
        _update_url(dept.department_id),
        json={"name": "Hacked"},
        headers=auth_headers(emp),
    )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# DELETE /api/admin/departments/{id}
# ---------------------------------------------------------------------------

def test_admin_delete_department_success(client, make_user, make_department):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("Empty Dept")

    resp = client.delete(_delete_url(dept.department_id), headers=auth_headers(admin))

    assert resp.status_code == 200
    assert "deleted" in resp.json()["message"]


def test_admin_delete_department_with_members(client, make_user, make_department):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("Engineering")
    make_user(email="emp@test.com", role="employee", department_id=dept.department_id)

    resp = client.delete(_delete_url(dept.department_id), headers=auth_headers(admin))

    assert resp.status_code == 409


def test_admin_delete_department_with_sub_departments(client, make_user, make_department):
    admin = make_user(email="admin@test.com", role="admin")
    parent = make_department("Parent")
    # Create sub-department via API so parentId is set
    client.post(
        ADMIN_DEPTS,
        json={"name": "Child", "parentId": str(parent.department_id)},
        headers=auth_headers(admin),
    )

    resp = client.delete(_delete_url(parent.department_id), headers=auth_headers(admin))

    assert resp.status_code == 409


def test_admin_delete_department_not_found(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.delete(_delete_url(uuid.uuid4()), headers=auth_headers(admin))

    assert resp.status_code == 404


def test_admin_delete_department_forbidden_for_employee(client, make_user, make_department):
    emp = make_user(email="emp@test.com", role="employee")
    dept = make_department("Engineering")

    resp = client.delete(_delete_url(dept.department_id), headers=auth_headers(emp))

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/departments — managerId in response
# ---------------------------------------------------------------------------

def test_list_departments_includes_manager_id(client, make_user, make_department):
    emp = make_user(email="emp@test.com", role="employee")
    sup = make_user(email="sup@test.com", role="supervisor")
    dept = make_department("Engineering")
    dept.manager_id = sup.user_id
    from sqlalchemy.orm import Session
    # update via fixture db is not accessible here; use API instead
    admin = make_user(email="admin@test.com", role="admin")
    client.put(
        f"/api/admin/departments/{dept.department_id}",
        json={"name": "Engineering", "managerId": str(sup.user_id)},
        headers=auth_headers(admin),
    )

    resp = client.get("/api/departments", headers=auth_headers(emp))

    assert resp.status_code == 200
    depts = resp.json()["departments"]
    target = next(d for d in depts if d["id"] == str(dept.department_id))
    assert target["managerId"] == str(sup.user_id)


def test_list_departments_manager_id_null_when_unset(client, make_user, make_department):
    emp = make_user(email="emp@test.com", role="employee")
    make_department("No Manager Dept")

    resp = client.get("/api/departments", headers=auth_headers(emp))

    assert resp.status_code == 200
    depts = resp.json()["departments"]
    target = next(d for d in depts if d["name"] == "No Manager Dept")
    assert target["managerId"] is None
