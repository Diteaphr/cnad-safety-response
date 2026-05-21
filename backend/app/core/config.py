import os
from pathlib import Path
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_DATABASE_URL = (
    "postgresql+psycopg://user:password@localhost:15432/employee_safety"
)
DEFAULT_JWT_SECRET = "change-me-in-production-use-strong-secret"
LOCAL_DATABASE_HOSTS = {
    "localhost",
    "127.0.0.1",
    "::1",
    "postgres",
    "host.docker.internal",
}

# ---------------------------------------------------------------------------
# Local development: secrets come from .env (see backend/.env.example).
# GCP credentials are NOT loaded unless USE_GCP=true.
# ---------------------------------------------------------------------------
_gcp_key = BASE_DIR / ".secrets" / "gcp-key.json"


class Settings(BaseSettings):
    env: str = "development"

    # 與 root docker-compose（主機 15432）及 backend/.env.example 一致；本機直連 5432 請在 .env 覆寫。
    database_url: str = DEFAULT_DATABASE_URL
    redis_url: str = "redis://localhost:6379/0"
    redis_enabled: bool = True

    # --- Local dev: keep false. Production (Cloud Run + real Pub/Sub) may set true later.
    use_gcp: bool = False

    gcp_project_id: str = ""
    pubsub_notification_topic: str = ""
    pubsub_report_topic: str = ""
    use_pubsub_emulator: bool = False
    pubsub_emulator_host: str = "localhost:8085"

    jwt_secret: str = DEFAULT_JWT_SECRET

    # Email／demo 登入核發之 access token 有效小時數（預設 720 ≈ 30 天，可用 JWT_ACCESS_TOKEN_EXPIRE_HOURS 覆寫）。
    jwt_access_token_expire_hours: int = 720

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()


def _is_production_env(env: str) -> bool:
    return env.strip().lower() in {"production", "prod"}


def _database_host(database_url: str) -> str | None:
    try:
        return urlparse(database_url).hostname
    except ValueError:
        return None


def _validate_production_settings(app_settings: Settings) -> None:
    if not _is_production_env(app_settings.env):
        return

    errors: list[str] = []
    database_url = app_settings.database_url.strip()
    jwt_secret = app_settings.jwt_secret.strip()

    if not database_url or database_url == DEFAULT_DATABASE_URL:
        errors.append("DATABASE_URL must be set from production Secret Manager.")

    host = _database_host(database_url)
    if host and host.lower() in LOCAL_DATABASE_HOSTS:
        errors.append("DATABASE_URL must not point to a local development database.")

    if not jwt_secret or jwt_secret == DEFAULT_JWT_SECRET:
        errors.append("JWT_SECRET must be set to a non-default production secret.")

    if errors:
        raise RuntimeError("Invalid production configuration: " + " ".join(errors))


_validate_production_settings(settings)

# Optional service account (only when explicitly enabling GCP integrations).
if settings.use_gcp and _gcp_key.exists():
    os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", str(_gcp_key))

if settings.use_gcp and settings.use_pubsub_emulator:
    os.environ.setdefault("PUBSUB_EMULATOR_HOST", settings.pubsub_emulator_host)
