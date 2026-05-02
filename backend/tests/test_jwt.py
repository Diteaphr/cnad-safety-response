"""
Unit tests for JWT token creation and decoding.

No database or HTTP client needed — these exercise app.core.jwt directly.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.jwt import create_access_token, decode_token

_ALGO = "HS256"


def test_valid_token_roundtrip():
    uid = uuid.uuid4()
    roles = ["employee", "supervisor"]
    token = create_access_token(uid, roles)
    payload = decode_token(token)
    assert payload["sub"] == str(uid)
    assert set(payload["roles"]) == set(roles)


def test_token_contains_expiry():
    token = create_access_token(uuid.uuid4(), ["employee"])
    payload = decode_token(token)
    assert "exp" in payload
    # expiry should be roughly 8 hours from now
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    diff = exp - datetime.now(timezone.utc)
    assert timedelta(hours=7) < diff < timedelta(hours=9)


def test_expired_token_raises_401():
    past = datetime.now(timezone.utc) - timedelta(hours=10)
    raw = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "roles": ["employee"],
            "iat": past,
            "exp": past + timedelta(hours=1),  # still in the past
        },
        settings.jwt_secret,
        algorithm=_ALGO,
    )
    with pytest.raises(HTTPException) as exc_info:
        decode_token(raw)
    assert exc_info.value.status_code == 401


def test_invalid_signature_raises_401():
    raw = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "roles": ["employee"],
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        "wrong-secret-key",
        algorithm=_ALGO,
    )
    with pytest.raises(HTTPException) as exc_info:
        decode_token(raw)
    assert exc_info.value.status_code == 401


def test_garbage_string_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        decode_token("not.a.valid.jwt.token")
    assert exc_info.value.status_code == 401


def test_empty_string_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        decode_token("")
    assert exc_info.value.status_code == 401
