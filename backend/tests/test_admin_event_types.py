"""
Integration tests for admin event type management:
  POST /api/admin/event-types — create event type (admin only)
"""
from __future__ import annotations

import pytest

from tests.conftest import auth_headers

ADMIN_EVENT_TYPES = "/api/admin/event-types"


def test_admin_create_event_type_success(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.post(
        ADMIN_EVENT_TYPES,
        json={"name": "Industrial Accident"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Industrial Accident"
    assert "id" in body
    assert "code" in body


def test_admin_create_event_type_code_is_slugified(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.post(
        ADMIN_EVENT_TYPES,
        json={"name": "Gas Leak Alert"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    assert resp.json()["code"] == "gas_leak_alert"


def test_admin_create_event_type_duplicate_name(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    client.post(ADMIN_EVENT_TYPES, json={"name": "Flood"}, headers=auth_headers(admin))

    resp = client.post(
        ADMIN_EVENT_TYPES,
        json={"name": "Flood"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 409


def test_admin_create_event_type_duplicate_case_insensitive(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    client.post(ADMIN_EVENT_TYPES, json={"name": "Flood"}, headers=auth_headers(admin))

    resp = client.post(
        ADMIN_EVENT_TYPES,
        json={"name": "flood"},
        headers=auth_headers(admin),
    )

    assert resp.status_code == 409


def test_admin_create_event_type_appears_in_list(client, make_user):
    admin = make_user(email="admin@test.com", role="admin")
    client.post(
        ADMIN_EVENT_TYPES,
        json={"name": "Chemical Spill"},
        headers=auth_headers(admin),
    )

    resp = client.get("/api/event-types")
    names = [et["name"] for et in resp.json()["eventTypes"]]
    assert "Chemical Spill" in names


def test_admin_create_event_type_forbidden_for_employee(client, make_user):
    emp = make_user(email="emp@test.com", role="employee")

    resp = client.post(
        ADMIN_EVENT_TYPES,
        json={"name": "New Type"},
        headers=auth_headers(emp),
    )

    assert resp.status_code == 403


def test_admin_create_event_type_forbidden_for_supervisor(client, make_user):
    sup = make_user(email="sup@test.com", role="supervisor")

    resp = client.post(
        ADMIN_EVENT_TYPES,
        json={"name": "New Type"},
        headers=auth_headers(sup),
    )

    assert resp.status_code == 403


def test_admin_create_event_type_unauthenticated(client):
    resp = client.post(ADMIN_EVENT_TYPES, json={"name": "New Type"})
    assert resp.status_code in (401, 403)
