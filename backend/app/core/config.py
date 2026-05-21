import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# ---------------------------------------------------------------------------
# Local development: secrets come from .env (see backend/.env.example).
# GCP credentials are NOT loaded unless USE_GCP=true.
# ---------------------------------------------------------------------------
_gcp_key = BASE_DIR / ".secrets" / "gcp-key.json"


class Settings(BaseSettings):
    env: str = "development"

    # 與 root docker-compose（主機 15432）及 backend/.env.example 一致；本機直連 5432 請在 .env 覆寫。
    database_url: str = (
        "postgresql+psycopg://user:password@localhost:15432/employee_safety"
    )
    redis_url: str = "redis://localhost:6379/0"
    redis_enabled: bool = True

    # --- Local dev: keep false. Production (Cloud Run + real Pub/Sub) may set true later.
    use_gcp: bool = False

    gcp_project_id: str = ""
    pubsub_notification_topic: str = ""
    pubsub_report_topic: str = ""
    use_pubsub_emulator: bool = False
    pubsub_emulator_host: str = "localhost:8085"

    jwt_secret: str = "change-me-in-production-use-strong-secret"

    # Email／demo 登入核發之 access token 有效小時數（預設 720 ≈ 30 天，可用 JWT_ACCESS_TOKEN_EXPIRE_HOURS 覆寫）。
    jwt_access_token_expire_hours: int = 720

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# Optional service account (only when explicitly enabling GCP integrations).
if settings.use_gcp and _gcp_key.exists():
    os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", str(_gcp_key))

if settings.use_gcp and settings.use_pubsub_emulator:
    os.environ.setdefault("PUBSUB_EMULATOR_HOST", settings.pubsub_emulator_host)
