"""
FCM / SMS — local development mocks (log only).

Replace with firebase-admin / Twilio SDK when wiring production.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


def send_fcm_mock(
    *,
    device_token: str,
    title: str,
    body: str,
    data: Optional[dict[str, Any]] = None,
) -> bool:
    """Pretend FCM delivery succeeded."""
    logger.info(
        "[MOCK FCM] token=%s... title=%r body=%r data=%s",
        device_token[:12] if device_token else "",
        title,
        body,
        data,
    )
    return True

    # --- Production: Firebase Admin SDK ---
    # import firebase_admin
    # from firebase_admin import messaging
    # message = messaging.Message(
    #     notification=messaging.Notification(title=title, body=body),
    #     token=device_token,
    #     data={k: str(v) for k, v in (data or {}).items()},
    # )
    # messaging.send(message)
    # return True


def send_twilio_sms_mock(*, to_e164: str, body: str) -> bool:
    """Pretend SMS delivery succeeded."""
    logger.info("[MOCK Twilio SMS] to=%s body=%r", to_e164, body[:200])
    return True

    # --- Production: Twilio ---
    # from twilio.rest import Client
    # client = Client(account_sid, auth_token)
    # client.messages.create(to=to_e164, from_=from_number, body=body)
    # return True
