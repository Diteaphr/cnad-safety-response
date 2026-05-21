"""
Model-level tests for event_target_departments join table (Step 1).

These tests work directly against the DB session — no HTTP client needed.
API-level targeting tests will be added in Step 3.
"""
from __future__ import annotations

import uuid

from sqlalchemy import text


def test_event_has_empty_target_departments_by_default(db, make_event):
    ev = make_event()
    db.refresh(ev)
    assert ev.target_departments == []


def test_make_event_with_one_target_department(db, make_event, make_department):
    dept = make_department("Engineering")
    ev = make_event(target_department_ids=[dept.department_id])
    db.refresh(ev)

    assert len(ev.target_departments) == 1
    assert ev.target_departments[0].department_id == dept.department_id


def test_make_event_with_multiple_target_departments(db, make_event, make_department):
    dept_a = make_department("Dept A")
    dept_b = make_department("Dept B")
    dept_c = make_department("Dept C")
    ev = make_event(target_department_ids=[dept_a.department_id, dept_b.department_id, dept_c.department_id])
    db.refresh(ev)

    ids = {d.department_id for d in ev.target_departments}
    assert dept_a.department_id in ids
    assert dept_b.department_id in ids
    assert dept_c.department_id in ids


def test_event_target_departments_persist_across_sessions(db, make_event, make_department):
    """Join rows survive a session refresh (not just in-memory)."""
    dept = make_department("Ops")
    ev = make_event(target_department_ids=[dept.department_id])
    event_id = ev.event_id

    db.expire_all()
    from app.models.event import Event
    reloaded = db.get(Event, event_id)
    assert reloaded is not None
    assert len(reloaded.target_departments) == 1
    assert reloaded.target_departments[0].department_id == dept.department_id


def test_event_target_departments_cascade_on_event_delete(db, make_event, make_department):
    """Deleting the event removes its join rows."""
    dept = make_department("Finance")
    ev = make_event(target_department_ids=[dept.department_id])
    event_id = ev.event_id

    db.delete(ev)
    db.commit()

    count = db.execute(
        text("SELECT COUNT(*) FROM event_target_departments WHERE event_id = :eid"),
        {"eid": str(event_id)},
    ).scalar()
    assert count == 0


def test_event_target_departments_cascade_on_department_delete(db, make_event, make_department):
    """Deleting a department removes its join rows (no orphan FK error)."""
    dept = make_department("Marketing")
    ev = make_event(target_department_ids=[dept.department_id])
    dept_id = dept.department_id

    db.delete(dept)
    db.commit()

    count = db.execute(
        text("SELECT COUNT(*) FROM event_target_departments WHERE department_id = :did"),
        {"did": str(dept_id)},
    ).scalar()
    assert count == 0
