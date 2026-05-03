"""種子假資料。

- ``run_if_empty``：後端 startup 呼叫，若 **尚無使用者** 則灌入一次。
- ``reset_and_seed_demo``：**不會**被 API / 排程 / startup 自動呼叫，
  僅供你用 ``scripts/dev_reseed_demo.py`` 在終端機 **手動、一次性**重灌開發資料庫。
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.base import Base
from app.models.department import Department
from app.models.event import Event
from app.models.event_department import EventDepartment
from app.models.role import Role
from app.models.safety_response import SafetyResponse
from app.models.user import User
from app.models.user_role import UserRole
from app.seeding import ids

_SKIP_TRUNCATE_TABLES = frozenset({"roles", "alembic_version"})


def _role_id(db: Session, name: str) -> uuid.UUID:
    rid = db.execute(select(Role.role_id).where(Role.role_name == name)).scalar_one()
    return rid


def clear_demo_tables_keep_roles(db: Session) -> None:
    """清空業務資料，保留 migrations 種入的 roles。"""
    import app.models as _models  # noqa: F401 — 載入 Notification 等，註冊至 metadata

    q = ", ".join(
        f'"{t.name}"' for t in Base.metadata.sorted_tables if t.name not in _SKIP_TRUNCATE_TABLES
    )
    if not q:
        raise RuntimeError("No tables to truncate (metadata empty?)")
    db.execute(text(f"TRUNCATE TABLE {q} CASCADE"))
    db.commit()


def insert_demo_entities(db: Session) -> None:
    """寫入與 ids.py 對齊的假資料（假設 roles 已存在）。"""
    role_employee = _role_id(db, "employee")
    role_supervisor = _role_id(db, "supervisor")
    role_admin = _role_id(db, "admin")

    depts = [
        Department(department_id=ids.D_RD, department_name="R&D", parent_department_id=None, manager_id=None),
        Department(department_id=ids.D_HR, department_name="HR", parent_department_id=None, manager_id=None),
        Department(department_id=ids.D_OPS, department_name="Operations", parent_department_id=None, manager_id=None),
        Department(department_id=ids.D_FAC, department_name="Facilities", parent_department_id=None, manager_id=None),
        Department(
            department_id=ids.D_PLANT_A,
            department_name="Plant A",
            parent_department_id=ids.D_OPS,
            manager_id=None,
        ),
        Department(
            department_id=ids.D_LINE1,
            department_name="Plant A - Line 1",
            parent_department_id=ids.D_PLANT_A,
            manager_id=None,
        ),
        Department(
            department_id=ids.D_LINE2,
            department_name="Plant A - Line 2",
            parent_department_id=ids.D_PLANT_A,
            manager_id=None,
        ),
    ]
    for d in depts:
        db.merge(d)

    # Insert order must satisfy fk_users_manager_id (manager row must exist first).
    users_spec = [
        (ids.U_04, "ADM001", "Admin User", "admin@company.com", ids.D_OPS, None),
        (ids.U_02, "EMP002", "Jeffery Liao", "jeffery@company.com", ids.D_RD, ids.U_04),
        (ids.U_03, "EMP003", "Kelly Lin", "kelly@company.com", ids.D_HR, ids.U_04),
        (ids.U_07, "EMP007", "Victor Hsu", "victor@company.com", ids.D_LINE1, ids.U_04),
        (ids.U_01, "EMP001", "Maggie Pan", "maggie.pan@company.com", ids.D_RD, ids.U_02),
        (ids.U_05, "EMP005", "David Wang", "david@company.com", ids.D_RD, ids.U_02),
        (ids.U_06, "EMP006", "Annie Liu", "annie@company.com", ids.D_HR, ids.U_03),
    ]

    role_map = {
        ids.U_01: [role_employee],
        ids.U_02: [role_employee, role_supervisor, role_admin],
        ids.U_03: [role_supervisor],
        ids.U_04: [role_admin],
        ids.U_05: [role_employee],
        ids.U_06: [role_employee],
        ids.U_07: [role_employee],
    }

    for uid, emp_no, name, email, dept_id, mgr_id in users_spec:
        db.merge(
            User(
                user_id=uid,
                employee_no=emp_no,
                name=name,
                email=email,
                department_id=dept_id,
                manager_id=mgr_id,
                status="active",
            )
        )
        db.flush()
        for rid in role_map[uid]:
            db.merge(UserRole(user_id=uid, role_id=rid))

    ev_specs = [
        (
            ids.E_001,
            "Earthquake Safety Check",
            "Earthquake",
            "M5+ earthquake detected in northern region. Report your status now.",
            "active",
            datetime(2026, 5, 1, 15, 0, tzinfo=timezone.utc),
            [ids.D_RD, ids.D_HR, ids.D_OPS, ids.D_FAC],
        ),
        (
            ids.E_004,
            "Fire Drill Check",
            "Fire",
            "Scheduled fire evacuation drill.",
            "active",
            datetime(2026, 5, 3, 4, 30, tzinfo=timezone.utc),
            [ids.D_RD, ids.D_OPS],
        ),
        (
            ids.E_002,
            "Typhoon Safety Check",
            "Typhoon",
            "Typhoon warning raised. Confirm current working location and safety.",
            "active",
            datetime(2026, 5, 3, 8, 0, tzinfo=timezone.utc),
            [ids.D_RD, ids.D_FAC],
        ),
        (
            ids.E_003,
            "Annual Evacuation Drill",
            "Other",
            "Company-wide evacuation drill concluded.",
            "closed",
            datetime(2026, 3, 15, 6, 30, tzinfo=timezone.utc),
            [ids.D_RD, ids.D_HR, ids.D_OPS],
        ),
        (
            ids.E_007,
            "Flood Response Check",
            "Other",
            "Heavy rainfall event — response window closed.",
            "closed",
            datetime(2026, 4, 20, 7, 45, tzinfo=timezone.utc),
            [ids.D_RD, ids.D_OPS, ids.D_FAC],
        ),
    ]
    for eid, title, etype, desc, estatus, start_t, dept_ids in ev_specs:
        db.merge(
            Event(
                event_id=eid,
                title=title,
                event_type=etype,
                description=desc,
                status=estatus,
                created_by=ids.U_04,
                start_time=start_t,
            )
        )
        db.flush()
        for did in dept_ids:
            db.add(EventDepartment(event_id=eid, department_id=did))

    rsp_data = [
        (ids.U_01, ids.E_001, "safe", "I'm safe. Minor shaking, everything is normal now.", "Building A, 3rd Floor, Lab 2"),
        (ids.U_01, ids.E_004, "need_help", "Need guidance at assembly point.", None),
        (ids.U_05, ids.E_001, "need_help", "Minor injury near stairs", None),
        (ids.U_07, ids.E_001, "safe", "Plant A assembly point", None),
        (ids.U_01, ids.E_003, "safe", "Evacuated with team.", None),
        (ids.U_05, ids.E_003, "safe", "No issue", None),
        (ids.U_01, ids.E_007, "safe", "Area cleared.", None),
        (ids.U_05, ids.E_004, "safe", "Production floor evacuated", None),
        (ids.U_05, ids.E_002, "safe", "WFH safe", None),
    ]
    for uid, eid, st, comment, loc in rsp_data:
        db.add(
            SafetyResponse(
                response_id=uuid.uuid4(),
                event_id=eid,
                user_id=uid,
                status=st,
                comment=comment,
                location=loc,
                responded_at=datetime.now(timezone.utc),
            )
        )

    db.commit()


def reset_and_seed_demo(db: Session) -> None:
    """刪除業務資料表列並重灌種子；**無路由、無常駐程序**，僅由開發 CLI 手動呼叫。"""
    from app.core.config import settings

    if settings.env.lower() in ("production", "prod"):
        raise RuntimeError(
            '拒絕在 production 執行重灌。將 backend .env 的 env 調成 development，'
            "或確認你不在正式環境執行此腳本。"
        )
    clear_demo_tables_keep_roles(db)
    insert_demo_entities(db)


def run_if_empty(db: Session) -> bool:
    """Return True if seeding ran."""
    n = db.execute(select(func.count()).select_from(User)).scalar_one()
    if n and n > 0:
        return False
    insert_demo_entities(db)
    return True
