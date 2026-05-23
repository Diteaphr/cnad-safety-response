"""
FCM / SMS notification channels.

FIREBASE_ENABLED=false  → log-only mock（本機開發預設）
FIREBASE_ENABLED=true   → 使用 Firebase Admin SDK 真實發送

send_fcm        — 單筆發送（供 remind / fallback 使用）
send_fcm_batch  — 批次平行發送（500 則/批，ThreadPoolExecutor）
"""

from __future__ import annotations

import concurrent.futures
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
# FCM — 單筆
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
# FCM — 批次平行（activation fan-out 使用）
# ---------------------------------------------------------------------------

_FCM_CHUNK_SIZE = 500
_FCM_MAX_WORKERS = 10


def send_fcm_batch(messages: list[dict[str, Any]]) -> list[bool]:
    """批次平行發送 FCM。

    messages: list of {token, title, body, data}
    Returns: list[bool]，順序與輸入相同，True = 成功。

    原理：
      - 每 500 則為一個批次，呼叫 Firebase Admin SDK messaging.send_each()
      - 最多 _FCM_MAX_WORKERS 個批次同時在 ThreadPoolExecutor 中平行執行
      - 本機 mock 模式下，log 所有訊息並全部回傳 True
    """
    if not messages:
        return []

    if not _ensure_firebase():
        for m in messages:
            logger.info(
                "[MOCK FCM batch] token=%s... title=%r",
                (m.get("token") or "")[:12],
                m.get("title"),
            )
        return [True] * len(messages)

    from firebase_admin import messaging

    chunks = [
        messages[i: i + _FCM_CHUNK_SIZE]
        for i in range(0, len(messages), _FCM_CHUNK_SIZE)
    ]

    # results[i] holds the bool list for chunk i
    chunk_results: list[list[bool]] = [[] for _ in chunks]

    def _send_chunk(idx: int, chunk: list[dict]) -> tuple[int, list[bool]]:
        fcm_msgs = [
            messaging.Message(
                notification=messaging.Notification(
                    title=m["title"], body=m["body"]
                ),
                token=m["token"],
                data={k: str(v) for k, v in (m.get("data") or {}).items()},
            )
            for m in chunk
        ]
        try:
            batch_resp = messaging.send_each(fcm_msgs)
            return idx, [r.success for r in batch_resp.responses]
        except Exception as exc:
            logger.error(
                "[FCM batch] chunk %d/%d failed: %s", idx + 1, len(chunks), exc
            )
            return idx, [False] * len(chunk)

    workers = min(_FCM_MAX_WORKERS, len(chunks))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_send_chunk, i, chunk) for i, chunk in enumerate(chunks)]
        for future in concurrent.futures.as_completed(futures):
            idx, results = future.result()
            chunk_results[idx] = results

    flat = [ok for chunk in chunk_results for ok in chunk]
    success_count = sum(flat)
    logger.info("[FCM batch] %d/%d sent successfully", success_count, len(messages))
    return flat


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
