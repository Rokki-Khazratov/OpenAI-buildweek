"""Environment-backed application settings."""

from enum import StrEnum
from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    """Supported runtime environments."""

    LOCAL = "local"
    TEST = "test"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    """Validated runtime configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="APP_",
        extra="ignore",
    )

    app_name: str = "OpenAI Build Week API"
    environment: Environment = Environment.LOCAL
    debug: bool = False
    log_level: str = "INFO"
    api_prefix: str = "/api/v1"
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:55432/openai_buildweek"
    )
    database_echo: bool = False
    jwt_secret: SecretStr = Field(
        default=SecretStr("local-development-secret-change-me-32-chars"),
        min_length=32,
    )
    jwt_algorithm: Literal["HS256"] = "HS256"
    jwt_issuer: str = "openai-buildweek-api"
    jwt_audience: str = "openai-buildweek-web"
    access_token_minutes: int = Field(default=15, ge=1, le=120)
    refresh_token_days: int = Field(default=30, ge=1, le=90)
    redis_url: str = "redis://localhost:6379/0"
    storage_endpoint_url: str = "http://localhost:9000"
    storage_public_endpoint_url: str = "http://localhost:9000"
    storage_access_key: SecretStr = SecretStr("minioadmin")
    storage_secret_key: SecretStr = SecretStr("minioadmin")
    storage_bucket: str = "examtwin-artifacts"
    storage_region: str = "us-east-1"
    artifact_upload_expiry_seconds: int = Field(default=600, ge=60, le=3600)
    artifact_download_expiry_seconds: int = Field(default=300, ge=60, le=3600)
    artifact_max_size_bytes: int = Field(default=25 * 1024 * 1024, ge=1024)
    artifact_max_files_per_exam: int = Field(default=30, ge=1, le=100)
    artifact_max_pages: int = Field(default=300, ge=1, le=2000)
    artifact_max_characters: int = Field(default=2_000_000, ge=1000)
    artifact_dispatch_jobs: bool = True
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )

    @model_validator(mode="after")
    def validate_production_secrets(self) -> Self:
        """Prevent a production process from using the local signing key."""
        if (
            self.environment is Environment.PRODUCTION
            and self.jwt_secret.get_secret_value() == "local-development-secret-change-me-32-chars"
        ):
            raise ValueError("APP_JWT_SECRET must be configured in production")
        if self.environment is Environment.PRODUCTION and (
            self.storage_access_key.get_secret_value() == "minioadmin"
            or self.storage_secret_key.get_secret_value() == "minioadmin"
        ):
            raise ValueError("Object-storage credentials must be configured in production")
        return self

    @property
    def docs_enabled(self) -> bool:
        """Disable public API docs in production by default."""
        return self.environment is not Environment.PRODUCTION


@lru_cache
def get_settings() -> Settings:
    """Return one immutable-by-convention settings instance per process."""
    return Settings()
