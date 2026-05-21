"""
Integration tests for:
  GET /api/dashboard/supervisor?event_id=...
  GET /api/dashboard/admin?event_id=...

Org model: users belong to departments via ``user_departments`` (primary row);
supervisor **team** roster uses the same rule as API ``managerId`` (derived line manager).
KPI subtree still uses departments rooted at ``departments.manager_id``.
"""
from __future__ import annotations

import pytest
import uuid

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

    resp_default = client.get(SUP_DASH, headers=auth_headers(sup))
    assert resp_default.json()["event"]["title"] == "Newer Event"

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


def test_supervisor_dashboard_shows_team_reports(client, make_user, make_department, make_event):
    """KPIs reflect subordinates' actual report status."""
    eng = make_department("Engineering")
    sup = make_user(email="sup@test.com", role="supervisor", managed_department_id=eng.department_id)
    emp = make_user(email="emp@test.com", role="employee", department_id=eng.department_id)
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
# Supervisor dashboard — hierarchical KPI + line-report team list
# ---------------------------------------------------------------------------

def test_supervisor_kpi_includes_indirect_subordinates(client, make_user, make_department, make_event):
    """KPI total counts employees in child departments under the supervisor's managed subtree."""
    root = make_department("Root")
    child = make_department("Child", parent_id=root.department_id)
    sup = make_user(email="sup@test.com", role="supervisor", managed_department_id=root.department_id)
    make_user(
        email="mid@test.com",
        role="supervisor",
        department_id=child.department_id,
        managed_department_id=child.department_id,
    )
    make_user(email="emp@test.com", role="employee", department_id=child.department_id)
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


def test_supervisor_kpi_three_levels_deep(client, make_user, make_department, make_event):
    root = make_department("Root")
    mid_dept = make_department("Mid", parent_id=root.department_id)
    leaf = make_department("Leaf", parent_id=mid_dept.department_id)
    sup = make_user(email="sup@test.com", role="supervisor", managed_department_id=root.department_id)
    make_user(
        email="mid1@test.com",
        role="supervisor",
        department_id=mid_dept.department_id,
        managed_department_id=mid_dept.department_id,
    )
    make_user(
        email="mid2@test.com",
        role="supervisor",
        department_id=leaf.department_id,
        managed_department_id=leaf.department_id,
    )
    make_user(email="emp@test.com", role="employee", department_id=leaf.department_id)
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 200
    assert resp.json()["kpis"]["total"] == 1


def test_supervisor_team_is_direct_only(client, make_user, make_department, make_event):
    """Team list: line reports (derived managerId); KPI still uses managed dept subtree."""
    root = make_department("Root")
    child = make_department("Child", parent_id=root.department_id)
    sup = make_user(email="sup@test.com", role="supervisor", managed_department_id=root.department_id)
    direct_emp = make_user(email="direct@test.com", role="employee", department_id=root.department_id)
    mid = make_user(
        email="mid@test.com",
        role="supervisor",
        department_id=root.department_id,
        managed_department_id=child.department_id,
    )
    indirect_emp = make_user(email="indirect@test.com", role="employee", department_id=child.department_id)
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 200
    body = resp.json()
    team_ids = {m["user_id"] for m in body["team"]}
    assert str(direct_emp.user_id) in team_ids
    assert str(mid.user_id) in team_ids
    assert str(indirect_emp.user_id) not in team_ids
    assert body["kpis"]["total"] == 2


def test_supervisor_team_shows_sub_team_summary_for_supervisor(client, make_user, make_department, make_event):
    root = make_department("Root")
    child = make_department("Child", parent_id=root.department_id)
    sup = make_user(email="sup@test.com", role="supervisor", managed_department_id=root.department_id)
    mid = make_user(
        email="mid@test.com",
        role="supervisor",
        department_id=root.department_id,
        managed_department_id=child.department_id,
    )
    make_user(email="emp@test.com", role="employee", department_id=child.department_id)
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


def test_supervisor_unrelated_employees_not_in_kpi(client, make_user, make_department, make_event):
    dept_a = make_department("A")
    dept_b = make_department("B")
    sup = make_user(email="sup@test.com", role="supervisor", managed_department_id=dept_a.department_id)
    make_user(
        email="other_sup@test.com",
        role="supervisor",
        managed_department_id=dept_b.department_id,
    )
    make_user(email="emp@test.com", role="employee", department_id=dept_b.department_id)
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

