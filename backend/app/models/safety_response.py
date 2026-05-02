from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.base import Base

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.user import User


class SafetyResponse(Base):
    __tablename__ = "safety_responses"
    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "user_id",
            name="uq_safety_responses_event_user",
        ),
    )

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.event_id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    responded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    event: Mapped["Event"] = relationship("Event")
    user: Mapped["User"] = relationship("User")
