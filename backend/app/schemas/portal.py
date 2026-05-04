"""API shapes aligned with frontend/src/types.ts and legacy /api routes."""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class DepartmentOut(BaseModel):
    id: str
    name: str
    parentId: Optional[str] = None


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    departmentId: str
    roles: List[Literal["employee", "supervisor", "admin"]]
    pushEnabled: bool = True
    managerId: Optional[str] = None


class EventItemOut(BaseModel):
    id: str
    title: str
    type: Literal["Earthquake", "Typhoon", "Fire", "Other"]
    description: str
    targetDepartmentIds: List[str]
    status: Literal["draft", "active", "closed"]
    startAt: str
    cardDepartment: Optional[str] = None
    venue: Optional[str] = None


class SafetyResponseOut(BaseModel):
    id: str
    eventId: str
    userId: str
    status: Literal["safe", "need_help"]
    location: Optional[str] = None
    comment: Optional[str] = None
    attachmentName: Optional[str] = None
    attachmentSizeBytes: Optional[int] = None
    updatedAt: str


class CreateEventIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    type: Literal["Earthquake", "Typhoon", "Fire", "Other"]
    description: Optional[str] = Field(default="", max_length=2000)
    startAt: str
    targetDepartmentIds: List[str] = Field(min_length=1)


class ReportIn(BaseModel):
    eventId: str
    userId: str
    status: Literal["safe", "need_help"]
    location: Optional[str] = None
    comment: Optional[str] = None


class EventActionIn(BaseModel):
    """Optional body; prefer X-User-Id header."""

    actorUserId: Optional[str] = None


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    departmentId: Optional[str] = Field(default=None, description="Department UUID or omit")
    phone: Optional[str] = Field(default=None, max_length=50)
    employeeNo: Optional[str] = Field(default=None, max_length=50)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class DemoLoginIn(BaseModel):
    """與前端 Demo 下拉一致的 userId（種子使用者 UUID）；見 GET /api/demo-accounts。"""

    userId: str = Field(min_length=1, max_length=64)


class ProfileUpdateIn(BaseModel):
    """Fields an authenticated user may update on their own profile."""

    name: str = Field(min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)


class AdminUserCreateIn(BaseModel):
    """Admin creates a new user account."""

    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone: Optional[str] = Field(default=None, max_length=50)
    employeeNo: Optional[str] = Field(default=None, max_length=50)
    departmentId: Optional[str] = None
    managerId: Optional[str] = None
    roles: List[Literal["employee", "supervisor", "admin"]] = Field(default=["employee"])


class AdminUserUpdateIn(BaseModel):
    """Admin edits an existing user's details."""

    name: str = Field(min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)
    departmentId: Optional[str] = None
    managerId: Optional[str] = None
    roles: List[Literal["employee", "supervisor", "admin"]] = Field(min_length=1)
