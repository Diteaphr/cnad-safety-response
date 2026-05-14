"""
Test fixtures.

Database strategy: real PostgreSQL (employee_safety_test) + TRUNCATE before each test.
- No mock/SQLite: avoids behaviour differences with production.
- No transaction rollback: simpler, works correctly with services that call db.commit().
- TestClient without context manager: startup seeding event does NOT run.

CI: set TEST_DATABASE_URL env var in GitHub Actions PostgreSQL service.
Local: start Docker Compose postgres, then run pytest from backend/.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

# Always force DATABASE_URL to the test database before any app module is imported.
# os.environ.setdefault would silently keep the production DATABASE_URL that
# docker-compose injects, causing tests to run against the real database.
# TEST_DATABASE_URL lets CI / Docker override the host:port while keeping the DB name.
_default_test_url = "postgresql+psycopg://user:password@localhost:15432/employee_safety_test"
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", _default_test_url)
os.environ.setdefault("REDIS_ENABLED", "false")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.base import Base
from app.core.database import get_db
from app.core.jwt import create_access_token
from app.core.passwords import hash_password
from app.main import app
from app.models.department import Department
from app.models.event import Event
from app.models.event_type import EventType
from app.models.role import Role
from app.models.user import User
from app.models.user_department import UserDepartment  # noqa: F401 — metadata
from app.models.user_notification_preference import UserNotificationPreference
from app.models.user_role import UserRole

# ---------------------------------------------------------------------------
# Engine pointing at the test database
# ---------------------------------------------------------------------------
_engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)
_Session = sessionmaker(bind=_engine, class_=Session, expire_on_commit=False)


def _seed_four_event_types() -> None:
    """events.event_type_id FK 需要 event_types 表內這四筆參考列（與 migration / ids.py 一致）。"""
    from app.seeding import ids as seed_ids

    sess = _Session()
    try:
        for tid, code, name in (
            (seed_ids.ET_EARTHQUAKE, "earthquake", "Earthquake"),
            (seed_ids.ET_TYPHOON, "typhoon", "Typhoon"),
            (seed_ids.ET_FIRE, "fire", "Fire"),
            (seed_ids.ET_OTHER, "other", "Other"),
        ):
            sess.merge(EventType(event_type_id=tid, code=code, name=name))
        sess.commit()
    finally:
        sess.close()


# ---------------------------------------------------------------------------
# Session-scoped: create / drop tables once per pytest run
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    Base.metadata.create_all(bind=_engine)
    _seed_four_event_types()
    yield
    Base.metadata.drop_all(bind=_engine)
    _engine.dispose()


# ---------------------------------------------------------------------------
# Function-scoped: truncate all tables before each test
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _clean_tables(_create_tables):
    """Wipe all rows before every test so each test starts from a clean state."""
    table_names = ", ".join(t.name for t in Base.metadata.sorted_tables)
    with _engine.connect() as conn:
        conn.execute(text(f"TRUNCATE {table_names} CASCADE"))
        conn.commit()
    # TRUNCATE 會清空 event_types；events 外鍵需要預設四筆類型列
    _seed_four_event_types()


# ---------------------------------------------------------------------------
# Core fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def db(_clean_tables):
    """A SQLAlchemy Session connected to the test database."""
    session = _Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    """
    FastAPI TestClient with get_db overridden to use the test session.
    TestClient is NOT used as a context manager → startup seeding does NOT run.
    """
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app, raise_server_exceptions=True)
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helper: build Authorization header from a user object
# ---------------------------------------------------------------------------

def auth_headers(user: User, extra_roles: list[str] | None = None) -> dict[str, str]:
    roles = [ur.role.role_name for ur in user.user_roles]
    if extra_roles:
        roles = list(set(roles) | set(extra_roles))
    token = create_access_token(user.user_id, roles)
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Data fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def roles(db) -> dict[str, Role]:
    """Insert the three base roles and return them by name."""
    result: dict[str, Role] = {}
    for name in ("employee", "supervisor", "admin"):
        r = Role(role_id=uuid.uuid4(), role_name=name)
        db.add(r)
        result[name] = r
    db.commit()
    # Re-attach after commit so relationships load cleanly
    for r in result.values():
        db.refresh(r)
    return result


@pytest.fixture
def make_department(db):
    """Factory: create a Department."""

    def _factory(name: str = "Test Dept", parent_id: uuid.UUID | None = None) -> Department:
        dept = Department(
            department_id=uuid.uuid4(),
            department_name=name,
            parent_department_id=parent_id,
        )
        db.add(dept)
        db.commit()
        db.refresh(dept)
        return dept

    return _factory


@pytest.fixture
def make_user(db, roles):
    """
    Factory: create User + optional primary department (user_departments).

    For supervisor/team tests, set ``managed_department_id`` to a department UUID
    to set ``departments.manager_id`` to this user after creation (department head).
    """

    def _factory(
        name: str = "Test User",
        email: str = "user@test.com",
        password: str = "password123",
        role: str = "employee",
        phone: str | None = None,
        department_id: uuid.UUID | None = None,
        managed_department_id: uuid.UUID | None = None,
    ) -> User:
        user = User(
            employee_no=f"T{uuid.uuid4().hex[:8].upper()}",
            name=name,
            email=email,
            phone=phone,
            status="active",
            password_hash=hash_password(password),
        )
        db.add(user)
        db.flush()
        if department_id is not None:
            db.add(
                UserDepartment(
                    user_id=user.user_id,
                    department_id=department_id,
                    is_primary=True,
                )
            )
        db.add(UserRole(user_id=user.user_id, role_id=roles[role].role_id))
        db.merge(UserNotificationPreference(user_id=user.user_id))
        db.flush()
        if managed_department_id is not None:
            dep = db.get(Department, managed_department_id)
            if dep is not None:
                dep.manager_id = user.user_id
        db.commit()
        from sqlalchemy.orm import selectinload

        stmt = (
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(User.user_id == user.user_id)
        )
        return db.execute(stmt).unique().scalar_one()

    return _factory


@pytest.fixture
def make_event(db):
    """Factory fixture: create an Event row directly in the test DB."""
    from app.seeding import ids as seed_ids

    _TYPE_BY_NAME = {
        "Earthquake": seed_ids.ET_EARTHQUAKE,
        "Typhoon": seed_ids.ET_TYPHOON,
        "Fire": seed_ids.ET_FIRE,
        "Other": seed_ids.ET_OTHER,
    }

    def _factory(
        title: str = "Test Event",
        status: str = "active",
        created_by: uuid.UUID | None = None,
        event_type: str | None = None,
    ) -> Event:
        creator = created_by or uuid.uuid4()
        etid = _TYPE_BY_NAME.get(event_type or "Earthquake", seed_ids.ET_EARTHQUAKE)
        ev = Event(
            event_id=uuid.uuid4(),
            title=title,
            event_type_id=etid,
            description="test",
            status=status,
            created_by=creator,
            start_time=datetime.now(timezone.utc),
        )
        db.add(ev)
        db.commit()
        db.refresh(ev)
        return ev

    return _factory
