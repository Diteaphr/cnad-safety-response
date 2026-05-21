from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class UserNotificationPreference(Base):
    """Per-user push notification channel toggles (1:1 with users)."""

    __tablename__ = "user_notification_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        primary_key=True,
    )
    push_master_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    push_emergency_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    push_reminder_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    push_escalation_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="notification_preference",
    )
