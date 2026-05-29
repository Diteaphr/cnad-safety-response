"""Unit tests for mock FCM / SMS channel helpers."""

from __future__ import annotations

import uuid

import pytest

from app.services.integrations import mock_notification_channels as channels

pytestmark = pytest.mark.no_db


def test_send_fcm_skips_uuid_placeholder_token():
    token = str(uuid.uuid4())
    assert channels.send_fcm(device_token=token, title="T", body="B") is False


def test_send_fcm_mock_mode_returns_true_for_real_token():
    assert (
        channels.send_fcm(
            device_token="device-token-abc123",
            title="Alert",
            body="Please respond",
        )
        is True
    )


def test_send_fcm_batch_empty_returns_empty_list():
    assert channels.send_fcm_batch([]) == []


def test_send_fcm_batch_mock_mode_all_succeed():
    messages = [
        {"token": "tok-a", "title": "A", "body": "one"},
        {"token": "tok-b", "title": "B", "body": "two"},
    ]
    assert channels.send_fcm_batch(messages) == [True, True]


def test_send_twilio_sms_mock_without_credentials(monkeypatch):
    monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)
    monkeypatch.delenv("TWILIO_AUTH_TOKEN", raising=False)
    monkeypatch.delenv("TWILIO_FROM_NUMBER", raising=False)
    assert channels.send_twilio_sms_mock(to_e164="+886900000001", body="test") is True
