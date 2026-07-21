"""Authentication and workspace CRUD integration tests."""

import os
from collections.abc import AsyncIterator
from typing import cast

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr
from sqlalchemy import text

from app.core.config import Environment, Settings
from app.db.session import Database
from app.main import create_app

pytestmark = pytest.mark.integration


@pytest.fixture
async def integration_client() -> AsyncIterator[AsyncClient]:
    database_url = os.getenv("TEST_DATABASE_URL")
    if database_url is None:
        pytest.skip("TEST_DATABASE_URL is not configured")

    settings = Settings(
        _env_file=None,
        environment=Environment.TEST,
        database_url=database_url,
        jwt_secret=SecretStr("integration-secret-longer-than-32-characters"),
    )
    database = Database(database_url)
    app = create_app(settings=settings, database=database)

    async def truncate() -> None:
        async with database.engine.begin() as connection:
            await connection.execute(
                text(
                    "TRUNCATE audit_events, library_clones, library_publications, "
                    "class_members, attempt_responses, attempts, "
                    "mock_questions, mock_exams, class_exams, classes, exams, "
                    "workspace_members, workspaces, "
                    "refresh_tokens, users RESTART IDENTITY CASCADE"
                )
            )

    await truncate()
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            yield client
        await truncate()


async def register(
    client: AsyncClient,
    email: str,
    *,
    display_name: str = "Test User",
) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "correct horse battery staple",
            "display_name": display_name,
        },
    )
    assert response.status_code == 201, response.text


async def login(client: AsyncClient, email: str) -> dict[str, object]:
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "correct horse battery staple"},
    )
    assert response.status_code == 200, response.text
    return cast(dict[str, object], response.json())


def bearer(token_pair: dict[str, object]) -> dict[str, str]:
    return {"Authorization": f"Bearer {token_pair['access_token']}"}


async def test_authentication_and_refresh_rotation(integration_client: AsyncClient) -> None:
    await register(integration_client, "Student@Example.com")

    duplicate = await integration_client.post(
        "/api/v1/auth/register",
        json={
            "email": "student@example.com",
            "password": "correct horse battery staple",
            "display_name": "Duplicate",
        },
    )
    assert duplicate.status_code == 409

    tokens = await login(integration_client, "student@example.com")
    profile = await integration_client.get("/api/v1/me", headers=bearer(tokens))
    assert profile.status_code == 200
    assert profile.json()["email"] == "student@example.com"

    updated_profile = await integration_client.patch(
        "/api/v1/me",
        headers=bearer(tokens),
        json={"display_name": "Updated Student"},
    )
    assert updated_profile.status_code == 200
    assert updated_profile.json()["display_name"] == "Updated Student"

    rotated = await integration_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert rotated.status_code == 200
    assert rotated.json()["refresh_token"] != tokens["refresh_token"]

    reused = await integration_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert reused.status_code == 401

    logout = await integration_client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": rotated.json()["refresh_token"]},
    )
    assert logout.status_code == 204

    after_logout = await integration_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": rotated.json()["refresh_token"]},
    )
    assert after_logout.status_code == 401


