"""
Internal endpoints called by GCP Cloud Pub/Sub push subscriptions.

These routes are NOT protected by JWT — they are called by GCP infrastructure
using OIDC token authentication. In production, uncomment the OIDC validation
block to verify that requests come from the authorised Pub/Sub service account.

In local development these endpoints are unused — notification dispatch is
handled by FastAPI BackgroundTasks instead of Pub/Sub.

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
from app.services.notification_dispatch import dispatch_activation_notifications

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/internal", tags=["internal"])


@router.post("/notifications/dispatch")
def dispatch_notifications(body: dict, db: Session = Depends(get_db)):
    """
    Pub/Sub push endpoint for notification fan-out.

    Pub/Sub wraps the message in an envelope:
      {"message": {"data": "<base64-encoded-json>", ...}, "subscription": "..."}

    The decoded data JSON should be:
      {"kind": "activation", "event_id": "<uuid>"}

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
        # Pub/Sub base64 may omit padding — add == to be safe
        payload = json.loads(base64.b64decode(data_b64 + "==").decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid Pub/Sub message") from exc

    kind = payload.get("kind")
    if kind == "activation":
        try:
            event_id = uuid.UUID(payload["event_id"])
        except (KeyError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Missing or invalid event_id") from exc
        count = dispatch_activation_notifications(db, event_id)
        logger.info("Pub/Sub dispatch: activation event %s → %d notified", event_id, count)
    else:
        logger.warning("Pub/Sub dispatch: unknown kind=%r, acknowledging without action", kind)

    # Always return 200 so Pub/Sub marks the message as acknowledged.
    # Non-200 causes Pub/Sub to redeliver.
    return {"status": "ok"}
