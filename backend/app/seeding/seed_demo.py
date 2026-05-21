"""種子假資料。

- ``run_if_empty``：後端 startup 呼叫，若 **尚無使用者** 則灌入一次。
- ``reset_and_seed_demo``：清空業務表（保留 roles）後重灌；請用 ``scripts/dev_reseed_demo.py`` 手動執行。
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.base import Base
from app.core.passwords import hash_password
from app.models.department import Department
from app.models.event import Event
from app.models.event_type import EventType
from app.models.role import Role
from app.models.safety_response import SafetyResponse
from app.models.user import User
from app.models.user_department import UserDepartment
from app.models.user_notification_preference import UserNotificationPreference
from app.models.user_role import UserRole
from app.seeding import ids

_SKIP_TRUNCATE_TABLES = frozenset({"roles", "alembic_version"})


def _role_id(db: Session, name: str) -> uuid.UUID:
    rid = db.execute(select(Role.role_id).where(Role.role_name == name)).scalar_one()
    return rid


def clear_demo_tables_keep_roles(db: Session) -> None:
    """清空業務資料，保留 migrations 種入的 roles。"""
    import app.models as _models  # noqa: F401

    q = ", ".join(
        f'"{t.name}"' for t in Base.metadata.sorted_tables if t.name not in _SKIP_TRUNCATE_TABLES
    )
    if not q:
        raise RuntimeError("No tables to truncate (metadata empty?)")
    db.execute(text(f"TRUNCATE TABLE {q} CASCADE"))
    db.commit()


def insert_demo_entities(db: Session) -> None:
    """1 管理員、50 員工、多層階層部門、5 進行中事件、1 已完成事件，與合理回報資料。

    部門樹（「上級部下級、下級再部下級」）::

        總公司(1)
        ├── 營運中心(2)
        │   └── 研發部(3)
        │       └── 軟體發展組(6)
        │           └── 後端技術課(7)
        │               └── 基礎設施小組(8)
        └── 事業拓展部(4)
            └── 客戶服務單位(5)
                └── 前線客服課(9)
                    └── 夜班應變中心(10)
    """
    role_employee = _role_id(db, "employee")
    role_supervisor = _role_id(db, "supervisor")
    role_admin = _role_id(db, "admin")

    pw = hash_password("password")

    # --- Departments（兩條深鏈；先插入上層再下層，parent 已存在）---
    for did, name, parent_n in (
        (1, "總公司", None),
        (2, "營運中心", 1),
        (3, "研發部", 2),
        (4, "事業拓展部", 1),
        (5, "客戶服務單位", 4),
        (6, "軟體發展組", 3),
        (7, "後端技術課", 6),
        (8, "基礎設施小組", 7),
        (9, "前線客服課", 5),
        (10, "夜班應變中心", 9),
    ):
        db.merge(
            Department(
                department_id=ids.dept_key(did),
                department_name=name,
                parent_department_id=ids.dept_key(parent_n) if parent_n else None,
                manager_id=None,
            )
        )

    # --- Users 1 = admin ; 2–51 = employee_1 … employee_50 ---
    # 2–6：各部門主管（employee + supervisor）；4 號另具 admin 供 multi demo
    # 7–51：一般員工
    def _email(uid: int) -> str:
        if uid == 1:
            return "admin@test.com"
        return f"employee_{uid - 1}@test.com"

    def _emp_no(uid: int) -> str:
        if uid == 1:
            return "ADM001"
        return f"EMP{uid - 1:03d}"

    def _name(uid: int) -> str:
        if uid == 1:
            return "系統管理員"
        return f"員工 {uid - 1}"

    # primary department：主管對應所屬層級；一般員工輪派至葉部門 5,7,8,9,10
    def _primary_dept(uid: int) -> int:
        if uid == 1:
            return 1
        if uid == 2:
            return 1
        if uid == 3:
            return 2
        if uid == 4:
            return 3
        if uid == 5:
            return 4
        if uid == 6:
            return 5
        if uid == 11:
            return 6
        if uid == 12:
            return 7
        if uid == 13:
            return 8
        if uid == 14:
            return 9
        if uid == 15:
            return 10
        leaf_cycle = (5, 7, 8, 9, 10)
        return leaf_cycle[(uid - 7) % len(leaf_cycle)]

    for uid in range(1, 52):
        db.merge(
            User(
                user_id=ids.user_key(uid),
                employee_no=_emp_no(uid),
                name=_name(uid),
                email=_email(uid),
                status="active",
                phone=f"+886900{uid:06d}" if uid > 1 else None,
                password_hash=pw,
            )
        )
        db.flush()
        db.add(
            UserDepartment(
                user_department_id=ids.user_department_key(uid),
                user_id=ids.user_key(uid),
                department_id=ids.dept_key(_primary_dept(uid)),
                is_primary=True,
            )
        )

        if uid == 1:
            roles = [role_admin]
        elif uid == 4:
            roles = [role_employee, role_supervisor, role_admin]
        elif uid in (2, 3, 5, 6, 11, 12, 13, 14, 15):
            roles = [role_employee, role_supervisor]
        else:
            roles = [role_employee]
        for rid in roles:
            db.merge(UserRole(user_id=ids.user_key(uid), role_id=rid))

    # 各部門主管（users 2–6 管 1–5 層；11–15 管深層下屬部門 6–10）
    for did, head_uid in (
        (1, 2),
        (2, 3),
        (3, 4),
        (4, 5),
        (5, 6),
        (6, 11),
        (7, 12),
        (8, 13),
        (9, 14),
        (10, 15),
    ):
        row = db.get(Department, ids.dept_key(did))
        if row is not None:
            row.manager_id = ids.user_key(head_uid)
    db.flush()

    for uid in range(1, 52):
        db.merge(UserNotificationPreference(user_id=ids.user_key(uid)))

    for tid, code, name in (
        (ids.ET_EARTHQUAKE, "earthquake", "Earthquake"),
        (ids.ET_TYPHOON, "typhoon", "Typhoon"),
        (ids.ET_FIRE, "fire", "Fire"),
        (ids.ET_OTHER, "other", "Other"),
    ):
        db.merge(EventType(event_type_id=tid, code=code, name=name))
    db.flush()

    et_cycle = (
        ids.ET_EARTHQUAKE,
        ids.ET_TYPHOON,
        ids.ET_FIRE,
        ids.ET_OTHER,
        ids.ET_EARTHQUAKE,
    )
    titles = (
        "地震應變通報（進行中）",
        "颱風假勤與安全確認（進行中）",
        "廠區火警演練回報（進行中）",
        "豪雨應變視窗（進行中）",
        "大規模停電應變（進行中）",
    )
    base_start = datetime(2026, 5, 12, 2, 0, tzinfo=timezone.utc)
    for i in range(5):
        db.merge(
            Event(
                event_id=ids.event_key(i + 1),
                title=titles[i],
                event_type_id=et_cycle[i],
                description=f"事件 {i + 1}：請全體同仁依部門演練計畫完成安全回報。",
                status="active",
                created_by=ids.user_key(1),
                start_time=base_start + timedelta(hours=i * 3),
            )
        )
    db.merge(
        Event(
            event_id=ids.event_key(6),
            title="年度消防演練（已結案）",
            event_type_id=ids.ET_FIRE,
            description="演練結案歸檔；以下為全員回報紀錄。",
            status="closed",
            created_by=ids.user_key(1),
            start_time=datetime(2026, 3, 1, 6, 0, tzinfo=timezone.utc),
        )
    )
    db.flush()

    # --- Safety responses ---
    rseq = 1
    t0 = datetime(2026, 5, 12, 8, 0, tzinfo=timezone.utc)

    def _add(ev: int, uid: int, status: str, comment: str | None, loc: str | None, hours: int) -> None:
        nonlocal rseq
        db.add(
            SafetyResponse(
                response_id=ids.response_key(rseq),
                event_id=ids.event_key(ev),
                user_id=ids.user_key(uid),
                status=status,
                comment=comment,
                location=loc,
                responded_at=t0 + timedelta(hours=hours, minutes=(uid + ev) % 60),
            )
        )
        rseq += 1

    # Active events 1–5: 約 3/4 員工有回報，混合 safe / need_help
    for ev in range(1, 6):
        for uid in range(2, 52):
            if (uid + ev * 5) % 5 == 0:
                continue
            st = "safe" if (uid + ev) % 4 != 0 else "need_help"
            cmt = (
                "已確認位置與同仁安全。"
                if st == "safe"
                else "需要現場支援或物資，已聯繫窗口。"
            )
            loc = f"站點 {(uid + ev) % 9 + 1}" if st == "safe" else None
            _add(ev, uid, st, cmt, loc, hours=ev * 2 + (uid % 5))

    # Completed event 6: 全員 safe
    for uid in range(2, 52):
        _add(
            6,
            uid,
            "safe",
            "演練結束，已撤離至集合點完成點名。",
            "南棟集合點",
            hours=200 + uid,
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
