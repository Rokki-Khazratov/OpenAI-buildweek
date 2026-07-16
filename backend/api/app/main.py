"""FastAPI application entrypoint."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.logging import configure_logging
from app.core.middleware import RequestIdMiddleware
from app.db.session import Database, DatabaseProtocol
from app.integrations.storage import S3Storage, StorageProtocol


def create_app(
    settings: Settings | None = None,
    database: DatabaseProtocol | None = None,
    storage: StorageProtocol | None = None,
) -> FastAPI:
    """Build an application instance with explicit runtime dependencies."""
    resolved_settings = settings or get_settings()
    configure_logging(resolved_settings.log_level)
    resolved_database = database or Database(
        resolved_settings.database_url,
        echo=resolved_settings.database_echo,
    )
    resolved_storage = storage or S3Storage(resolved_settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.settings = resolved_settings
        app.state.database = resolved_database
        app.state.storage = resolved_storage
        yield
        await resolved_database.dispose()

    application = FastAPI(
        title=resolved_settings.app_name,
        version=__version__,
        debug=resolved_settings.debug,
        docs_url="/docs" if resolved_settings.docs_enabled else None,
        redoc_url="/redoc" if resolved_settings.docs_enabled else None,
        openapi_url="/openapi.json" if resolved_settings.docs_enabled else None,
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )
    application.add_middleware(RequestIdMiddleware)
    application.include_router(api_router, prefix=resolved_settings.api_prefix)
    return application


app = create_app()
