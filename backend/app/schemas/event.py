from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EventCreate(BaseModel):
    title: str = Field(..., min_length=1)
    event_type: str = Field(..., min_length=1)
    description: Optional[str] = None
    status: str = Field(default="active")
    department_ids: list[uuid.UUID] = Field(
        default_factory=list,
        description="Deprecated; ignored. Events are company-wide.",
    )
    start_time: Optional[datetime] = None
    custom_type_name: Optional[str] = Field(
        default=None,
        max_length=128,
        description="自訂顯示名；僅當 event_type 為 other（不分大小寫）且非空白時寫入 event_types 表。",
    )

    @model_validator(mode="after")
    def custom_name_only_when_other(self) -> EventCreate:
        raw = (self.custom_type_name or "").strip()
        if raw and self.event_type.strip().lower() != "other":
            raise ValueError("custom_type_name is only allowed when event_type is other")
        return self


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: uuid.UUID
    event_type_id: uuid.UUID
    title: str
    event_type: str
    description: Optional[str]
    status: str
    created_by: uuid.UUID
    start_time: Optional[datetime]
    created_at: datetime
