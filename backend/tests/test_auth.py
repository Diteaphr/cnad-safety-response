"""
Integration tests for:
  POST /api/auth/register (disabled)
  POST /api/auth/login
"""
from __future__ import annotations

from app.core.passwords import hash_password
from app.models.user import User
from app.models.user_role import UserRole

REGISTER = "/api/auth/register"
LOGIN = "/api/auth/login"

_VALID = {"name": "Alice", "email": "alice@test.com", "password": "password123"}


# ---------------------------------------------------------------------------
# Register (disabled)
# ---------------------------------------------------------------------------

def test_register_disabled_403(client, roles):
    resp = client.post(REGISTER, json=_VALID)
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

def test_login_success(client, make_user):
    make_user(email="alice@test.com", password="password123")
    resp = client.post(LOGIN, json={"email": _VALID["email"], "password": _VALID["password"]})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    assert "user" in body


def test_login_wrong_password_401(client, make_user):
    make_user(email="alice@test.com", password="password123")
    resp = client.post(LOGIN, json={"email": _VALID["email"], "password": "wrongpassword"})
    assert resp.status_code == 401


def test_login_unknown_email_401(client, roles):
    resp = client.post(LOGIN, json={"email": "nobody@test.com", "password": "password123"})
    assert resp.status_code == 401


def test_login_email_case_insensitive(client, make_user):
    make_user(email="alice@test.com", password="password123")
    resp = client.post(LOGIN, json={"email": "ALICE@TEST.COM", "password": _VALID["password"]})
    assert resp.status_code == 200


def test_login_token_is_decodable(client, make_user):
    """Token returned by login must be a valid JWT accepted by decode_token."""
    from app.core.jwt import decode_token

    make_user(email="alice@test.com", password="password123")
    resp = client.post(LOGIN, json={"email": _VALID["email"], "password": _VALID["password"]})
    token = resp.json()["access_token"]
    payload = decode_token(token)
    assert payload["sub"] == resp.json()["user"]["id"]


DEMO_LOGIN = "/api/auth/demo-login"


def test_demo_login_rejects_unknown_user_id(client, roles, make_user):
    """Demo JWT is only minted for fixed seed UUIDs in demo_accounts."""
    stranger = make_user()
    resp = client.post(DEMO_LOGIN, json={"userId": str(stranger.user_id)})
    assert resp.status_code == 403


def test_demo_login_success_for_seed_uuid(client, db, roles):
    """POST /reports requires Bearer — demo SPA uses this endpoint after choosing a demo persona."""
    from app.seeding import ids

    u = User(
        user_id=ids.U_02,
        employee_no="SUP001",
        name="Super Demo",
        email="super_demo@test.local",
        manager_id=None,
        status="active",
        password_hash=hash_password("unused"),
    )
    db.add(u)
    db.add(UserRole(user_id=ids.U_02, role_id=roles["supervisor"].role_id))
    db.commit()

    resp = client.post(DEMO_LOGIN, json={"userId": str(ids.U_02)})
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["id"] == str(ids.U_02)
    assert "access_token" in body
