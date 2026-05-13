"""
Integration tests for:
  GET /api/dashboard/supervisor?event_id=...
  GET /api/dashboard/admin?event_id=...

Key scenarios:
- With event_id → returns data for that specific event
- Without event_id → falls back to most recent active event
- Wrong role → 403
- Non-existent event_id → 404
"""
from __future__ import annotations

import pytest

from tests.conftest import auth_headers

SUP_DASH = "/api/dashboard/supervisor"
ADM_DASH = "/api/dashboard/admin"
REPORTS = "/api/reports"


# ---------------------------------------------------------------------------
# Supervisor dashboard
# ---------------------------------------------------------------------------

def test_supervisor_dashboard_with_event_id(client, make_user, make_event):
    sup = make_user(email="sup@test.com", role="supervisor")
    event = make_event(title="Target Event", status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["event"]["id"] == str(event.event_id)
    assert body["event"]["title"] == "Target Event"


def test_supervisor_dashboard_event_id_overrides_latest(client, make_user, make_event):
    """When event_id is given, dashboard must use that event even if another is newer."""
    sup = make_user(email="sup@test.com", role="supervisor")
    older_event = make_event(title="Older Event", status="active")
    newer_event = make_event(title="Newer Event", status="active")

    # Without event_id → newest active event (newer_event)
    resp_default = client.get(SUP_DASH, headers=auth_headers(sup))
    assert resp_default.json()["event"]["title"] == "Newer Event"

    # With event_id → the specific older event
    resp_specific = client.get(
        SUP_DASH,
        params={"event_id": str(older_event.event_id)},
        headers=auth_headers(sup),
    )
    assert resp_specific.json()["event"]["id"] == str(older_event.event_id)
    assert resp_specific.json()["event"]["title"] == "Older Event"


def test_supervisor_dashboard_without_event_id_uses_latest_active(client, make_user, make_event):
    sup = make_user(email="sup@test.com", role="supervisor")
    make_event(title="Old Event", status="closed")
    make_event(title="Active Event", status="active")

    resp = client.get(SUP_DASH, headers=auth_headers(sup))
    assert resp.status_code == 200
    assert resp.json()["event"]["title"] == "Active Event"


def test_supervisor_dashboard_no_active_event(client, make_user, make_event):
    sup = make_user(email="sup@test.com", role="supervisor")
    make_event(status="closed")

    resp = client.get(SUP_DASH, headers=auth_headers(sup))
    assert resp.status_code == 200
    assert resp.json()["event"] is None


def test_supervisor_dashboard_event_id_not_found_404(client, make_user):
    import uuid
    sup = make_user(email="sup@test.com", role="supervisor")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(uuid.uuid4())},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 404


def test_supervisor_dashboard_employee_role_403(client, make_user, make_event):
    emp = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(emp),
    )
    assert resp.status_code == 403


def test_supervisor_dashboard_shows_team_reports(client, make_user, make_event):
    """KPIs reflect subordinates' actual report status."""
    sup = make_user(email="sup@test.com", role="supervisor")
    emp = make_user(email="emp@test.com", role="employee", manager_id=sup.user_id)
    event = make_event(status="active")

    client.post(
        REPORTS,
        json={"eventId": str(event.event_id), "userId": str(emp.user_id), "status": "safe"},
        headers=auth_headers(emp),
    )

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["kpis"]["safe"] == 1
    assert body["kpis"]["pending"] == 0
    assert len(body["team"]) == 1
    assert body["team"][0]["status"] == "safe"


# ---------------------------------------------------------------------------
# Supervisor dashboard — hierarchical KPI + direct-only team list
# ---------------------------------------------------------------------------

def test_supervisor_kpi_includes_indirect_subordinates(client, make_user, make_event):
    """KPI total must count employees 2 levels deep even though team list is direct-only."""
    sup = make_user(email="sup@test.com", role="supervisor")
    mid = make_user(email="mid@test.com", role="supervisor", manager_id=sup.user_id)
    _emp = make_user(email="emp@test.com", role="employee", manager_id=mid.user_id)
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["kpis"]["total"] == 1
    assert body["kpis"]["pending"] == 1


def test_supervisor_kpi_three_levels_deep(client, make_user, make_event):
    """KPI must count employees 3+ levels deep."""
    sup = make_user(email="sup@test.com", role="supervisor")
    mid1 = make_user(email="mid1@test.com", role="supervisor", manager_id=sup.user_id)
    mid2 = make_user(email="mid2@test.com", role="supervisor", manager_id=mid1.user_id)
    _emp = make_user(email="emp@test.com", role="employee", manager_id=mid2.user_id)
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 200
    assert resp.json()["kpis"]["total"] == 1


