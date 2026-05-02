import uuid

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base


class Role(Base):
    __tablename__ = "roles"

    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    role_name: Mapped[str] = mapped_column(String, unique=True, nullable=False)

    user_roles: Mapped[list["UserRole"]] = relationship(
        "UserRole", back_populates="role", cascade="all, delete-orphan"
    )
