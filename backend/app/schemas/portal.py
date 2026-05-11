"""API shapes aligned with frontend/src/types.ts and legacy /api routes."""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


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
    type: str
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
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(min_length=1, max_length=200)
    type: str = Field(
        min_length=1,
        max_length=128,
        description="event_types.name 或 code（與 GET /api/event-types 目錄一致）；選「其他」並填自訂名時請傳 Other。",
    )
    description: Optional[str] = Field(default="", max_length=2000)
    startAt: str
    targetDepartmentIds: List[str] = Field(min_length=1)
    custom_type_name: Optional[str] = Field(
        default=None,
        max_length=128,
        alias="customTypeName",
        description="自訂類型顯示名；僅當 type 為 Other 且非空白時會寫入 event_types 並指向該列。",
    )

    @model_validator(mode="after")
    def custom_name_only_when_other(self) -> CreateEventIn:
        raw = (self.custom_type_name or "").strip()
        if raw and self.type.strip().lower() != "other":
            raise ValueError("customTypeName is only allowed when type is Other")
        return self


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
