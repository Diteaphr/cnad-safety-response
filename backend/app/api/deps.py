from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.core.jwt import decode_token

_bearer = HTTPBearer()


def verify_pubsub_oidc(request: Request) -> None:
    """Verify that the request originates from the authorised Pub/Sub service account.

    Skipped when USE_GCP=false (local dev / CI tests).
    Raises 401 if token is missing or invalid; 403 if the service account doesn't match.
    """
    if not settings.use_gcp:
        return

    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing OIDC token")

    audience = f"{settings.service_url.rstrip('/')}/api/internal/notifications/dispatch"

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token

        id_info = id_token.verify_oauth2_token(
            token, google_requests.Request(), audience
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid OIDC token: {exc}") from exc

    if settings.pubsub_sa_email and id_info.get("email") != settings.pubsub_sa_email:
        raise HTTPException(
            status_code=403,
            detail=f"Unauthorized service account: {id_info.get('email')}",
        )


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> uuid.UUID:
    payload = decode_token(credentials.credentials)
    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        ) from e
