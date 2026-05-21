"""
Integration tests for password management:
  PUT  /api/users/me/password              — change own password
  POST /api/admin/users/{id}/reset-password — admin resets to default
"""
from __future__ import annotations

import pytest

from tests.conftest import auth_headers

ME_PASSWORD = "/api/users/me/password"


def _reset_url(user_id) -> str:
    return f"/api/admin/users/{user_id}/reset-password"


# ---------------------------------------------------------------------------
# PUT /api/users/me/password
# ---------------------------------------------------------------------------

def test_change_password_success(client, make_user):
    user = make_user(email="emp@test.com", role="employee", password="oldpass1")

    resp = client.put(
        ME_PASSWORD,
        json={"currentPassword": "oldpass1", "newPassword": "newpass99"},
        headers=auth_headers(user),
    )

    assert resp.status_code == 200
    assert "successfully" in resp.json()["message"]


def test_change_password_can_login_with_new(client, make_user):
    make_user(email="emp@test.com", role="employee", password="oldpass1")

    client.put(
        ME_PASSWORD,
        json={"currentPassword": "oldpass1", "newPassword": "newpass99"},
        headers=auth_headers(make_user(email="emp2@test.com", role="employee", password="oldpass1")),
    )

    # Use a fresh user to test the login flow directly
    user = make_user(email="changer@test.com", role="employee", password="myoldpw1")
    client.put(
        ME_PASSWORD,
        json={"currentPassword": "myoldpw1", "newPassword": "mynewpw99"},
        headers=auth_headers(user),
    )
    resp = client.post(
        "/api/auth/login",
        json={"email": "changer@test.com", "password": "mynewpw99"},
    )
    assert resp.status_code == 200


def test_change_password_wrong_current(client, make_user):
    user = make_user(email="emp@test.com", role="employee", password="correct1")

    resp = client.put(
        ME_PASSWORD,
        json={"currentPassword": "wrongpass", "newPassword": "newpass99"},
        headers=auth_headers(user),
    )

    assert resp.status_code == 400


def test_change_password_no_existing_password(client, make_user):
    """Users seeded without a password_hash cannot use this endpoint."""
    user = make_user(email="emp@test.com", role="employee")

    resp = client.put(
        ME_PASSWORD,
        json={"currentPassword": "anything", "newPassword": "newpass99"},
        headers=auth_headers(user),
    )

    assert resp.status_code == 400


def test_change_password_too_short(client, make_user):
    user = make_user(email="emp@test.com", role="employee", password="oldpass1")

    resp = client.put(
        ME_PASSWORD,
        json={"currentPassword": "oldpass1", "newPassword": "short"},
        headers=auth_headers(user),
    )

    assert resp.status_code == 422


def test_change_password_unauthenticated(client):
    resp = client.put(
        ME_PASSWORD,
        json={"currentPassword": "old", "newPassword": "newpass99"},
    )
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# POST /api/admin/users/{id}/reset-password
# ---------------------------------------------------------------------------

def test_admin_reset_password_success(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    emp = make_user(email="emp@test.com", role="employee", password="original1")

    resp = client.post(_reset_url(emp.user_id), headers=auth_headers(admin))

    assert resp.status_code == 200
    body = resp.json()
    assert "temporaryPassword" in body
    assert len(body["temporaryPassword"]) >= 8


def test_admin_reset_password_can_login_with_temp(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    emp = make_user(email="emp@test.com", role="employee", password="original1")

    reset_resp = client.post(_reset_url(emp.user_id), headers=auth_headers(admin))
    temp_pw = reset_resp.json()["temporaryPassword"]

    login_resp = client.post(
        "/api/auth/login",
        json={"email": "emp@test.com", "password": temp_pw},
    )
    assert login_resp.status_code == 200


def test_admin_reset_password_old_password_no_longer_works(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    emp = make_user(email="emp@test.com", role="employee", password="original1")

    client.post(_reset_url(emp.user_id), headers=auth_headers(admin))

    resp = client.post(
        "/api/auth/login",
        json={"email": "emp@test.com", "password": "original1"},
    )
    assert resp.status_code == 401


def test_admin_reset_password_not_found(client, make_user):
    import uuid
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.post(_reset_url(uuid.uuid4()), headers=auth_headers(admin))
    assert resp.status_code == 404


def test_admin_reset_password_forbidden_for_employee(client, make_user):
    emp = make_user(email="emp@test.com", role="employee")
    other = make_user(email="other@test.com", role="employee")

    resp = client.post(_reset_url(other.user_id), headers=auth_headers(emp))
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# mustChangePassword flag
# ---------------------------------------------------------------------------

def test_must_change_password_set_when_no_password_given(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    resp = client.post(
        "/api/admin/users",
        json={"name": "New", "email": "new@test.com", "phone": "+886911111111", "employeeNo": "EMP2024099"},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200

    new_user_id = resp.json()["user"]["id"]
    token = resp.json().get("temporaryPassword")
    login = client.post("/api/auth/login", json={"email": "new@test.com", "password": token})
    profile = client.get("/api/users/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    assert profile.json()["mustChangePassword"] is True


def test_must_change_password_cleared_after_change(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    client.post(
        "/api/admin/users",
        json={"name": "New", "email": "new@test.com", "phone": "+886911111111", "employeeNo": "EMP2024099"},
        headers=auth_headers(admin),
    )
    temp_pw = "EMP2024099"
    login = client.post("/api/auth/login", json={"email": "new@test.com", "password": temp_pw})
    token = login.json()["access_token"]

    client.put(
        ME_PASSWORD,
        json={"currentPassword": temp_pw, "newPassword": "mynewpass99"},
        headers={"Authorization": f"Bearer {token}"},
    )

    profile = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    assert profile.json()["mustChangePassword"] is False


def test_must_change_password_not_set_when_password_given(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    resp = client.post(
        "/api/admin/users",
        json={"name": "New", "email": "new@test.com", "phone": "+886911111111", "employeeNo": "EMP2024099", "password": "given1234"},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200

    login = client.post("/api/auth/login", json={"email": "new@test.com", "password": "given1234"})
    profile = client.get("/api/users/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    assert profile.json()["mustChangePassword"] is False
