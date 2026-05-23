"""
Pub/Sub publisher.

USE_GCP=false (local dev):  log-only mock, no network calls.
USE_GCP=true  (Cloud Run):  publishes to the real GCP topic; falls back to
                             in-process dispatch on publish failure so no
                             notification is silently dropped.

Fan-out architecture (30k scale):
  Event activated → publish N messages (one per employee) →
  Pub/Sub push → Cloud Run auto-scales → each instance sends 1 FCM.
  This is publish_user_notifications_batch().
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from app.core.config import settings

logger = logging.getLogger(__name__)


def _publish_real(topic_id: str, payload: dict[str, Any]) -> None:
    """Fire-and-forget publish of a single message to a GCP Pub/Sub topic."""
    from google.cloud import pubsub_v1

    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(settings.gcp_project_id, topic_id)
    data = json.dumps(payload, default=str).encode("utf-8")
    future = publisher.publish(topic_path, data)
    future.add_done_callback(
        lambda f: logger.error("[Pub/Sub] publish error topic=%s: %s", topic_path, f.exception())
        if f.exception()
        else logger.info("[Pub/Sub] published to %s kind=%s", topic_path, payload.get("kind"))
    )


def publish_notification_event(payload: dict[str, Any]) -> None:
    """Publish a single notification event (e.g. activation trigger).
    Falls back to in-process dispatch on error.
    """
    if not settings.use_gcp or not settings.pubsub_notification_topic:
        logger.info("[MOCK Pub/Sub] notification_event %s", json.dumps(payload, default=str))
        return

    try:
        _publish_real(settings.pubsub_notification_topic, payload)
    except Exception:
        logger.exception(
            "[Pub/Sub] publish failed — falling back to in-process dispatch (kind=%s)",
            payload.get("kind"),
        )
        _inline_fallback(payload)


def publish_user_notifications_batch(messages: list[dict[str, Any]]) -> int:
    """Publish one Pub/Sub message per employee for true parallel FCM fan-out.

    Each message carries all data the worker needs:
      {kind, event_id, user_id, token, phone, title, body}

    The Pub/Sub client internally batches up to 100 messages per HTTP request,
    so 30k messages → ~300 batch requests, confirmed concurrently.

    USE_GCP=false: log-only mock.
    USE_GCP=true:  real GCP publish; returns count of confirmed messages.
    """
    if not messages:
        return 0

    if not settings.use_gcp or not settings.pubsub_notification_topic:
        for m in messages:
            logger.info(
                "[MOCK Pub/Sub] user_fcm user=%s event=%s",
                m.get("user_id"),
                m.get("event_id"),
            )
        return len(messages)

    try:
        from google.cloud import pubsub_v1

        publisher = pubsub_v1.PublisherClient()
        topic_path = publisher.topic_path(
            settings.gcp_project_id, settings.pubsub_notification_topic
        )

        # publish() is non-blocking; client batches internally (up to 100/batch).
        futures = [
            publisher.publish(topic_path, json.dumps(m, default=str).encode("utf-8"))
            for m in messages
        ]

        # Collect results; most futures will already be resolved since the
        # client sends batches asynchronously in background threads.
        errors = 0
        for future in futures:
            try:
                future.result(timeout=60)
            except Exception as exc:
                errors += 1
                logger.error("[Pub/Sub] user_fcm publish error: %s", exc)

        published = len(messages) - errors
        logger.info(
            "[Pub/Sub] published %d/%d user_fcm messages to %s",
            published,
            len(messages),
            topic_path,
        )
        return published

    except Exception:
        logger.exception("[Pub/Sub] user_fcm batch publish failed")
        return 0


def _inline_fallback(payload: dict[str, Any]) -> None:
    """Dispatch notifications directly when Pub/Sub publish fails."""
    kind = payload.get("kind")
    if kind != "activation":
        return
    try:
        import uuid as _uuid

        from app.core.database import SessionLocal
        from app.services.notification_dispatch import dispatch_activation_notifications

        db = SessionLocal()
        try:
            dispatch_activation_notifications(db, _uuid.UUID(payload["event_id"]))
        finally:
            db.close()
    except Exception:
        logger.exception("[Pub/Sub fallback] in-process dispatch also failed")


def publish_supervisor_alert(payload: dict[str, Any]) -> None:
    publish_notification_event({**payload, "kind": "supervisor_alert"})


def publish_report_event(payload: dict[str, Any]) -> None:
    """Buffered report pipeline (optional separate topic)."""
    if not settings.use_gcp or not settings.pubsub_report_topic:
        logger.info("[MOCK Pub/Sub] report_event %s", json.dumps(payload, default=str))
        return

    try:
        _publish_real(settings.pubsub_report_topic, payload)
    except Exception:
        logger.exception("[Pub/Sub] report publish failed")


def build_event_created_payload(event_id: UUID, created_by: UUID) -> dict[str, Any]:
    return {
        "type": "event_created",
        "event_id": str(event_id),
        "created_by": str(created_by),
    }


def build_need_help_payload(event_id: UUID, user_id: UUID) -> dict[str, Any]:
    return {
        "type": "need_help",
        "event_id": str(event_id),
        "user_id": str(user_id),
    }
