"""
Integration tests for account deactivation / reactivation:
  PUT /api/admin/users/{id}/deactivate — deactivate account (admin only)
  PUT /api/admin/users/{id}/activate   — reactivate account (admin only)
"""
from __future__ import annotations

import uuid

from tests.conftest import auth_headers

LOGIN = "/api/auth/login"


def _deactivate_url(user_id) -> str:
    return f"/api/admin/users/{user_id}/deactivate"


def _activate_url(user_id) -> str:
    return f"/api/admin/users/{user_id}/activate"


# ---------------------------------------------------------------------------
# Deactivate
# ---------------------------------------------------------------------------

def test_deactivate_user_success(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    emp = make_user(email="emp@test.com", role="employee")

    resp = client.put(_deactivate_url(emp.user_id), headers=auth_headers(admin))

    assert resp.status_code == 200
    assert "deactivated" in resp.json()["message"]


def test_deactivated_user_cannot_login(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    emp = make_user(email="emp@test.com", role="employee", password="pass1234")

    client.put(_deactivate_url(emp.user_id), headers=auth_headers(admin))

    resp = client.post(LOGIN, json={"email": "emp@test.com", "password": "pass1234"})
    assert resp.status_code == 403


def test_deactivate_already_inactive_returns_409(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    emp = make_user(email="emp@test.com", role="employee")

    client.put(_deactivate_url(emp.user_id), headers=auth_headers(admin))
    resp = client.put(_deactivate_url(emp.user_id), headers=auth_headers(admin))

    assert resp.status_code == 409


def test_admin_cannot_deactivate_own_account(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.put(_deactivate_url(admin.user_id), headers=auth_headers(admin))

    assert resp.status_code == 400


def test_deactivate_not_found(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.put(_deactivate_url(uuid.uuid4()), headers=auth_headers(admin))

    assert resp.status_code == 404


def test_deactivate_forbidden_for_employee(client, make_user):
    emp = make_user(email="emp@test.com", role="employee")
    other = make_user(email="other@test.com", role="employee")

    resp = client.put(_deactivate_url(other.user_id), headers=auth_headers(emp))

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Activate (reactivate)
# ---------------------------------------------------------------------------

def test_activate_user_success(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    emp = make_user(email="emp@test.com", role="employee")
    client.put(_deactivate_url(emp.user_id), headers=auth_headers(admin))

    resp = client.put(_activate_url(emp.user_id), headers=auth_headers(admin))

    assert resp.status_code == 200
    assert "activated" in resp.json()["message"]


def test_reactivated_user_can_login(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    emp = make_user(email="emp@test.com", role="employee", password="pass1234")
    client.put(_deactivate_url(emp.user_id), headers=auth_headers(admin))
    client.put(_activate_url(emp.user_id), headers=auth_headers(admin))

    resp = client.post(LOGIN, json={"email": "emp@test.com", "password": "pass1234"})
    assert resp.status_code == 200


def test_activate_already_active_returns_409(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    emp = make_user(email="emp@test.com", role="employee")

    resp = client.put(_activate_url(emp.user_id), headers=auth_headers(admin))

    assert resp.status_code == 409


def test_activate_not_found(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.put(_activate_url(uuid.uuid4()), headers=auth_headers(admin))

    assert resp.status_code == 404


def test_activate_forbidden_for_employee(client, make_user):
    emp = make_user(email="emp@test.com", role="employee")
    other = make_user(email="other@test.com", role="employee")

    resp = client.put(_activate_url(other.user_id), headers=auth_headers(emp))

    assert resp.status_code == 403
