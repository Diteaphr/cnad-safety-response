import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base

if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.event import Event


class EventDepartment(Base):
    __tablename__ = "event_departments"

    event_department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.event_id", ondelete="CASCADE"),
        nullable=False,
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.department_id", ondelete="CASCADE"),
        nullable=False,
    )

    event: Mapped["Event"] = relationship("Event", back_populates="event_departments")
    department: Mapped["Department"] = relationship("Department")
