"""Unit tests for EventService (legacy service; routes may be unmounted)."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi import HTTPException

from pydantic import ValidationError

from app.schemas.event import EventCreate
from app.services.event_service import EventService


def test_event_create_rejects_custom_name_when_not_other():
    with pytest.raises(ValidationError):
        EventCreate(
            title="Drill",
            event_type="Earthquake",
            custom_type_name="Only for other",
        )


def test_create_event_forbidden_for_non_admin(db, make_user):
    employee = make_user(email="emp-es@test.com", role="employee")
    svc = EventService()
    with pytest.raises(HTTPException) as exc:
        svc.create_event(
            db,
            actor_user_id=employee.user_id,
            payload=EventCreate(title="Drill", event_type="Earthquake"),
        )
    assert exc.value.status_code == 403


def test_create_event_unknown_type(db, make_user):
    admin = make_user(email="admin-es@test.com", role="admin")
    svc = EventService()
    with pytest.raises(HTTPException) as exc:
        svc.create_event(
            db,
            actor_user_id=admin.user_id,
            payload=EventCreate(title="Drill", event_type="Volcano"),
        )
    assert exc.value.status_code == 400


@patch("app.services.event_service.pubsub.publish_notification_event")
def test_create_event_success(mock_publish, db, make_user):
    admin = make_user(email="admin-ok@test.com", role="admin")
    svc = EventService()
    event = svc.create_event(
        db,
        actor_user_id=admin.user_id,
        payload=EventCreate(title="Company drill", event_type="Earthquake"),
    )
    assert event.title == "Company drill"
    assert event.status == "active"
    mock_publish.assert_called_once()


@patch("app.services.event_service.pubsub.publish_notification_event")
def test_create_event_rolls_back_on_repository_error(mock_publish, db, make_user):
    admin = make_user(email="admin-rollback@test.com", role="admin")
    svc = EventService()
    with patch.object(svc._events, "create", side_effect=RuntimeError("db error")):
        with pytest.raises(RuntimeError, match="db error"):
            svc.create_event(
                db,
                actor_user_id=admin.user_id,
                payload=EventCreate(title="X", event_type="Earthquake"),
            )
    mock_publish.assert_not_called()


@patch("app.services.event_service.pubsub.publish_notification_event")
def test_create_event_other_with_custom_type(mock_publish, db, make_user):
    admin = make_user(email="admin-other@test.com", role="admin")
    svc = EventService()
    event = svc.create_event(
        db,
        actor_user_id=admin.user_id,
        payload=EventCreate(
            title="Custom incident",
            event_type="other",
            custom_type_name="Chemical spill",
        ),
    )
    assert event.title == "Custom incident"
    mock_publish.assert_called_once()
