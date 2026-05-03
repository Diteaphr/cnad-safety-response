"""
Redis dashboard aggregates — eventually consistent; rebuild from PostgreSQL if lost.

Does not block request path when disabled or Redis is down.
"""

import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def refresh_dashboard_statistics(event_id: Optional[str] = None) -> None:
    """Invalidate / increment dashboard counters after strong writes."""
    if not settings.redis_enabled:
        return
    try:
        import redis

        r = redis.from_url(settings.redis_url)
        if event_id:
            r.delete(f"dashboard:event:{event_id}")
        r.delete("dashboard:global")
        r.close()
    except Exception:
        logger.warning(
            "Redis dashboard refresh skipped (optional)", exc_info=False
        )


def add_jwt_to_blacklist(token_jti: str, ttl_seconds: int) -> None:
    """Placeholder for JWT blacklist — wire Redis when auth is implemented."""
    if not settings.redis_enabled:
        return
    try:
        import redis

        r = redis.from_url(settings.redis_url)
        r.setex(f"jwt:blacklist:{token_jti}", ttl_seconds, "1")
        r.close()
    except Exception:
        logger.warning("Redis blacklist write skipped", exc_info=False)
