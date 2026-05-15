from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, DateTime, ForeignKey, String, Table, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.base import Base

if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.event_type import EventType
    from app.models.user import User

# Association table — no ORM class needed (no extra columns).
event_target_departments_table = Table(
    "event_target_departments",
    Base.metadata,
    Column(
        "event_id",
        UUID(as_uuid=True),
        ForeignKey("events.event_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "department_id",
        UUID(as_uuid=True),
        ForeignKey("departments.department_id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Event(Base):
    __tablename__ = "events"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    event_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("event_types.event_type_id"),
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id"),
        nullable=False,
    )
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    event_type_row: Mapped["EventType"] = relationship(
        "EventType",
        back_populates="events",
    )
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])
    target_departments: Mapped[list["Department"]] = relationship(
        "Department",
        secondary=event_target_departments_table,
        lazy="select",
    )

    @property
    def event_type(self) -> str:
        """Display label for APIs that still expose event_type as a string."""
        return self.event_type_row.name
