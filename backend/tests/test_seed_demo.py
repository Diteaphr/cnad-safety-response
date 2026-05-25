from __future__ import annotations

from sqlalchemy import select

from app.models.department import Department
from app.repositories.user_repository import UserRepository
from app.seeding import ids
from app.seeding.seed_demo import reset_and_seed_demo
from app.services.portal_service import PortalService


def _depth_by_department(depts: list[Department]) -> dict[object, int]:
    by_id = {d.department_id: d for d in depts}
    depths: dict[object, int] = {}

    for dept in depts:
        depth = 0
        seen = set()
        current = dept
        while current.parent_department_id is not None:
            assert current.department_id not in seen
            seen.add(current.department_id)
            depth += 1
            current = by_id[current.parent_department_id]
        depths[dept.department_id] = depth

    return depths


def test_reset_and_seed_demo_builds_flatter_semiconductor_department_tree(db, roles):
    reset_and_seed_demo(db)

    depts = list(db.scalars(select(Department).order_by(Department.department_name)).all())
    by_id = {d.department_id: d for d in depts}
    depths = _depth_by_department(depts)

    assert len(depts) == 10
    assert {d.department_name for d in depts} == {
        "總管理處",
        "晶圓製造處",
        "製程與模組研發處",
        "先進封裝處",
        "品質與可靠性處",
        "資訊技術與資料工程處",
        "材料管理與供應鏈處",
        "人力資源與訓練處",
        "環安衛與設施處",
        "客戶工程與技術支援處",
    }
    assert max(depths.values()) <= 2
    assert sum(1 for d in depts if d.parent_department_id is not None) >= 2

    assert by_id[ids.D1].manager_id == ids.user_key(1)
    assert by_id[ids.D4].parent_department_id == ids.D2
    assert by_id[ids.D10].parent_department_id == ids.D7
    assert by_id[ids.D3].manager_id == ids.user_key(3)
    assert by_id[ids.D6].manager_id == ids.user_key(4)


def test_reset_and_seed_demo_preserves_demo_personas_and_reporting_chain(db, roles):
    reset_and_seed_demo(db)

    accounts = {row["id"]: row["userId"] for row in PortalService().demo_accounts()}
    users = UserRepository()

    assert accounts == {
        "employee": str(ids.user_key(2)),
        "supervisor": str(ids.user_key(3)),
        "admin": str(ids.user_key(1)),
        "multi": str(ids.user_key(4)),
    }

    assert users.get_primary_department_id(db, ids.user_key(2)) == ids.D3
    assert users.derived_manager_id(db, ids.user_key(2)) == ids.user_key(3)

    assert users.get_primary_department_id(db, ids.user_key(14)) == ids.D4
    assert users.derived_manager_id(db, ids.user_key(14)) == ids.user_key(5)

    assert users.get_primary_department_id(db, ids.user_key(13)) == ids.D10
    assert users.derived_manager_id(db, ids.user_key(13)) == ids.user_key(11)