def test_supervisor_team_is_direct_only(client, make_user, make_event):
    """team list contains only direct reports; indirect employees appear in KPI but not team."""
    sup = make_user(email="sup@test.com", role="supervisor")
    direct_emp = make_user(email="direct@test.com", role="employee", manager_id=sup.user_id)
    mid = make_user(email="mid@test.com", role="supervisor", manager_id=sup.user_id)
    indirect_emp = make_user(email="indirect@test.com", role="employee", manager_id=mid.user_id)
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 200
    body = resp.json()
    team_ids = {m["user_id"] for m in body["team"]}
    # direct employee appears in team
    assert str(direct_emp.user_id) in team_ids
    # indirect employee does NOT appear in team (only in KPI)
    assert str(indirect_emp.user_id) not in team_ids
    # KPI counts both employees
    assert body["kpis"]["total"] == 2


def test_supervisor_team_shows_sub_team_summary_for_supervisor(client, make_user, make_event):
    """A direct-report supervisor entry must include sub_team_summary with KPI counts."""
    sup = make_user(email="sup@test.com", role="supervisor")
    mid = make_user(email="mid@test.com", role="supervisor", manager_id=sup.user_id)
    _emp = make_user(email="emp@test.com", role="employee", manager_id=mid.user_id)
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 200
    team = resp.json()["team"]
    mid_entry = next(m for m in team if m["user_id"] == str(mid.user_id))
    assert mid_entry["is_supervisor"] is True
    assert mid_entry["sub_team_summary"]["total"] == 1
    assert mid_entry["sub_team_summary"]["pending"] == 1


def test_supervisor_unrelated_employees_not_in_kpi(client, make_user, make_event):
    """Employees outside the reporting chain must not affect KPI counts."""
    sup = make_user(email="sup@test.com", role="supervisor")
    other_sup = make_user(email="other_sup@test.com", role="supervisor")
    _emp_other = make_user(email="emp@test.com", role="employee", manager_id=other_sup.user_id)
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 200
    assert resp.json()["kpis"]["total"] == 0


# ---------------------------------------------------------------------------
# Supervisor dashboard — view_as drill-down
# ---------------------------------------------------------------------------

def test_view_as_shows_subordinate_manager_team(client, make_user, make_event):
    """view_as lets a supervisor drill into a sub-manager's direct team."""
    sup = make_user(email="sup@test.com", role="supervisor")
    mid = make_user(email="mid@test.com", role="supervisor", manager_id=sup.user_id)
    emp = make_user(email="emp@test.com", role="employee", manager_id=mid.user_id)
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id), "view_as": str(mid.user_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 200
    body = resp.json()
    team_ids = {m["user_id"] for m in body["team"]}
    assert str(emp.user_id) in team_ids
    assert body["view_as"] == str(mid.user_id)


def test_view_as_kpi_scoped_to_target_manager(client, make_user, make_event):
    """KPI when view_as is set covers only target manager's subtree, not the whole org."""
    sup = make_user(email="sup@test.com", role="supervisor")
    mid = make_user(email="mid@test.com", role="supervisor", manager_id=sup.user_id)
    _emp_mid = make_user(email="emp_mid@test.com", role="employee", manager_id=mid.user_id)
    _emp_sup = make_user(email="emp_sup@test.com", role="employee", manager_id=sup.user_id)
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id), "view_as": str(mid.user_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 200
    # mid's subtree has only 1 employee; sup's direct employee is excluded
    assert resp.json()["kpis"]["total"] == 1


def test_view_as_unauthorized_manager_403(client, make_user, make_event):
    """view_as with a manager outside the actor's chain must return 403."""
    sup = make_user(email="sup@test.com", role="supervisor")
    other_sup = make_user(email="other@test.com", role="supervisor")
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id), "view_as": str(other_sup.user_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 403


def test_view_as_not_found_404(client, make_user, make_event):
    import uuid as _uuid
    sup = make_user(email="sup@test.com", role="supervisor")
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id), "view_as": str(_uuid.uuid4())},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Admin dashboard
# ---------------------------------------------------------------------------

def test_admin_dashboard_with_event_id(client, make_user, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    event = make_event(title="Admin Target", status="active")

    resp = client.get(
        ADM_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["event"]["id"] == str(event.event_id)
    assert body["event"]["title"] == "Admin Target"


def test_admin_dashboard_event_id_overrides_latest(client, make_user, make_event):
    admin = make_user(email="admin@test.com", role="admin")
    older_event = make_event(title="Older", status="active")
    _newer_event = make_event(title="Newer", status="active")

    resp = client.get(
        ADM_DASH,
        params={"event_id": str(older_event.event_id)},
        headers=auth_headers(admin),
    )
    assert resp.json()["event"]["id"] == str(older_event.event_id)


def test_admin_dashboard_event_id_not_found_404(client, make_user):
    import uuid
    admin = make_user(email="admin@test.com", role="admin")

    resp = client.get(
        ADM_DASH,
        params={"event_id": str(uuid.uuid4())},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 404


def test_admin_dashboard_employee_role_403(client, make_user, make_event):
    emp = make_user(email="emp@test.com", role="employee")
    event = make_event(status="active")

    resp = client.get(
        ADM_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(emp),
    )
    assert resp.status_code == 403


def test_admin_dashboard_unauthenticated(client):
    resp = client.get(ADM_DASH)
    assert resp.status_code in (401, 403)
