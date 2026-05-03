"""
Integration tests for:
  POST /api/auth/register
  POST /api/auth/login
"""
from __future__ import annotations

import pytest

REGISTER = "/api/auth/register"
LOGIN = "/api/auth/login"

_VALID = {"name": "Alice", "email": "alice@test.com", "password": "password123"}


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

def test_register_success(client, roles):
    resp = client.post(REGISTER, json=_VALID)
    assert resp.status_code == 200
    body = resp.json()
    assert "user" in body
    assert body["user"]["email"] == _VALID["email"]
    assert "employee" in body["user"]["roles"]


def test_register_returns_no_token(client, roles):
    # register should NOT return an access_token (login is separate)
    resp = client.post(REGISTER, json=_VALID)
    assert "access_token" not in resp.json()


def test_register_duplicate_email_409(client, roles):
    client.post(REGISTER, json=_VALID)
    resp = client.post(REGISTER, json=_VALID)
    assert resp.status_code == 409


def test_register_email_case_insensitive(client, roles):
    client.post(REGISTER, json={**_VALID, "email": "Alice@Test.COM"})
    resp = client.post(REGISTER, json={**_VALID, "email": "alice@test.com"})
    assert resp.status_code == 409


def test_register_missing_employee_role_500(client):
    # No `roles` fixture → Role table is empty → service raises HTTP 500
    resp = client.post(REGISTER, json=_VALID)
    assert resp.status_code == 500


def test_register_short_password_422(client, roles):
    resp = client.post(REGISTER, json={**_VALID, "password": "short"})
    assert resp.status_code == 422


def test_register_invalid_email_422(client, roles):
    resp = client.post(REGISTER, json={**_VALID, "email": "not-an-email"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

def test_login_success(client, roles):
    client.post(REGISTER, json=_VALID)
    resp = client.post(LOGIN, json={"email": _VALID["email"], "password": _VALID["password"]})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    assert "user" in body


def test_login_wrong_password_401(client, roles):
    client.post(REGISTER, json=_VALID)
    resp = client.post(LOGIN, json={"email": _VALID["email"], "password": "wrongpassword"})
    assert resp.status_code == 401


def test_login_unknown_email_401(client, roles):
    resp = client.post(LOGIN, json={"email": "nobody@test.com", "password": "password123"})
    assert resp.status_code == 401


def test_login_email_case_insensitive(client, roles):
    client.post(REGISTER, json=_VALID)
    resp = client.post(LOGIN, json={"email": "ALICE@TEST.COM", "password": _VALID["password"]})
    assert resp.status_code == 200


def test_login_token_is_decodable(client, roles):
    """Token returned by login must be a valid JWT accepted by decode_token."""
    from app.core.jwt import decode_token

    client.post(REGISTER, json=_VALID)
    resp = client.post(LOGIN, json={"email": _VALID["email"], "password": _VALID["password"]})
    token = resp.json()["access_token"]
    payload = decode_token(token)
    assert payload["sub"] == resp.json()["user"]["id"]
