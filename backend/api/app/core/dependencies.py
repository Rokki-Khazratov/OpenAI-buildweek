"""Application-level FastAPI dependencies."""

from typing import cast

from fastapi import Request

from app.core.config import Settings
from app.integrations.storage import StorageProtocol


def get_runtime_settings(request: Request) -> Settings:
    """Return the settings instance attached during application lifespan."""
    return cast(Settings, request.app.state.settings)


def get_storage(request: Request) -> StorageProtocol:
    """Return the configured private object-storage adapter."""
    return cast(StorageProtocol, request.app.state.storage)
