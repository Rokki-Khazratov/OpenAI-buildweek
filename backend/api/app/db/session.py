"""Async SQLAlchemy engine and session lifecycle."""

from collections.abc import AsyncIterator
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from typing import Protocol

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


class DatabaseProtocol(Protocol):
    """Runtime contract used by HTTP handlers and tests."""

    def session(self) -> AbstractAsyncContextManager[AsyncSession]: ...

    async def ping(self) -> None: ...

    async def dispose(self) -> None: ...


class Database:
    """Own the async engine and create isolated sessions."""

    def __init__(self, url: str, *, echo: bool = False) -> None:
        self.engine: AsyncEngine = create_async_engine(
            url,
            echo=echo,
            pool_pre_ping=True,
        )
        self.session_factory = async_sessionmaker(
            bind=self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )

    @asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        """Provide a session and roll back unfinished work on failure."""
        async with self.session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    async def ping(self) -> None:
        """Verify a usable database connection."""
        async with self.engine.connect() as connection:
            await connection.execute(text("SELECT 1"))

    async def dispose(self) -> None:
        """Close the engine pool during application shutdown."""
        await self.engine.dispose()
