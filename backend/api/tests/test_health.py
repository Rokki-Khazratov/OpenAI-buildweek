"""Health endpoint behavior."""

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from tests.conftest import FakeDatabase


def test_liveness_returns_version_and_request_id(client: TestClient) -> None:
    response = client.get("/api/v1/health/live", headers={"x-request-id": "test-request"})

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["version"]
    assert response.headers["x-request-id"] == "test-request"


def test_readiness_succeeds_when_database_is_available(client: TestClient) -> None:
    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_readiness_fails_safely_when_database_is_unavailable(settings: Settings) -> None:
    app = create_app(settings=settings, database=FakeDatabase(available=False))

    with TestClient(app) as test_client:
        response = test_client.get("/api/v1/health/ready")

    assert response.status_code == 503
    assert response.json()["status"] == "unavailable"
    assert "database" not in response.text.lower()


def test_lifespan_disposes_database(settings: Settings) -> None:
    database = FakeDatabase()
    app = create_app(settings=settings, database=database)

    with TestClient(app):
        assert database.disposed is False

    assert database.disposed is True
