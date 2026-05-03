from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict[str, Any]:
    result: dict[str, Any] = {
        "status": "ok",
        "app": "ok",
        "database": "unknown",
        "redis": "unknown",
    }

    try:
        db.execute(text("SELECT 1"))
        result["database"] = "ok"
    except Exception as e:
        result["database"] = f"error: {e}"
        result["status"] = "error"

    if settings.redis_enabled:
        try:
            import redis

            r = redis.Redis.from_url(settings.redis_url)
            r.ping()
            r.close()
            result["redis"] = "ok"
        except Exception as e:
            result["redis"] = f"error: {e}"
            result["status"] = "error"
    else:
        result["redis"] = "skipped"

    return result
