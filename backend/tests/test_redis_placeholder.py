"""Unit tests for optional Redis dashboard cache helpers."""

from __future__ import annotations

import uuid

import pytest

from app.services.integrations import redis_placeholder as redis_cache

pytestmark = pytest.mark.no_db


def test_dashboard_cache_no_ops_when_redis_disabled(monkeypatch):
    monkeypatch.setattr("app.services.integrations.redis_placeholder.settings.redis_enabled", False)
    key = f"test:{uuid.uuid4()}"
    redis_cache.refresh_dashboard_statistics()
    assert redis_cache.get_dashboard_cache(key) is None
    redis_cache.set_dashboard_cache(key, {"ok": True})
    assert redis_cache.get_dashboard_cache(key) is None


def test_dashboard_cache_roundtrip_when_redis_mocked(monkeypatch):
    monkeypatch.setattr("app.services.integrations.redis_placeholder.settings.redis_enabled", True)
    store: dict[str, bytes] = {}

    class FakeRedis:
        def delete(self, *keys):
            for k in keys:
                store.pop(k, None)

        def get(self, key):
            return store.get(key)

        def setex(self, key, ttl, value):
            store[key] = value

        def close(self):
            pass

    monkeypatch.setattr("redis.from_url", lambda _url: FakeRedis())
    event_id = str(uuid.uuid4())
    key = f"dashboard:event:{event_id}"
    payload = {"safe": 1, "need_help": 0}
    redis_cache.set_dashboard_cache(key, payload, ttl=60)
    assert redis_cache.get_dashboard_cache(key) == payload
    redis_cache.refresh_dashboard_statistics(event_id)
    assert redis_cache.get_dashboard_cache(key) is None


def test_dashboard_cache_read_returns_none_when_redis_raises(monkeypatch):
    monkeypatch.setattr("app.services.integrations.redis_placeholder.settings.redis_enabled", True)

    def boom(_url):
        raise ConnectionError("redis down")

    monkeypatch.setattr("redis.from_url", boom)
    assert redis_cache.get_dashboard_cache("any-key") is None
