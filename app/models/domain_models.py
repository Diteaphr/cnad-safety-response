import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.core.database import Base

class RoleEnum(str, enum.Enum):
    admin = "admin"
    supervisor = "supervisor"
    employee = "employee"

class EventTypeEnum(str, enum.Enum):
    earthquake = "Earthquake"
    fire = "Fire"
    test = "Test"

class EventStatusEnum(str, enum.Enum):
    active = "active"
    closed = "closed"

class SafetyStatusEnum(str, enum.Enum):
    safe = "safe"
    need_help = "need_help"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    employee_no = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"))
    role = Column(SQLEnum(RoleEnum), default=RoleEnum.employee, nullable=False)
    is_active = Column(Boolean, default=True)

    department = relationship("Department", back_populates="users")

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    users = relationship("User", back_populates="department", foreign_keys=[User.department_id])

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    event_type = Column(SQLEnum(EventTypeEnum), nullable=False)
    status = Column(SQLEnum(EventStatusEnum), default=EventStatusEnum.active)
    created_at = Column(DateTime, default=datetime.utcnow)

class SafetyResponse(Base):
    __tablename__ = "safety_responses"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(SQLEnum(SafetyStatusEnum), nullable=False)
    location_lat = Column(Float, nullable=True)
    location_lng = Column(Float, nullable=True)
    comment = Column(String, nullable=True)
    reported_at = Column(DateTime, default=datetime.utcnow)

class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    channel = Column(String, nullable=False) # e.g., 'FCM' or 'SMS'
    status = Column(String, nullable=False) # e.g., 'sent', 'failed'
    sent_at = Column(DateTime, default=datetime.utcnow)
