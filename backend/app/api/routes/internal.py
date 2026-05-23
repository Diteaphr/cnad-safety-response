"""
Internal endpoints called by GCP Cloud Pub/Sub push subscriptions.

These routes are NOT protected by JWT — they are called by GCP infrastructure
using OIDC token authentication. In production, uncomment the OIDC validation
block to verify that requests come from the authorised Pub/Sub service account.

Supported message kinds
───────────────────────
  activation  → fan-out to all target employees
                  dev:  _batch_fcm_dispatch (in-process)
                  prod: publish N user_fcm messages to Pub/Sub

  user_fcm    → send FCM to a single user (one Cloud Run instance per message)
                  Enables true horizontal scaling: Cloud Run auto-scales to
                  consume 30k messages in parallel across multiple instances.

Production wiring:
  1. Create a Pub/Sub push subscription pointing to:
       https://<cloud-run-url>/api/internal/notifications/dispatch
  2. Set the subscription's service account and uncomment OIDC validation below.
  3. Set USE_GCP=true in Cloud Run environment variables.
"""
from __future__ import annotations

import base64
import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.notification_dispatch import (
    dispatch_activation_notifications,
    dispatch_single_user_notification,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/internal", tags=["internal"])


@router.post("/notifications/dispatch")
def dispatch_notifications(body: dict, db: Session = Depends(get_db)):
    """
    Pub/Sub push endpoint — handles both activation fan-out and per-user FCM.

    Pub/Sub message envelope:
      {"message": {"data": "<base64-encoded-json>", ...}, "subscription": "..."}

    --- Production: OIDC token validation ---
    Uncomment the block below and supply the expected audience (your Cloud Run URL)
    to reject requests that do not come from the authorised Pub/Sub service account.

    # from fastapi import Request
    # from google.auth.transport import requests as google_requests
    # from google.oauth2 import id_token
    #
    # def _verify_oidc(request: Request) -> None:
    #     token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    #     audience = "https://<your-cloud-run-url>/api/internal/notifications/dispatch"
    #     id_token.verify_oauth2_token(token, google_requests.Request(), audience)
    """
    try:
        message = body.get("message", {})
        data_b64 = message.get("data", "")
        payload = json.loads(base64.b64decode(data_b64 + "==").decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid Pub/Sub message") from exc

    kind = payload.get("kind")

    # ── Fan-out trigger: query employees → publish per-user messages (prod)
    #                                    or batch FCM (dev)
    if kind == "activation":
        try:
            event_id = uuid.UUID(payload["event_id"])
        except (KeyError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Missing or invalid event_id") from exc
        count = dispatch_activation_notifications(db, event_id)
        logger.info("Pub/Sub dispatch: activation event %s → %d notified", event_id, count)

    # ── Per-user FCM: one Cloud Run instance per message, true horizontal scale
    elif kind == "user_fcm":
        try:
            event_id = uuid.UUID(payload["event_id"])
            user_id = uuid.UUID(payload["user_id"])
        except (KeyError, ValueError) as exc:
            raise HTTPException(
                status_code=400, detail="Missing or invalid event_id/user_id"
            ) from exc

        token = payload.get("token", "")
        phone = payload.get("phone")
        title = payload.get("title", "緊急安全確認")
        body_text = payload.get("body", "")

        dispatch_single_user_notification(
            db,
            event_id=event_id,
            user_id=user_id,
            token=token,
            phone=phone,
            title=title,
            body=body_text,
        )
        logger.info(
            "Pub/Sub dispatch: user_fcm event=%s user=%s", event_id, user_id
        )

    else:
        logger.warning(
            "Pub/Sub dispatch: unknown kind=%r, acknowledging without action", kind
        )

    # Always return 200 so Pub/Sub marks the message as acknowledged.
    # Non-200 causes Pub/Sub to redeliver.
    return {"status": "ok"}
