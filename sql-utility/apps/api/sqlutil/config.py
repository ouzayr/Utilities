from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings. Overridable via environment variables prefixed with SQLUTIL_."""

    data_dir: Path = Path.home() / ".sqlutil"
    app_db_filename: str = "app.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]
    default_query_timeout_s: int = 30
    metadata_schema: str = "sqlutil"
    encryption_key_env: str = "SQLUTIL_ENCRYPTION_KEY"
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_prefix="SQLUTIL_", env_file=".env", extra="ignore")

    @property
    def app_db_path(self) -> Path:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        return self.data_dir / self.app_db_filename


settings = Settings()
