from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base

if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.user import User


class UserDepartment(Base):
    """User membership in a department; at most one row per user may be primary."""

    __tablename__ = "user_departments"
    __table_args__ = (
        UniqueConstraint("user_id", "department_id", name="uq_user_departments_user_dept"),
    )

    user_department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.department_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    user: Mapped["User"] = relationship("User", back_populates="department_memberships")
    department: Mapped["Department"] = relationship("Department")
