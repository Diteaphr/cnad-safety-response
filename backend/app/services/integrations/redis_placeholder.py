"""
Redis dashboard aggregates — eventually consistent; rebuild from PostgreSQL if lost.

Does not block request path when disabled or Redis is down.
"""

import json
import logging
from typing import Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def refresh_dashboard_statistics(event_id: Optional[str] = None) -> None:
    """Invalidate dashboard counters after a report write."""
    if not settings.redis_enabled:
        return
    try:
        import redis

        r = redis.from_url(settings.redis_url)
        if event_id:
            r.delete(f"dashboard:event:{event_id}")   # legacy key
            r.delete(f"dashboard:admin:{event_id}")   # admin dashboard cache
            # supervisor dashboard keys include manager_id — rely on TTL expiry
        r.delete("dashboard:global")
        r.close()
    except Exception:
        logger.warning(
            "Redis dashboard refresh skipped (optional)", exc_info=False
        )


def get_dashboard_cache(key: str) -> Optional[dict[str, Any]]:
    """Return cached dashboard data, or None on cache miss / Redis unavailable."""
    if not settings.redis_enabled:
        return None
    try:
        import redis

        r = redis.from_url(settings.redis_url)
        raw = r.get(key)
        r.close()
        return json.loads(raw) if raw else None
    except Exception:
        logger.warning("Redis dashboard cache read skipped", exc_info=False)
        return None


def set_dashboard_cache(key: str, data: dict[str, Any], ttl: int = 30) -> None:
    """Store dashboard data in Redis with a TTL (seconds)."""
    if not settings.redis_enabled:
        return
    try:
        import redis

        r = redis.from_url(settings.redis_url)
        r.setex(key, ttl, json.dumps(data, default=str))
        r.close()
    except Exception:
        logger.warning("Redis dashboard cache write skipped", exc_info=False)


