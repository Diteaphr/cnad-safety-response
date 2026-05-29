"""Unit tests for NotificationService deliver / idempotency paths."""

from __future__ import annotations

from app.services.notification_service import NotificationService, SENT_STATUS


def test_should_send_false_when_already_sent(db, make_user, make_event):
    svc = NotificationService()
    user = make_user(email="notif-sent@test.com", role="employee")
    event = make_event(status="active")

    svc.deliver_with_idempotency(
        db,
        event_id=event.event_id,
        user_id=user.user_id,
        channel="fcm",
        send_fn=lambda: True,
    )

    assert (
        svc.should_send(db, event.event_id, user.user_id, "fcm") is False
    )


def test_deliver_with_idempotency_skips_second_send(db, make_user, make_event):
    svc = NotificationService()
    user = make_user(email="notif-idem@test.com", role="employee")
    event = make_event(status="active")
    calls = {"n": 0}

    def send_once() -> bool:
        calls["n"] += 1
        return True

    first = svc.deliver_with_idempotency(
        db,
        event_id=event.event_id,
        user_id=user.user_id,
        channel="fcm",
        send_fn=send_once,
    )
    second = svc.deliver_with_idempotency(
        db,
        event_id=event.event_id,
        user_id=user.user_id,
        channel="fcm",
        send_fn=send_once,
    )

    assert first.status == SENT_STATUS
    assert second.notification_id == first.notification_id
    assert calls["n"] == 1


def test_deliver_with_fallback_uses_sms_when_fcm_fails(db, make_user, make_event):
    svc = NotificationService()
    user = make_user(email="notif-fb@test.com", role="employee")
    event = make_event(status="active")
    channels: list[str] = []

    def primary() -> bool:
        channels.append("fcm")
        return False

    def fallback() -> bool:
        channels.append("sms")
        return True

    svc.deliver_with_fallback(
        db,
        event_id=event.event_id,
        user_id=user.user_id,
        primary_channel="fcm",
        primary_send_fn=primary,
        fallback_channel="sms",
        fallback_send_fn=fallback,
    )

    assert channels == ["fcm", "sms"]


def test_deliver_marks_failed_when_send_raises(db, make_user, make_event):
    svc = NotificationService()
    user = make_user(email="notif-fail@test.com", role="employee")
    event = make_event(status="active")

    def send_fail() -> bool:
        raise RuntimeError("send failed")

    row = svc.deliver_with_idempotency(
        db,
        event_id=event.event_id,
        user_id=user.user_id,
        channel="fcm",
        send_fn=send_fail,
    )
    assert row.status == "failed"


def test_should_send_true_when_pending_or_failed(db, make_user, make_event):
    svc = NotificationService()
    user = make_user(email="notif-pending@test.com", role="employee")
    event = make_event(status="active")
    assert svc.should_send(db, event.event_id, user.user_id, "fcm") is True


def test_to_dict_serializes_notification(db, make_user, make_event):
    svc = NotificationService()
    user = make_user(email="notif-dict@test.com", role="employee")
    event = make_event(status="active")
    row = svc.deliver_with_idempotency(
        db,
        event_id=event.event_id,
        user_id=user.user_id,
        channel="fcm",
        send_fn=lambda: True,
    )
    data = svc.to_dict(row)
    assert data["event_id"] == str(event.event_id)
    assert data["user_id"] == str(user.user_id)
    assert data["channel"] == "fcm"
    assert data["status"] == SENT_STATUS
