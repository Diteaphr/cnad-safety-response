from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Department(Base):
    __tablename__ = "departments"

    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    department_name: Mapped[str] = mapped_column(String, nullable=False)
    parent_department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.department_id"),
        nullable=True,
    )
    manager_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", use_alter=True, name="fk_departments_manager_id"),
        nullable=True,
    )

    manager: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[manager_id],
        post_update=True,
    )
