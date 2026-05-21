from functools import lru_cache
from typing import Any

from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import BASE_DIR, settings
from app.core.database import get_db

router = APIRouter(tags=["health"])

REQUIRED_TABLES = (
    "departments",
    "event_target_departments",
    "event_types",
    "events",
    "notifications",
    "roles",
    "safety_responses",
    "user_departments",
    "user_notification_preferences",
    "user_roles",
    "users",
)


@lru_cache(maxsize=1)
def _expected_alembic_heads() -> tuple[str, ...]:
    config = Config(str(BASE_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BASE_DIR / "alembic"))
    script = ScriptDirectory.from_config(config)
    return tuple(sorted(script.get_heads()))


def _status_response(result: dict[str, Any]) -> JSONResponse:
    status_code = (
        status.HTTP_200_OK
        if result["status"] == "ok"
        else status.HTTP_503_SERVICE_UNAVAILABLE
    )
    return JSONResponse(content=result, status_code=status_code)


def _check_database(db: Session) -> str:
    db.execute(text("SELECT 1"))
    return "ok"


def _check_redis() -> str:
    if not settings.redis_enabled:
        return "skipped"

    import redis

    r = redis.Redis.from_url(settings.redis_url)
    try:
        r.ping()
        return "ok"
    finally:
        r.close()


def _table_exists(db: Session, table_name: str) -> bool:
    table_ref = f"public.{table_name}"
    return (
        db.execute(
            text("SELECT to_regclass(:table_ref)"),
            {"table_ref": table_ref},
        ).scalar()
        is not None
    )


@router.get("/live")
def live_check() -> dict[str, str]:
    """Lightweight liveness check: the app process can serve HTTP."""
    return {"status": "ok", "app": "ok"}


@router.get("/ready")
def ready_check(db: Session = Depends(get_db)) -> JSONResponse:
    """Readiness check: dependencies needed to serve normal traffic are reachable."""
    result: dict[str, Any] = {
        "status": "ok",
        "app": "ok",
        "database": "unknown",
        "redis": "unknown",
    }

    try:
        result["database"] = _check_database(db)
    except Exception as e:
        result["database"] = f"error: {e}"
        result["status"] = "error"

    try:
        result["redis"] = _check_redis()
    except Exception as e:
        result["redis"] = f"error: {e}"
        result["status"] = "error"

    return _status_response(result)


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> JSONResponse:
    """Backward-compatible readiness endpoint used by existing docs and scripts."""
    return ready_check(db)


@router.get("/health/db")
def database_health_check(db: Session = Depends(get_db)) -> JSONResponse:
    result: dict[str, Any] = {
        "status": "ok",
        "database": "unknown",
    }

    try:
        row = db.execute(
            text(
                """
                SELECT
                    current_database() AS database_name,
                    current_schema() AS schema_name
                """
            )
        ).mappings().one()
        result["database"] = {
            "status": "ok",
            "name": row["database_name"],
            "schema": row["schema_name"],
        }
    except Exception as e:
        result["database"] = f"error: {e}"
        result["status"] = "error"

    return _status_response(result)


@router.get("/health/deep")
def deep_health_check(db: Session = Depends(get_db)) -> JSONResponse:
    """Operational diagnostic check for schema and migration state."""
    expected_heads: list[str] = []
    expected_head: Any = "unknown"
    expected_head_error = None
    try:
        expected_heads = list(_expected_alembic_heads())
        expected_head = (
            expected_heads[0] if len(expected_heads) == 1 else expected_heads
        )
    except Exception as e:
        expected_head_error = str(e)

    result: dict[str, Any] = {
        "status": "ok",
        "app": "ok",
        "database": "unknown",
        "redis": "unknown",
        "schema": {
            "required_tables": list(REQUIRED_TABLES),
            "missing_tables": [],
        },
        "migration": {
            "alembic_version": "unknown",
            "expected_head": expected_head,
        },
    }

    if expected_head_error:
        result["migration"]["expected_head_error"] = expected_head_error
        result["status"] = "error"

    try:
        result["database"] = _check_database(db)
    except Exception as e:
        result["database"] = f"error: {e}"
        result["status"] = "error"

    try:
        result["redis"] = _check_redis()
    except Exception as e:
        result["redis"] = f"error: {e}"
        result["status"] = "error"

    try:
        missing_tables = [
            table_name
            for table_name in REQUIRED_TABLES
            if not _table_exists(db, table_name)
        ]
        result["schema"]["missing_tables"] = missing_tables
        if missing_tables:
            result["status"] = "error"
    except Exception as e:
        result["schema"] = f"error: {e}"
        result["status"] = "error"

    try:
        if _table_exists(db, "alembic_version"):
            versions = db.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalars().all()
            actual_heads = sorted(version for version in versions if version)
            result["migration"]["alembic_version"] = (
                actual_heads[0] if len(actual_heads) == 1 else actual_heads or "empty"
            )
            if actual_heads != expected_heads:
                result["status"] = "error"
        else:
            result["migration"]["alembic_version"] = "missing"
            result["status"] = "error"
    except Exception as e:
        result["migration"] = f"error: {e}"
        result["status"] = "error"

    return _status_response(result)
