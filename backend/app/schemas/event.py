from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class EventCreate(BaseModel):
    title: str = Field(..., min_length=1)
    event_type: str = Field(..., min_length=1)
    description: Optional[str] = None
    status: str = Field(default="active")
    department_ids: list[uuid.UUID] = Field(..., min_length=1)
    start_time: Optional[datetime] = None


class EventDepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_department_id: uuid.UUID
    event_id: uuid.UUID
    department_id: uuid.UUID


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: uuid.UUID
    title: str
    event_type: str
    description: Optional[str]
    status: str
    created_by: uuid.UUID
    start_time: Optional[datetime]
    created_at: datetime
    event_departments: list[EventDepartmentOut] = Field(default_factory=list)
