"""Unit tests for app.api.deps (auth helpers and OIDC guards)."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.api.deps import (
    get_current_user,
    get_token_payload,
    verify_pubsub_oidc,
    verify_scheduler_oidc,
)
from app.core.jwt import create_access_token


def test_get_current_user_returns_uuid(make_user):
    user = make_user(email="deps@test.com", role="employee")
    creds = HTTPAuthorizationCredentials(
        scheme="Bearer", credentials=create_access_token(user.user_id, ["employee"])
    )
    assert get_current_user(creds) == user.user_id


@pytest.mark.no_db
def test_get_current_user_invalid_sub_raises_401():
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not-a-jwt")
    with patch("app.api.deps.decode_token", return_value={"sub": "not-a-uuid"}):
        with pytest.raises(HTTPException) as exc:
            get_current_user(creds)
    assert exc.value.status_code == 401


def test_get_token_payload_returns_decoded_claims(make_user):
    user = make_user(email="payload@test.com", role="admin")
    creds = HTTPAuthorizationCredentials(
        scheme="Bearer", credentials=create_access_token(user.user_id, ["admin"])
    )
    payload = get_token_payload(creds)
    assert payload["sub"] == str(user.user_id)
    assert "admin" in payload["roles"]


@pytest.mark.no_db
def test_verify_pubsub_oidc_skipped_when_not_gcp(monkeypatch):
    monkeypatch.setattr("app.api.deps.settings.use_gcp", False)
    request = MagicMock()
    verify_pubsub_oidc(request)


@pytest.mark.no_db
def test_verify_pubsub_oidc_missing_token_when_gcp(monkeypatch):
    monkeypatch.setattr("app.api.deps.settings.use_gcp", True)
    monkeypatch.setattr("app.api.deps.settings.service_url", "https://api.example.com")
    request = MagicMock()
    request.headers.get.return_value = ""
    with pytest.raises(HTTPException) as exc:
        verify_pubsub_oidc(request)
    assert exc.value.status_code == 401


@pytest.mark.no_db
def test_verify_scheduler_oidc_skipped_when_not_gcp(monkeypatch):
    monkeypatch.setattr("app.api.deps.settings.use_gcp", False)
    request = MagicMock()
    verify_scheduler_oidc(request)


@pytest.mark.no_db
def test_verify_pubsub_oidc_valid_token(monkeypatch):
    monkeypatch.setattr("app.api.deps.settings.use_gcp", True)
    monkeypatch.setattr("app.api.deps.settings.service_url", "https://api.example.com")
    monkeypatch.setattr(
        "app.api.deps.settings.pubsub_sa_email", "sa@test.iam.gserviceaccount.com"
    )
    request = MagicMock()
    request.headers.get.return_value = "Bearer valid-token"

    with patch("google.oauth2.id_token.verify_oauth2_token") as verify:
        verify.return_value = {"email": "sa@test.iam.gserviceaccount.com"}
        verify_pubsub_oidc(request)


@pytest.mark.no_db
def test_verify_scheduler_oidc_valid_token(monkeypatch):
    monkeypatch.setattr("app.api.deps.settings.use_gcp", True)
    monkeypatch.setattr("app.api.deps.settings.service_url", "https://api.example.com")
    monkeypatch.setattr(
        "app.api.deps.settings.pubsub_sa_email", "sa@test.iam.gserviceaccount.com"
    )
    request = MagicMock()
    request.headers.get.return_value = "Bearer valid-token"

    with patch("google.oauth2.id_token.verify_oauth2_token") as verify:
        verify.return_value = {"email": "sa@test.iam.gserviceaccount.com"}
        verify_scheduler_oidc(request)
