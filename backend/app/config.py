import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _backend_dir() -> Path:
    return Path(__file__).resolve().parent.parent


def _env_files() -> tuple[str, ...]:
    base = _backend_dir()
    app_env = os.environ.get("APP_ENV", "development")
    if app_env == "production":
        prod = base / ".env.production"
        if prod.exists():
            return (str(prod),)
        return ()
    return tuple(str(p) for p in (base / ".env.development", base / ".env") if p.exists())


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_files() or None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "LostAndFound API"
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    database_url: str
    default_admin_email: str = "admin@example.com"
    default_admin_password: str = "admin123"


settings = Settings()
