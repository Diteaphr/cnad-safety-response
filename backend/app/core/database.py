from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.base import Base
from app.core.config import settings

engine = create_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=3,        # 3 × max_instances(10) = 30 connections — well within Cloud SQL limit
    max_overflow=7,     # burst headroom; total per-instance cap = 10
    pool_timeout=30,    # wait up to 30 s for a connection before raising
    pool_recycle=1800,  # recycle idle connections every 30 min (avoids stale TCP)
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=Session,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
