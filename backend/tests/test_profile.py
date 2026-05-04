"""
Integration tests for:
  GET  /api/users/me  — read own profile
  PUT  /api/users/me  — update own name / phone

Key scenarios:
- Profile includes employeeNo, name, email, phone, departmentId, roles
- PUT updates name and phone; email / roles / departmentId are NOT changed
- Setting phone to null clears the field
- Unauthenticated requests are rejected
"""
from __future__ import annotations

import pytest

from tests.conftest import auth_headers

PROFILE = "/api/users/me"


# ---------------------------------------------------------------------------
# GET /api/users/me
# ---------------------------------------------------------------------------

def test_get_profile_returns_own_data(client, make_user, make_department):
    dept = make_department("Engineering")
    user = make_user(
        name="Alice",
        email="alice@test.com",
        role="employee",
        phone="+886912345678",
        department_id=dept.department_id,
    )

    resp = client.get(PROFILE, headers=auth_headers(user))

    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Alice"
    assert body["email"] == "alice@test.com"
    assert body["phone"] == "+886912345678"
    assert body["departmentId"] == str(dept.department_id)
    assert "employee" in body["roles"]
    assert "employeeNo" in body
    assert "password" not in body
    assert "password_hash" not in body


def test_get_profile_phone_none_when_not_set(client, make_user):
    user = make_user(email="bob@test.com", role="employee", phone=None)

    resp = client.get(PROFILE, headers=auth_headers(user))

    assert resp.status_code == 200
    assert resp.json()["phone"] is None


def test_get_profile_unauthenticated(client):
    resp = client.get(PROFILE)
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# PUT /api/users/me
# ---------------------------------------------------------------------------

def test_update_profile_name_and_phone(client, make_user):
    user = make_user(name="Old Name", email="u@test.com", role="employee", phone=None)

    resp = client.put(
        PROFILE,
        json={"name": "New Name", "phone": "+886987654321"},
        headers=auth_headers(user),
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "New Name"
    assert body["phone"] == "+886987654321"


def test_update_profile_clears_phone_when_null(client, make_user):
    user = make_user(email="u@test.com", role="employee", phone="+886900000000")

    resp = client.put(
        PROFILE,
        json={"name": "Alice", "phone": None},
        headers=auth_headers(user),
    )

    assert resp.status_code == 200
    assert resp.json()["phone"] is None


def test_update_profile_does_not_change_email_or_roles(client, make_user):
    user = make_user(name="Alice", email="alice@test.com", role="employee")

    resp = client.put(
        PROFILE,
        json={"name": "Alice Updated", "phone": None},
        headers=auth_headers(user),
    )

    assert resp.status_code == 200
    body = resp.json()
    # email and roles must remain unchanged
    assert body["email"] == "alice@test.com"
    assert body["roles"] == ["employee"]


def test_update_profile_name_required(client, make_user):
    user = make_user(email="u@test.com", role="employee")

    resp = client.put(
        PROFILE,
        json={"phone": "+886900000000"},  # missing name
        headers=auth_headers(user),
    )

    assert resp.status_code == 422


def test_update_profile_empty_name_rejected(client, make_user):
    user = make_user(email="u@test.com", role="employee")

    resp = client.put(
        PROFILE,
        json={"name": "", "phone": None},
        headers=auth_headers(user),
    )

    assert resp.status_code == 422


def test_update_profile_unauthenticated(client):
    resp = client.put(PROFILE, json={"name": "Hacker", "phone": None})
    assert resp.status_code in (401, 403)


def test_get_profile_reflects_update(client, make_user):
    """GET after PUT returns the updated values."""
    user = make_user(name="Before", email="u@test.com", role="employee")

    client.put(
        PROFILE,
        json={"name": "After", "phone": "+886911111111"},
        headers=auth_headers(user),
    )

    resp = client.get(PROFILE, headers=auth_headers(user))
    assert resp.json()["name"] == "After"
    assert resp.json()["phone"] == "+886911111111"
