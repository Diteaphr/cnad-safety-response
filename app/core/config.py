import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Set the GCP credentials path BEFORE any GCP client is instantiated
gcp_key_path = BASE_DIR / ".secrets" / "gcp-key.json"
if gcp_key_path.exists():
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(gcp_key_path)

class Settings(BaseSettings):
    project_id: str = "cnad-safety-response"
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/safety_db"
    redis_url: str = "redis://localhost:6379/0"
    use_pubsub_emulator: bool = True
    pubsub_emulator_host: str = "localhost:8085"
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()

if settings.use_pubsub_emulator:
    os.environ["PUBSUB_EMULATOR_HOST"] = settings.pubsub_emulator_host