async def test_workspace_crud_and_cross_user_isolation(integration_client: AsyncClient) -> None:
    await register(integration_client, "owner@example.com", display_name="Owner")
    owner_tokens = await login(integration_client, "owner@example.com")
    owner_headers = bearer(owner_tokens)

    created = await integration_client.post(
        "/api/v1/workspaces",
        headers=owner_headers,
        json={"title": "Quantum Physics", "course_code": "PHY-401"},
    )
    assert created.status_code == 201, created.text
    workspace_id = created.json()["id"]
    assert created.json()["visibility"] == "private"

    listed = await integration_client.get("/api/v1/workspaces", headers=owner_headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["id"] == workspace_id

    updated = await integration_client.patch(
        f"/api/v1/workspaces/{workspace_id}",
        headers=owner_headers,
        json={"title": "Advanced Quantum Physics", "visibility": "team"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Advanced Quantum Physics"

    await register(integration_client, "other@example.com", display_name="Other")
    other_tokens = await login(integration_client, "other@example.com")
    other_list = await integration_client.get(
        "/api/v1/workspaces",
        headers=bearer(other_tokens),
    )
    assert other_list.status_code == 200
    assert other_list.json()["total"] == 0

    hidden = await integration_client.get(
        f"/api/v1/workspaces/{workspace_id}",
        headers=bearer(other_tokens),
    )
    assert hidden.status_code == 404

    forbidden_update = await integration_client.patch(
        f"/api/v1/workspaces/{workspace_id}",
        headers=bearer(other_tokens),
        json={"title": "Stolen"},
    )
    assert forbidden_update.status_code == 404

    deleted = await integration_client.delete(
        f"/api/v1/workspaces/{workspace_id}",
        headers=owner_headers,
    )
    assert deleted.status_code == 204

    missing = await integration_client.get(
        f"/api/v1/workspaces/{workspace_id}",
        headers=owner_headers,
    )
    assert missing.status_code == 404


async def test_subject_exam_and_class_scope(integration_client: AsyncClient) -> None:
    await register(integration_client, "scope-owner@example.com", display_name="Scope Owner")
    tokens = await login(integration_client, "scope-owner@example.com")
    headers = bearer(tokens)

    subject = await integration_client.post(
        "/api/v1/subjects",
        headers=headers,
        json={"title": "Algorithms", "course_code": "CS-301"},
    )
    assert subject.status_code == 201, subject.text
    subject_id = subject.json()["id"]

    exam_ids: list[str] = []
    for title in ("Midterm", "Final"):
        exam = await integration_client.post(
            f"/api/v1/subjects/{subject_id}/exams",
            headers=headers,
            json={"title": title, "exam_type": "written", "language": "en"},
        )
        assert exam.status_code == 201, exam.text
        assert exam.json()["subject_id"] == subject_id
        exam_ids.append(exam.json()["id"])

    all_subject = await integration_client.post(
        f"/api/v1/subjects/{subject_id}/classes",
        headers=headers,
        json={"name": "Entire subject", "exam_scope": "subject"},
    )
    assert all_subject.status_code == 201, all_subject.text
    assert all_subject.json()["exam_ids"] == []

    selected = await integration_client.post(
        f"/api/v1/subjects/{subject_id}/classes",
        headers=headers,
        json={
            "name": "Final group",
            "exam_scope": "selected_exams",
            "exam_ids": [exam_ids[1]],
        },
    )
    assert selected.status_code == 201, selected.text
    assert selected.json()["exam_ids"] == [exam_ids[1]]

    invalid = await integration_client.post(
        f"/api/v1/subjects/{subject_id}/classes",
        headers=headers,
        json={"name": "Invalid", "exam_scope": "selected_exams", "exam_ids": []},
    )
    assert invalid.status_code == 422

    classes = await integration_client.get(
        f"/api/v1/subjects/{subject_id}/classes", headers=headers
    )
    assert classes.status_code == 200
    assert classes.json()["total"] == 2


async def test_exam_can_remain_an_explicit_draft_with_a_blueprint(
    integration_client: AsyncClient,
) -> None:
    await register(integration_client, "draft-owner@example.com")
    headers = bearer(await login(integration_client, "draft-owner@example.com"))
    subject = await integration_client.post(
        "/api/v1/subjects", headers=headers, json={"title": "Draft subject"}
    )
    subject_id = subject.json()["id"]
    blueprint = [
        {
            "id": "part-a",
            "title": "Part A",
            "questionType": "Open response",
            "questionCount": 1,
            "durationMinutes": 30,
            "points": 20,
        }
    ]

    created = await integration_client.post(
        f"/api/v1/subjects/{subject_id}/exams",
        headers=headers,
        json={"title": "Work in progress", "blueprint": blueprint, "status": "draft"},
    )
    assert created.status_code == 201, created.text
    assert created.json()["status"] == "draft"

    invalid_ready = await integration_client.post(
        f"/api/v1/subjects/{subject_id}/exams",
        headers=headers,
        json={"title": "Invalid ready exam", "status": "ready"},
    )
    assert invalid_ready.status_code == 422, invalid_ready.text

    updated = await integration_client.patch(
        f"/api/v1/exams/{created.json()['id']}",
        headers=headers,
        json={
            "description": "Still not finished",
            "blueprint": blueprint,
            "status": "draft",
            "configuration_version": created.json()["configuration_version"],
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["status"] == "draft"


async def test_durable_exam_mock_and_attempt_flow(integration_client: AsyncClient) -> None:
    await register(integration_client, "attempt-owner@example.com")
    tokens = await login(integration_client, "attempt-owner@example.com")
    headers = bearer(tokens)

    subject = await integration_client.post(
        "/api/v1/subjects", headers=headers, json={"title": "Physics"}
    )
    subject_id = subject.json()["id"]
    exam = await integration_client.post(
        f"/api/v1/subjects/{subject_id}/exams",
        headers=headers,
        json={
            "title": "Final",
            "pasted_context": "Show all reasoning.",
            "blueprint": [
                {
                    "id": "theory",
                    "title": "Theory",
                    "questionType": "Open response",
                    "questionCount": 2,
                    "durationMinutes": 30,
                    "points": 20,
                }
            ],
            "rules": {"durationMinutes": 30, "totalPoints": 20},
        },
    )
    assert exam.status_code == 201, exam.text
    exam_id = exam.json()["id"]
    assert exam.json()["blueprint"][0]["questionCount"] == 2

    mock = await integration_client.post(f"/api/v1/exams/{exam_id}/mocks", headers=headers)
    assert mock.status_code == 201, mock.text
    assert mock.json()["generator"] == "deterministic_demo"
    assert len(mock.json()["questions"]) == 2
    assert "answer_key" not in mock.json()["questions"][0]

    attempt = await integration_client.post(
        f"/api/v1/mocks/{mock.json()['id']}/attempts", headers=headers
    )
    assert attempt.status_code == 201, attempt.text
    attempt_id = attempt.json()["id"]
    question_id = mock.json()["questions"][0]["id"]

    saved = await integration_client.put(
        f"/api/v1/attempts/{attempt_id}/responses/{question_id}",
        headers=headers,
        json={"answer": "A sufficiently complete and reasoned response.", "flagged": False},
    )
    assert saved.status_code == 200, saved.text

    result = await integration_client.post(f"/api/v1/attempts/{attempt_id}/submit", headers=headers)
    assert result.status_code == 200, result.text
    assert result.json()["score"] == 10

    repeated = await integration_client.post(
        f"/api/v1/attempts/{attempt_id}/submit", headers=headers
    )
    assert repeated.status_code == 200
    assert repeated.json() == result.json()

    rejected = await integration_client.put(
        f"/api/v1/attempts/{attempt_id}/responses/{question_id}",
        headers=headers,
        json={"answer": "Changed"},
    )
    assert rejected.status_code == 409

    statistics = await integration_client.get(
        f"/api/v1/exams/{exam_id}/statistics", headers=headers
    )
    assert statistics.status_code == 200
    assert statistics.json()["attempt_count"] == 1
    assert statistics.json()["low_confidence"] is True
