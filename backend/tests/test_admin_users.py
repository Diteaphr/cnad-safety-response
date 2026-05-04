"""
Integration tests for admin user management:
  GET  /api/admin/users          — list all users (admin only)
  POST /api/admin/users          — create user (admin only)
  PUT  /api/admin/users/{id}     — update user details + roles (admin only)

Key scenarios:
- Only admin can access these endpoints (403 for others)
- Create: sets name, email, phone, department, manager, roles
- Create: rejects duplicate email / employee number
- Update: can change department, manager, and roles
- Update: 404 for non-existent user
"""
from __future__ import annotations

import uuid

import pytest

from tests.conftest import auth_headers

ADMIN_USERS = "/api/admin/users"


def _update_url(user_id) -> str:
    return f"/api/admin/users/{user_id}"


# ---------------------------------------------------------------------------
# GET /api/admin/users
# ---------------------------------------------------------------------------

def test_admin_list_users_returns_all(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    make_user(email="emp1@test.com", role="employee")
    make_user(email="emp2@test.com", role="employee")

    resp = client.get(ADMIN_USERS, headers=auth_headers(admin))

    assert resp.status_code == 200
    emails = {u["email"] for u in resp.json()["users"]}
    assert "emp1@test.com" in emails
    assert "emp2@test.com" in emails


def test_admin_list_users_includes_phone(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    make_user(email="emp@test.com", role="employee", phone="+886912345678")

    resp = client.get(ADMIN_USERS, headers=auth_headers(admin))

    emp = next(u for u in resp.json()["users"] if u["email"] == "emp@test.com")
    assert emp["phone"] == "+886912345678"


def test_admin_list_users_forbidden_for_employee(client, make_user):
    emp = make_user(email="emp@test.com", role="employee")
    resp = client.get(ADMIN_USERS, headers=auth_headers(emp))
    assert resp.status_code == 403


def test_admin_list_users_forbidden_for_supervisor(client, make_user):
    sup = make_user(email="sup@test.com", role="supervisor")
    resp = client.get(ADMIN_USERS, headers=auth_headers(sup))
    assert resp.status_code == 403


def test_admin_list_users_unauthenticated(client):
    resp = client.get(ADMIN_USERS)
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# POST /api/admin/users
# ---------------------------------------------------------------------------

def test_admin_create_user_basic(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.post(
        ADMIN_USERS,
        json={"name": "New Emp", "email": "newemp@test.com", "password": "pass1234"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    user = resp.json()["user"]
    assert user["name"] == "New Emp"
    assert user["email"] == "newemp@test.com"
    assert "employee" in user["roles"]
    assert "password" not in user
    assert "password_hash" not in user


def test_admin_create_user_with_department_and_manager(client, make_user, make_department):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("Engineering")
    manager = make_user(email="mgr@test.com", role="supervisor")

    resp = client.post(
        ADMIN_USERS,
        json={
            "name": "Alice",
            "email": "alice@test.com",
            "password": "pass1234",
            "departmentId": str(dept.department_id),
            "managerId": str(manager.user_id),
            "roles": ["employee"],
        },
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    user = resp.json()["user"]
    assert user["departmentId"] == str(dept.department_id)
    assert user["managerId"] == str(manager.user_id)


def test_admin_create_user_with_admin_role(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.post(
        ADMIN_USERS,
        json={
            "name": "New Admin",
            "email": "newadmin@test.com",
            "password": "pass1234",
            "roles": ["admin"],
        },
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert "admin" in resp.json()["user"]["roles"]


def test_admin_create_user_duplicate_email(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    make_user(email="taken@test.com", role="employee")

    resp = client.post(
        ADMIN_USERS,
        json={"name": "Dup", "email": "taken@test.com", "password": "pass1234"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 409


def test_admin_create_user_invalid_department(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.post(
        ADMIN_USERS,
        json={
            "name": "X",
            "email": "x@test.com",
            "password": "pass1234",
            "departmentId": str(uuid.uuid4()),
        },
        headers=auth_headers(admin),
    )

    assert resp.status_code == 400


def test_admin_create_user_forbidden_for_employee(client, make_user):
    emp = make_user(email="emp@test.com", role="employee")

    resp = client.post(
        ADMIN_USERS,
        json={"name": "X", "email": "x@test.com", "password": "pass1234"},
        headers=auth_headers(emp),
    )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# PUT /api/admin/users/{id}
# ---------------------------------------------------------------------------

def test_admin_update_user_name_and_phone(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    emp = make_user(name="Old", email="emp@test.com", role="employee")

    resp = client.put(
        _update_url(emp.user_id),
        json={"name": "New", "phone": "+886911111111", "roles": ["employee"]},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "New"
    assert body["phone"] == "+886911111111"


def test_admin_update_user_change_department(client, make_user, make_department):
    admin = make_user(email="admin@test.com", role="admin")
    dept = make_department("Sales")
    emp = make_user(email="emp@test.com", role="employee")

    resp = client.put(
        _update_url(emp.user_id),
        json={
            "name": emp.name,
            "roles": ["employee"],
            "departmentId": str(dept.department_id),
        },
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["departmentId"] == str(dept.department_id)


def test_admin_update_user_change_roles(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    emp = make_user(email="emp@test.com", role="employee")

    resp = client.put(
        _update_url(emp.user_id),
        json={"name": emp.name, "roles": ["employee", "supervisor"]},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    roles = set(resp.json()["roles"])
    assert roles == {"employee", "supervisor"}


def test_admin_update_user_not_found(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.put(
        _update_url(uuid.uuid4()),
        json={"name": "X", "roles": ["employee"]},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 404


def test_admin_update_user_forbidden_for_employee(client, make_user):
    emp = make_user(email="emp@test.com", role="employee")
    other = make_user(email="other@test.com", role="employee")

    resp = client.put(
        _update_url(other.user_id),
        json={"name": "Hacked", "roles": ["admin"]},
        headers=auth_headers(emp),
    )

    assert resp.status_code == 403


def test_admin_update_user_invalid_manager(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    emp = make_user(email="emp@test.com", role="employee")

    resp = client.put(
        _update_url(emp.user_id),
        json={
            "name": emp.name,
            "roles": ["employee"],
            "managerId": str(uuid.uuid4()),
        },
        headers=auth_headers(admin),
    )

    assert resp.status_code == 400
