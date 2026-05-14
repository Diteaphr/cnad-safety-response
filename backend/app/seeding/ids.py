"""Stable UUIDs for seed data. Numeric suffix 1,2,3… is encoded in the last 12 hex digits."""

from __future__ import annotations

import uuid


def dept_key(n: int) -> uuid.UUID:
    if not 1 <= n <= 0xFFF:
        raise ValueError(n)
    return uuid.UUID(f"01000000-0000-4000-8000-{n:012x}")


def user_key(n: int) -> uuid.UUID:
    if not 1 <= n <= 0xFFF:
        raise ValueError(n)
    return uuid.UUID(f"02000000-0000-4000-8000-{n:012x}")


def event_key(n: int) -> uuid.UUID:
    if not 1 <= n <= 0xFFF:
        raise ValueError(n)
    return uuid.UUID(f"03000000-0000-4000-8000-{n:012x}")


def response_key(n: int) -> uuid.UUID:
    if not 1 <= n <= 0xFFFFF:
        raise ValueError(n)
    return uuid.UUID(f"04000000-0000-4000-8000-{n:012x}")


def user_department_key(n: int) -> uuid.UUID:
    if not 1 <= n <= 0xFFF:
        raise ValueError(n)
    return uuid.UUID(f"05000000-0000-4000-8000-{n:012x}")


# Event types — must match Alembic migration `20260504_0004_event_types_table.py`
ET_EARTHQUAKE = uuid.UUID("d0000001-0000-4000-8000-000000000001")
ET_TYPHOON = uuid.UUID("d0000001-0000-4000-8000-000000000002")
ET_FIRE = uuid.UUID("d0000001-0000-4000-8000-000000000003")
ET_OTHER = uuid.UUID("d0000001-0000-4000-8000-000000000004")

# ---------------------------------------------------------------------------
# Canonical entities (1 = admin, 2–51 = employee_1 … employee_50)
# ---------------------------------------------------------------------------
U_ADMIN = user_key(1)

# Departments 1..10（兩條深階層；見 seed_demo 樹狀說明）
D1 = dept_key(1)
D2 = dept_key(2)
D3 = dept_key(3)
D4 = dept_key(4)
D5 = dept_key(5)
D6 = dept_key(6)
D7 = dept_key(7)
D8 = dept_key(8)
D9 = dept_key(9)
D10 = dept_key(10)

# Events: 1–5 active, 6 completed
E1 = event_key(1)
E2 = event_key(2)
E3 = event_key(3)
E4 = event_key(4)
E5 = event_key(5)
E6 = event_key(6)

# ---------------------------------------------------------------------------
# Back-compat names (tests / demo / older docs)
# ---------------------------------------------------------------------------
U_01 = user_key(2)
U_02 = user_key(3)
U_03 = user_key(4)
U_04 = user_key(1)
U_05 = user_key(7)
U_06 = user_key(8)
U_07 = user_key(9)
U_08 = user_key(1)

D_OPS = D1
D_RD = D3
D_HR = D4
D_FAC = D5
D_PLANT_A = D2
D_LINE1 = D5
D_LINE2 = D8

E_001 = E1
E_002 = E2
E_003 = E6
E_004 = E4
E_007 = E6
