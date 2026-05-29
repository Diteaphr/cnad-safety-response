"""Unit tests for app.core.passwords edge cases."""

from __future__ import annotations

import pytest

from app.core.passwords import hash_password, verify_password

pytestmark = pytest.mark.no_db


def test_hash_and_verify_roundtrip():
    stored = hash_password("MySecret99")
    assert verify_password("MySecret99", stored) is True
    assert verify_password("wrong", stored) is False


def test_verify_password_rejects_missing_or_malformed():
    assert verify_password("x", None) is False
    assert verify_password("x", "") is False
    assert verify_password("x", "bcrypt$1$2$3") is False
    assert verify_password("x", "pbkdf2_sha256$notint$aa$bb") is False
    assert verify_password("x", "pbkdf2_sha256$100000$ZZZZ$deadbeef") is False
