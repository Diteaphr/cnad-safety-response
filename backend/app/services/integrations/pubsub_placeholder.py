"""
Pub/Sub: local development uses an in-process mock (log only).

Real Google Cloud Pub/Sub is left commented below for production / Cloud Run.
Install: pip install google-cloud-pubsub
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)


def publish_notification_event(payload: dict[str, Any]) -> None:
    """Called after DB commit. Local dev: mock only."""
    logger.info("[MOCK Pub/Sub] notification_event %s", json.dumps(payload, default=str))

    # --- GCP Pub/Sub (uncomment when deploying with USE_GCP=true) ---
    # if not settings.pubsub_notification_topic or not settings.gcp_project_id:
    #     logger.debug("Skip Pub/Sub: missing topic or project")
    #     return
    # try:
    #     from google.cloud import pubsub_v1
    #
    #     publisher = pubsub_v1.PublisherClient()
    #     topic_path = publisher.topic_path(
    #         settings.gcp_project_id, settings.pubsub_notification_topic
    #     )
    #     data = json.dumps(payload, default=str).encode("utf-8")
    #     publisher.publish(topic_path, data)
    # except Exception:
    #     logger.exception("Pub/Sub notification publish failed")


def publish_supervisor_alert(payload: dict[str, Any]) -> None:
    publish_notification_event({**payload, "kind": "supervisor_alert"})


def publish_report_event(payload: dict[str, Any]) -> None:
    """Buffered report pipeline (optional separate topic)."""
    logger.info("[MOCK Pub/Sub] report_event %s", json.dumps(payload, default=str))

    # --- GCP Pub/Sub (uncomment when deploying with USE_GCP=true) ---
    # if not settings.pubsub_report_topic or not settings.gcp_project_id:
    #     logger.debug("Skip Pub/Sub report: missing topic or project")
    #     return
    # try:
    #     from google.cloud import pubsub_v1
    #
    #     publisher = pubsub_v1.PublisherClient()
    #     topic_path = publisher.topic_path(
    #         settings.gcp_project_id, settings.pubsub_report_topic
    #     )
    #     data = json.dumps(payload, default=str).encode("utf-8")
    #     publisher.publish(topic_path, data)
    # except Exception:
    #     logger.exception("Pub/Sub report publish failed")


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
