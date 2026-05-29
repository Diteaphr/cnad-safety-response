"""Extra health endpoint branches."""

from __future__ import annotations

from unittest.mock import patch

import pytest


def test_health_marks_error_when_database_unreachable(client):
    with patch("app.api.routes.health._check_database", side_effect=RuntimeError("db down")):
        resp = client.get("/health")
    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == "error"
    assert "db down" in body["database"]


def test_health_marks_error_when_redis_unreachable(client, monkeypatch):
    monkeypatch.setattr("app.api.routes.health.settings.redis_enabled", True)
    with patch("app.api.routes.health._check_redis", side_effect=RuntimeError("redis down")):
        resp = client.get("/ready")
    assert resp.status_code == 503
    assert resp.json()["redis"] == "error: redis down"


def test_deep_health_ok_when_migrations_applied(client, db):
    """When alembic_version exists and matches heads, deep check returns ok."""
    from sqlalchemy import text

    from app.api.routes.health import _expected_alembic_heads

    heads = _expected_alembic_heads()
    if len(heads) != 1:
        pytest.skip("multi-head migrations not supported in this test")

    version = heads[0]
    db.execute(
        text(
            "CREATE TABLE IF NOT EXISTS alembic_version "
            "(version_num VARCHAR(32) NOT NULL)"
        )
    )
    db.execute(text("DELETE FROM alembic_version"))
    db.execute(
        text("INSERT INTO alembic_version (version_num) VALUES (:v)"),
        {"v": version},
    )
    db.commit()

    resp = client.get("/health/deep")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["migration"]["alembic_version"] == version

    db.execute(text("DROP TABLE IF EXISTS alembic_version"))
    db.commit()


def test_deep_health_error_when_migration_version_mismatch(client, db):
    from sqlalchemy import text

    from app.api.routes.health import _expected_alembic_heads

    heads = _expected_alembic_heads()
    if len(heads) != 1:
        pytest.skip("multi-head migrations not supported in this test")

    db.execute(
        text(
            "CREATE TABLE IF NOT EXISTS alembic_version "
            "(version_num VARCHAR(32) NOT NULL)"
        )
    )
    db.execute(text("DELETE FROM alembic_version"))
    db.execute(
        text("INSERT INTO alembic_version (version_num) VALUES ('wrong_revision')")
    )
    db.commit()

    try:
        resp = client.get("/health/deep")
        assert resp.status_code == 503
        body = resp.json()
        assert body["status"] == "error"
        assert body["migration"]["alembic_version"] == "wrong_revision"
    finally:
        db.execute(text("DROP TABLE IF EXISTS alembic_version"))
        db.commit()
