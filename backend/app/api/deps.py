from __future__ import annotations

import uuid
from typing import Optional

from fastapi import Header, HTTPException, status


async def get_actor_user_id(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> uuid.UUID:
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-User-Id header (minimal auth stub).",
        )
    try:
        return uuid.UUID(x_user_id.strip())
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-User-Id UUID.",
        ) from e
