"""
Tests for the Pub/Sub per-user fan-out dispatch path.

dispatch_activation_notifications routes to:
  - _pubsub_fan_out (use_gcp=True + topic set): publish one message per employee
  - _batch_fcm_dispatch (use_gcp=False):         direct batch FCM (dev/fallback)

These tests mock publish_user_notifications_batch to avoid real GCP calls.
"""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.services.notification_dispatch import dispatch_activation_notifications

PUBSUB_BATCH_FN = "app.services.integrations.pubsub_placeholder.publish_user_notifications_batch"
BATCH_FCM_FN = "app.services.notification_dispatch.send_fcm_batch"
# Patch settings where notification_dispatch reads them (its own import of settings)
SETTINGS_PATH = "app.services.notification_dispatch.settings"


def _patch_gcp(use_gcp: bool = True, topic: str = "test-notifications-topic"):
    """Patch the settings object as seen by notification_dispatch."""
    mock_settings = MagicMock()
    mock_settings.use_gcp = use_gcp
    mock_settings.pubsub_notification_topic = topic
    return patch(SETTINGS_PATH, mock_settings)


# ---------------------------------------------------------------------------
# Prod path: use_gcp=True  → _pubsub_fan_out
# ---------------------------------------------------------------------------

def test_pubsub_fanout_called_when_use_gcp_true(db, make_user, make_event):
    """use_gcp=True routes to Pub/Sub fan-out, not direct batch FCM."""
    emp1 = make_user(email="emp1@test.com", role="employee")
    emp2 = make_user(email="emp2@test.com", role="employee")
    event = make_event(status="active")

    with _patch_gcp(), \
         patch(PUBSUB_BATCH_FN, return_value=2) as mock_pub, \
         patch(BATCH_FCM_FN) as mock_fcm:
        count = dispatch_activation_notifications(db, event.event_id)

    mock_pub.assert_called_once()
    mock_fcm.assert_not_called()
    assert count == 2


def test_pubsub_fanout_publishes_one_message_per_employee(db, make_user, make_event):
    """Each employee gets exactly one Pub/Sub message."""
    employees = [make_user(email=f"emp{i}@test.com", role="employee") for i in range(5)]
    _admin = make_user(email="admin@test.com", role="admin")     # should be excluded
    _sup = make_user(email="sup@test.com", role="supervisor")    # should be excluded
    event = make_event(status="active")

    captured: list[list[dict]] = []

    def _capture(messages):
        captured.append(messages)
        return len(messages)

    with _patch_gcp(), patch(PUBSUB_BATCH_FN, side_effect=_capture):
        count = dispatch_activation_notifications(db, event.event_id)

    assert count == 5
    assert len(captured) == 1
    assert len(captured[0]) == 5


def test_pubsub_message_structure(db, make_user, make_event):
    """Each published message has all required fields with correct values."""
    emp = make_user(email="emp@test.com", role="employee", phone="+886912345678")
    event = make_event(status="active", title="Typhoon Test")

    captured: list[list[dict]] = []

    def _capture(messages):
        captured.append(messages)
        return len(messages)

    with _patch_gcp(), patch(PUBSUB_BATCH_FN, side_effect=_capture):
        dispatch_activation_notifications(db, event.event_id)

    msg = captured[0][0]
    assert msg["kind"] == "user_fcm"
    assert msg["event_id"] == str(event.event_id)
    assert msg["user_id"] == str(emp.user_id)
    assert "token" in msg
    assert "title" in msg
    assert "body" in msg
    # body should mention the event title
    assert event.title in msg["body"]


def test_pubsub_fanout_excludes_employees_outside_targeted_dept(
    db, make_user, make_event, make_department
):
    """Department-targeted event: Pub/Sub messages only for employees in target dept."""
    dept_a = make_department("Engineering")
    dept_b = make_department("Marketing")
    emp_in = make_user(email="emp_in@test.com", role="employee", department_id=dept_a.department_id)
    emp_out = make_user(email="emp_out@test.com", role="employee", department_id=dept_b.department_id)

    event = make_event(status="active", target_department_ids=[dept_a.department_id])

    captured: list[list[dict]] = []

    def _capture(messages):
        captured.append(messages)
        return len(messages)

    with _patch_gcp(), patch(PUBSUB_BATCH_FN, side_effect=_capture):
        count = dispatch_activation_notifications(db, event.event_id)

    assert count == 1
    assert len(captured[0]) == 1
    published_user_ids = {m["user_id"] for m in captured[0]}
    assert str(emp_in.user_id) in published_user_ids
    assert str(emp_out.user_id) not in published_user_ids


def test_pubsub_fanout_no_employees_returns_zero(db, make_user, make_event):
    """No target employees → 0 returned and Pub/Sub is never called."""
    _admin = make_user(email="admin@test.com", role="admin")
    event = make_event(status="active")

    with _patch_gcp(), patch(PUBSUB_BATCH_FN) as mock_pub:
        count = dispatch_activation_notifications(db, event.event_id)

    mock_pub.assert_not_called()
    assert count == 0


def test_pubsub_fanout_event_not_found_returns_zero(db):
    """Non-existent event → 0 returned without touching Pub/Sub."""
    with _patch_gcp(), patch(PUBSUB_BATCH_FN) as mock_pub:
        count = dispatch_activation_notifications(db, uuid.uuid4())

    mock_pub.assert_not_called()
    assert count == 0


# ---------------------------------------------------------------------------
# Dev path: use_gcp=False  → _batch_fcm_dispatch
# ---------------------------------------------------------------------------

def test_dev_mode_uses_batch_fcm_not_pubsub(db, make_user, make_event):
    """use_gcp=False falls back to direct batch FCM and never calls Pub/Sub."""
    make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")

    with _patch_gcp(use_gcp=False), \
         patch(BATCH_FCM_FN, return_value=[True]) as mock_fcm, \
         patch(PUBSUB_BATCH_FN) as mock_pub:
        count = dispatch_activation_notifications(db, event.event_id)

    mock_pub.assert_not_called()
    mock_fcm.assert_called_once()
    assert count == 1


def test_no_topic_uses_batch_fcm_not_pubsub(db, make_user, make_event):
    """use_gcp=True but no topic configured → falls back to batch FCM."""
    make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")

    with _patch_gcp(use_gcp=True, topic=""), \
         patch(BATCH_FCM_FN, return_value=[True]) as mock_fcm, \
         patch(PUBSUB_BATCH_FN) as mock_pub:
        count = dispatch_activation_notifications(db, event.event_id)

    mock_pub.assert_not_called()
    mock_fcm.assert_called_once()
    assert count == 1
