"""Application-level FastAPI dependencies."""

from typing import cast

from fastapi import Request

from app.core.config import Settings


def get_runtime_settings(request: Request) -> Settings:
    """Return the settings instance attached during application lifespan."""
    return cast(Settings, request.app.state.settings)
