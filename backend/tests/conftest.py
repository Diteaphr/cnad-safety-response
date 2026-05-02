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
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.base import Base
from app.core.database import get_db
from app.core.jwt import create_access_token
from app.core.passwords import hash_password
from app.main import app
from app.models.department import Department
from app.models.event import Event
from app.models.event_department import EventDepartment
from app.models.role import Role
from app.models.user import User
from app.models.user_role import UserRole

# ---------------------------------------------------------------------------
# Engine pointing at the test database
# ---------------------------------------------------------------------------
_engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)
_Session = sessionmaker(bind=_engine, class_=Session, expire_on_commit=False)


# ---------------------------------------------------------------------------
# Session-scoped: create / drop tables once per pytest run
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    Base.metadata.create_all(bind=_engine)
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


# ---------------------------------------------------------------------------
# Core fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def db():
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
def make_user(db, roles):
    """
    Factory fixture: call make_user(email=..., role=...) to get a User.

    Each created user gets a unique employee_no and optionally a manager_id
    for supervisor-subordinate tests.
    """
    def _factory(
        name: str = "Test User",
        email: str = "user@test.com",
        password: str = "password123",
        role: str = "employee",
        manager_id: uuid.UUID | None = None,
    ) -> User:
        user = User(
            employee_no=f"T{uuid.uuid4().hex[:8].upper()}",
            name=name,
            email=email,
            department_id=None,
            manager_id=manager_id,
            status="active",
            password_hash=hash_password(password),
        )
        db.add(user)
        db.flush()
        db.add(UserRole(user_id=user.user_id, role_id=roles[role].role_id))
        db.commit()
        db.refresh(user)
        # Eager-load user_roles → role so auth_headers can read role names
        from sqlalchemy.orm import selectinload
        from sqlalchemy import select
        from app.models.user_role import UserRole as UR
        stmt = (
            select(User)
            .options(selectinload(User.user_roles).selectinload(UR.role))
            .where(User.user_id == user.user_id)
        )
        return db.execute(stmt).unique().scalar_one()

    return _factory


@pytest.fixture
def make_event(db):
    """Factory fixture: create an Event row directly in the test DB."""
    def _factory(
        title: str = "Test Event",
        event_type: str = "Earthquake",
        status: str = "active",
        created_by: uuid.UUID | None = None,
    ) -> Event:
        # events.created_by has a FK to users.user_id — create a real user if none given
        if created_by is None:
            from app.core.passwords import hash_password
            placeholder = User(
                employee_no=f"SYS{uuid.uuid4().hex[:8].upper()}",
                name="System",
                email=f"system-{uuid.uuid4().hex[:8]}@internal.test",
                status="active",
                password_hash=hash_password("unused"),
            )
            db.add(placeholder)
            db.flush()
            created_by = placeholder.user_id

        event = Event(
            event_id=uuid.uuid4(),
            title=title,
            event_type=event_type,
            description="Test event description",
            status=status,
            created_by=created_by,
            start_time=datetime.now(timezone.utc),
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    return _factory
