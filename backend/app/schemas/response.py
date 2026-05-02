from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SafetyResponseCreate(BaseModel):
    status: str = Field(..., min_length=1)
    comment: Optional[str] = None
    location: Optional[str] = None


class SafetyResponseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    response_id: uuid.UUID
    event_id: uuid.UUID
    user_id: uuid.UUID
    status: str
    comment: Optional[str]
    location: Optional[str]
    responded_at: datetime
