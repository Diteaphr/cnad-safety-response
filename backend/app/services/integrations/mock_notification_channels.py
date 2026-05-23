"""
FCM / SMS notification channels.

FIREBASE_ENABLED=false  → log-only mock（本機開發預設）
FIREBASE_ENABLED=true   → 使用 Firebase Admin SDK 真實發送
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Firebase Admin SDK 初始化（lazy，只在 firebase_enabled=true 時執行）
# ---------------------------------------------------------------------------
_firebase_initialized = False


def _ensure_firebase() -> bool:
    """初始化 Firebase Admin SDK，失敗時回傳 False。"""
    global _firebase_initialized
    if _firebase_initialized:
        return True

    from app.core.config import settings
    if not settings.firebase_enabled:
        return False

    try:
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:
            _firebase_initialized = True
            return True

        if settings.firebase_credentials_json.strip():
            cred_dict = json.loads(settings.firebase_credentials_json)
            cred = credentials.Certificate(cred_dict)
        else:
            # Cloud Run 上使用 Application Default Credentials
            cred = credentials.ApplicationDefault()

        firebase_admin.initialize_app(cred)
        _firebase_initialized = True
        logger.info("Firebase Admin SDK initialized.")
        return True
    except Exception as e:
        logger.error("Firebase Admin SDK init failed: %s", e)
        return False


# ---------------------------------------------------------------------------
# FCM
# ---------------------------------------------------------------------------

def send_fcm(
    *,
    device_token: str,
    title: str,
    body: str,
    data: Optional[dict[str, Any]] = None,
) -> bool:
    if not _ensure_firebase():
        logger.info(
            "[MOCK FCM] token=%s... title=%r body=%r data=%s",
            device_token[:12] if device_token else "",
            title,
            body,
            data,
        )
        return True

    try:
        from firebase_admin import messaging
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            token=device_token,
            data={k: str(v) for k, v in (data or {}).items()},
        )
        messaging.send(message)
        logger.info("[FCM] sent to token=%s...", device_token[:12])
        return True
    except Exception as e:
        logger.error("[FCM] send failed token=%s... error=%s", device_token[:12], e)
        return False


# ---------------------------------------------------------------------------
# SMS（Twilio mock — 尚未實作真實發送）
# ---------------------------------------------------------------------------

def send_twilio_sms_mock(*, to_e164: str, body: str) -> bool:
    logger.info("[MOCK Twilio SMS] to=%s body=%r", to_e164, body[:200])
    return True


# ---------------------------------------------------------------------------
# 保留舊名稱相容性（notification_dispatch.py 使用）
# ---------------------------------------------------------------------------
send_fcm_mock = send_fcm
