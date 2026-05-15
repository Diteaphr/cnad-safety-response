"""
Repository-level tests for Step 2: expand_subtree + EventRepository targeting.

Tests work directly against the DB session — no HTTP client needed.
API-level tests will be added in Step 3.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest

from app.repositories.department_repository import DepartmentRepository
from app.repositories.event_repository import EventRepository

dept_repo = DepartmentRepository()
event_repo = EventRepository()


# ---------------------------------------------------------------------------
# DepartmentRepository.expand_subtree
# ---------------------------------------------------------------------------

def test_expand_subtree_empty_list(db):
    result = dept_repo.expand_subtree(db, [])
    assert result == []


def test_expand_subtree_leaf_dept(db, make_department):
    dept = make_department("Leaf")
    result = dept_repo.expand_subtree(db, [dept.department_id])
    assert dept.department_id in result
    assert len(result) == 1


def test_expand_subtree_includes_children(db, make_department):
    parent = make_department("Parent")
    child = make_department("Child", parent_id=parent.department_id)

    result = dept_repo.expand_subtree(db, [parent.department_id])
    result_set = set(result)

    assert parent.department_id in result_set
    assert child.department_id in result_set


def test_expand_subtree_deep_tree(db, make_department):
    """Three-level tree: root → mid → leaf; selecting root gives all three."""
    root = make_department("Root")
    mid = make_department("Mid", parent_id=root.department_id)
    leaf = make_department("Leaf", parent_id=mid.department_id)

    result_set = set(dept_repo.expand_subtree(db, [root.department_id]))

    assert root.department_id in result_set
    assert mid.department_id in result_set
    assert leaf.department_id in result_set


def test_expand_subtree_sibling_not_included(db, make_department):
    """Selecting one branch does not include a sibling branch."""
    parent = make_department("Parent")
    branch_a = make_department("Branch A", parent_id=parent.department_id)
    branch_b = make_department("Branch B", parent_id=parent.department_id)

    result_set = set(dept_repo.expand_subtree(db, [branch_a.department_id]))

    assert branch_a.department_id in result_set
    assert branch_b.department_id not in result_set
    assert parent.department_id not in result_set


def test_expand_subtree_multiple_roots(db, make_department):
    dept_a = make_department("A")
    dept_b = make_department("B")
    child_b = make_department("B-child", parent_id=dept_b.department_id)

    result_set = set(dept_repo.expand_subtree(db, [dept_a.department_id, dept_b.department_id]))

    assert dept_a.department_id in result_set
    assert dept_b.department_id in result_set
    assert child_b.department_id in result_set


# ---------------------------------------------------------------------------
# EventRepository.create with target_department_ids
# ---------------------------------------------------------------------------

def test_create_event_no_target_departments(db, make_event):
    ev = make_event()
    loaded = event_repo.get_by_id(db, ev.event_id)
    assert loaded is not None
    assert loaded.target_departments == []


def test_create_event_with_target_departments(db, make_department, make_user):
    from app.seeding import ids as seed_ids

    admin = make_user(email="admin@test.com", role="admin")
    dept_a = make_department("Dept A")
    dept_b = make_department("Dept B")

    ev = event_repo.create(
        db,
        title="Targeted Event",
        event_type_id=seed_ids.ET_EARTHQUAKE,
        description="desc",
        location=None,
        status="active",
        created_by=admin.user_id,
        start_time=datetime.now(timezone.utc),
        target_department_ids=[dept_a.department_id, dept_b.department_id],
    )
    db.commit()

    loaded = event_repo.get_by_id(db, ev.event_id)
    assert loaded is not None
    ids = {d.department_id for d in loaded.target_departments}
    assert dept_a.department_id in ids
    assert dept_b.department_id in ids


# ---------------------------------------------------------------------------
# EventRepository.update with target_department_ids
# ---------------------------------------------------------------------------

def test_update_event_replaces_target_departments(db, make_event, make_department):
    dept_old = make_department("Old Dept")
    dept_new = make_department("New Dept")
    ev = make_event(target_department_ids=[dept_old.department_id])

    event_repo.update(
        db,
        ev.event_id,
        title=ev.title,
        event_type_id=ev.event_type_id,
        description=ev.description,
        location=ev.location,
        start_time=ev.start_time,
        target_department_ids=[dept_new.department_id],
    )
    db.commit()

    loaded = event_repo.get_by_id(db, ev.event_id)
    ids = {d.department_id for d in loaded.target_departments}
    assert dept_new.department_id in ids
    assert dept_old.department_id not in ids


def test_update_event_clears_target_departments_with_empty_list(db, make_event, make_department):
    dept = make_department("Some Dept")
    ev = make_event(target_department_ids=[dept.department_id])

    event_repo.update(
        db,
        ev.event_id,
        title=ev.title,
        event_type_id=ev.event_type_id,
        description=ev.description,
        location=ev.location,
        start_time=ev.start_time,
        target_department_ids=[],  # company-wide
    )
    db.commit()

    loaded = event_repo.get_by_id(db, ev.event_id)
    assert loaded.target_departments == []


def test_update_event_none_target_department_ids_leaves_existing(db, make_event, make_department):
    """Passing target_department_ids=None (default) must not touch existing join rows."""
    dept = make_department("Preserved Dept")
    ev = make_event(target_department_ids=[dept.department_id])

    event_repo.update(
        db,
        ev.event_id,
        title="Updated Title",
        event_type_id=ev.event_type_id,
        description=ev.description,
        location=ev.location,
        start_time=ev.start_time,
        # target_department_ids not passed → None → no change
    )
    db.commit()

    loaded = event_repo.get_by_id(db, ev.event_id)
    ids = {d.department_id for d in loaded.target_departments}
    assert dept.department_id in ids


# ---------------------------------------------------------------------------
# list_all loads target_departments eagerly (no lazy-load N+1)
# ---------------------------------------------------------------------------

def test_list_all_loads_target_departments(db, make_event, make_department):
    dept = make_department("Eng")
    make_event(target_department_ids=[dept.department_id])
    make_event()  # company-wide event

    events = event_repo.list_all(db)
    assert len(events) == 2
    targeted = [e for e in events if e.target_departments]
    assert len(targeted) == 1
    assert targeted[0].target_departments[0].department_id == dept.department_id
