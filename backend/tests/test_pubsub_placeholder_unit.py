"""Unit tests for pubsub_placeholder mock / helper paths (USE_GCP=false)."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.services.integrations import pubsub_placeholder as pubsub

pytestmark = pytest.mark.no_db


def test_build_payload_helpers():
    eid = uuid.uuid4()
    uid = uuid.uuid4()
    created = pubsub.build_event_created_payload(eid, uid)
    need = pubsub.build_need_help_payload(eid, uid)
    assert created["type"] == "event_created"
    assert created["event_id"] == str(eid)
    assert need["type"] == "need_help"
    assert need["user_id"] == str(uid)


def test_publish_notification_event_mock_mode(monkeypatch):
    monkeypatch.setattr(pubsub.settings, "use_gcp", False)
    monkeypatch.setattr(pubsub.settings, "pubsub_notification_topic", "")
    pubsub.publish_notification_event({"kind": "activation", "event_id": str(uuid.uuid4())})


def test_publish_user_notifications_batch_empty():
    assert pubsub.publish_user_notifications_batch([]) == 0


def test_publish_user_notifications_batch_mock_mode(monkeypatch):
    monkeypatch.setattr(pubsub.settings, "use_gcp", False)
    monkeypatch.setattr(pubsub.settings, "pubsub_notification_topic", "")
    messages = [
        {"user_id": "u1", "event_id": "e1", "token": "t1"},
        {"user_id": "u2", "event_id": "e1", "token": "t2"},
    ]
    assert pubsub.publish_user_notifications_batch(messages) == 2


def test_publish_report_event_mock_mode(monkeypatch):
    monkeypatch.setattr(pubsub.settings, "use_gcp", False)
    monkeypatch.setattr(pubsub.settings, "pubsub_report_topic", "")
    pubsub.publish_report_event({"event_id": str(uuid.uuid4())})


def test_publish_supervisor_alert_delegates(monkeypatch):
    monkeypatch.setattr(pubsub, "publish_notification_event", MagicMock())
    pubsub.publish_supervisor_alert({"event_id": str(uuid.uuid4())})
    pubsub.publish_notification_event.assert_called_once()


def test_publish_notification_event_falls_back_on_publish_error(monkeypatch):
    monkeypatch.setattr(pubsub.settings, "use_gcp", True)
    monkeypatch.setattr(pubsub.settings, "pubsub_notification_topic", "notifications")
    event_id = uuid.uuid4()
    with patch.object(pubsub, "_publish_real", side_effect=RuntimeError("network")):
        with patch.object(pubsub, "_inline_fallback") as fallback:
            pubsub.publish_notification_event(
                {"kind": "activation", "event_id": str(event_id)}
            )
    fallback.assert_called_once()


def test_inline_fallback_ignores_non_activation():
    pubsub._inline_fallback({"kind": "supervisor_alert"})
