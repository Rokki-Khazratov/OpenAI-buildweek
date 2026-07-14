"""Shared test fixtures."""

from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.config import Environment, Settings
from app.main import create_app


class FakeDatabase:
    """Minimal database contract for HTTP foundation tests."""

    def __init__(self, *, available: bool = True) -> None:
        self.available = available
        self.disposed = False

    @asynccontextmanager
    async def session(self) -> AsyncIterator[Any]:
        yield None

    async def ping(self) -> None:
        if not self.available:
            raise ConnectionError("database unavailable")

    async def dispose(self) -> None:
        self.disposed = True


@pytest.fixture
def settings() -> Settings:
    return Settings(
        _env_file=None,
        environment=Environment.TEST,
        database_url="postgresql+asyncpg://postgres:postgres@localhost/test",
    )


@pytest.fixture
def fake_database() -> FakeDatabase:
    return FakeDatabase()


@pytest.fixture
def client(settings: Settings, fake_database: FakeDatabase) -> Iterator[TestClient]:
    app = create_app(settings=settings, database=fake_database)
    with TestClient(app) as test_client:
        yield test_client