def test_view_as_shows_subordinate_manager_team(client, make_user, make_department, make_event):
    root = make_department("Root")
    child = make_department("Child", parent_id=root.department_id)
    sup = make_user(email="sup@test.com", role="supervisor", managed_department_id=root.department_id)
    mid = make_user(
        email="mid@test.com",
        role="supervisor",
        department_id=root.department_id,
        managed_department_id=child.department_id,
    )
    emp = make_user(email="emp@test.com", role="employee", department_id=child.department_id)
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


def test_view_as_kpi_scoped_to_target_manager(client, make_user, make_department, make_event):
    root = make_department("Root")
    child = make_department("Child", parent_id=root.department_id)
    sup = make_user(email="sup@test.com", role="supervisor", managed_department_id=root.department_id)
    mid = make_user(
        email="mid@test.com",
        role="supervisor",
        department_id=root.department_id,
        managed_department_id=child.department_id,
    )
    make_user(email="emp_mid@test.com", role="employee", department_id=child.department_id)
    make_user(email="emp_sup@test.com", role="employee", department_id=root.department_id)
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id), "view_as": str(mid.user_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 200
    assert resp.json()["kpis"]["total"] == 1


def test_view_as_unauthorized_manager_403(client, make_user, make_department, make_event):
    ds = make_department("S")
    do = make_department("O")
    sup = make_user(email="sup@test.com", role="supervisor", managed_department_id=ds.department_id)
    other_sup = make_user(
        email="other@test.com",
        role="supervisor",
        managed_department_id=do.department_id,
    )
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id), "view_as": str(other_sup.user_id)},
        headers=auth_headers(sup),
    )
    assert resp.status_code == 403


def test_view_as_not_found_404(client, make_user, make_event):
    sup = make_user(email="sup@test.com", role="supervisor")
    event = make_event(status="active")

    resp = client.get(
        SUP_DASH,
        params={"event_id": str(event.event_id), "view_as": str(uuid.uuid4())},
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


# ---------------------------------------------------------------------------
# Admin KPI — event department targeting scope
# ---------------------------------------------------------------------------

def test_admin_kpi_company_wide_counts_all_employees(client, make_user, make_department, make_event):
    """Event with no target departments counts every employee."""
    admin = make_user(email="admin@test.com", role="admin")
    dept_a = make_department("A")
    dept_b = make_department("B")
    make_user(email="e1@test.com", role="employee", department_id=dept_a.department_id)
    make_user(email="e2@test.com", role="employee", department_id=dept_b.department_id)
    event = make_event(status="active")  # no target depts → company-wide

    resp = client.get(
        ADM_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["kpis"]["targeted"] == 2


def test_admin_kpi_scoped_to_targeted_department(client, make_user, make_department, make_event):
    """Event targeting dept A should only count employees in dept A."""
    admin = make_user(email="admin@test.com", role="admin")
    dept_a = make_department("A")
    dept_b = make_department("B")
    make_user(email="ea@test.com", role="employee", department_id=dept_a.department_id)
    make_user(email="eb@test.com", role="employee", department_id=dept_b.department_id)
    event = make_event(
        status="active",
        target_department_ids=[dept_a.department_id],
    )

    resp = client.get(
        ADM_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["kpis"]["targeted"] == 1


def test_admin_kpi_targeted_dept_includes_children(client, make_user, make_department, make_event):
    """Targeting a parent department counts employees in child departments too."""
    admin = make_user(email="admin@test.com", role="admin")
    parent = make_department("Parent")
    child = make_department("Child", parent_id=parent.department_id)
    make_user(email="ep@test.com", role="employee", department_id=parent.department_id)
    make_user(email="ec@test.com", role="employee", department_id=child.department_id)
    make_user(email="eo@test.com", role="employee")  # no dept — not in scope
    # Expand subtree when creating the event so child is in event_target_departments
    event = make_event(
        status="active",
        target_department_ids=[parent.department_id, child.department_id],
    )

    resp = client.get(
        ADM_DASH,
        params={"event_id": str(event.event_id)},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["kpis"]["targeted"] == 2
