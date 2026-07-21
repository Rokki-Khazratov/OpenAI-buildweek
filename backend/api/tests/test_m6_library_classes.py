"""M6 integration coverage for safe Library clones and cohort dashboards."""

import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import cast

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr
from sqlalchemy import text

from app.core.config import Environment, Settings
from app.db.models.attempt import (
    Attempt,
    AttemptStatus,
    MockExam,
    MockQuestion,
    QuestionEvaluation,
)
from app.db.models.blueprint import BlueprintStatus, ExamBlueprint
from app.db.session import Database
from app.main import create_app

pytestmark = pytest.mark.integration


@pytest.fixture
async def m6_harness() -> AsyncIterator[tuple[AsyncClient, Database]]:
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
                    "class_members, question_evaluations, attempt_responses, attempts, "
                    "mock_questions, mock_exams, exam_blueprints, artifact_chunks, "
                    "artifact_pages, artifact_processing_jobs, artifacts, class_exams, "
                    "classes, exams, workspace_members, workspaces, refresh_tokens, users "
                    "RESTART IDENTITY CASCADE"
                )
            )

    await truncate()
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            yield client, database
        await truncate()


async def register_and_login(
    client: AsyncClient, email: str, display_name: str
) -> tuple[dict[str, str], str]:
    created = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "correct horse battery staple",
            "display_name": display_name,
        },
    )
    assert created.status_code == 201, created.text
    token = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "correct horse battery staple"},
    )
    assert token.status_code == 200, token.text
    return (
        {"Authorization": f"Bearer {token.json()['access_token']}"},
        cast(str, created.json()["id"]),
    )


def blueprint_content() -> dict[str, object]:
    return {
        "sections": [
            {
                "id": "core",
                "title": "Core reasoning",
                "question_type": "open",
                "question_count": 1,
                "duration_minutes": 30,
                "points": 10,
                "skills": ["reasoning"],
                "confidence": 0.95,
                "source_refs": ["private-chunk-id"],
            }
        ],
        "rules": {
            "duration_minutes": 30,
            "total_points": 10,
            "pass_percentage": 50,
            "penalty": "",
            "allowed_materials": "None",
            "grading_notes": "Show work",
            "source_refs": ["private-chunk-id"],
        },
        "skill_taxonomy": [{"id": "reasoning", "label": "Reasoning"}],
        "unresolved_fields": [],
        "overall_confidence": 0.95,
        "evidence": [{"chunk_id": "private-chunk-id", "quote": "secret source quote"}],
    }


async def test_library_clone_membership_and_dashboard_are_safe(
    m6_harness: tuple[AsyncClient, Database],
) -> None:
    client, database = m6_harness
    owner_headers, owner_id = await register_and_login(client, "owner@example.com", "Professor Ada")
    learner_headers, learner_id = await register_and_login(
        client, "learner@example.com", "Student Lin"
    )
    subject_response = await client.post(
        "/api/v1/subjects",
        headers=owner_headers,
        json={
            "title": "Algorithms",
            "university": "TU Wien",
            "course_code": "CS-301",
            "visibility": "private",
        },
    )
    assert subject_response.status_code == 201
    subject_id = subject_response.json()["id"]
    exam_response = await client.post(
        f"/api/v1/subjects/{subject_id}/exams",
        headers=owner_headers,
        json={
            "title": "Algorithms final",
            "description": "A verified final exam contract.",
            "exam_type": "Written final",
            "language": "en",
            "pasted_context": "PRIVATE NOTES MUST NEVER LEAVE",
            "sources": [
                {
                    "id": "source-1",
                    "name": "private.pdf",
                    "kind": "past_exam",
                    "size": "1 MB",
                    "status": "ready",
                }
            ],
            "blueprint": [
                {
                    "id": "core",
                    "title": "Core reasoning",
                    "questionType": "open",
                    "questionCount": 1,
                    "durationMinutes": 30,
                    "points": 10,
                }
            ],
            "rules": {
                "durationMinutes": 30,
                "totalPoints": 10,
                "passPercentage": 50,
                "penalty": "",
                "allowedMaterials": "None",
                "gradingNotes": "Show work",
            },
            "scenario": {
                "mode": "full_exam",
                "difficulty": "matched",
                "instructions": "Follow the approved structure.",
            },
        },
    )
    assert exam_response.status_code == 201, exam_response.text
    exam_id = exam_response.json()["id"]
    async with database.session() as session, session.begin():
        session.add(
            ExamBlueprint(
                exam_id=exam_id,
                version=3,
                status=BlueprintStatus.APPROVED,
                content=blueprint_content(),
                source_artifact_ids=["private-artifact-id"],
                source_revision_hash="a" * 64,
                provider="vertex",
                model="gemini-flash",
                prompt_version="test.v1",
                schema_version="blueprint.v1",
                input_hash="b" * 64,
                overall_confidence=0.95,
                validation_errors=[],
                approved_by=owner_id,
                approved_at=datetime.now(UTC),
            )
        )

    published = await client.put(
        f"/api/v1/exams/{exam_id}/publication",
        headers=owner_headers,
        json={"rights_note": "Private study use only."},
    )
    assert published.status_code == 200, published.text
    publication_id = published.json()["id"]
    discovered = await client.get(
        "/api/v1/library/publications?query=algorithms&language=en&exam_type=written%20final",
        headers=learner_headers,
    )
    assert discovered.status_code == 200
    assert discovered.json()["total"] == 1
    public_text = discovered.text.casefold()
    for private_value in (
        "private notes",
        "private.pdf",
        "private-chunk-id",
        "secret source quote",
        "private-artifact-id",
        "source_refs",
        "evidence",
    ):
        assert private_value not in public_text

    cloned = await client.post(
        f"/api/v1/library/publications/{publication_id}/clone",
        headers=learner_headers,
    )
    assert cloned.status_code == 200, cloned.text
    clone = cloned.json()
    assert clone["already_cloned"] is False
    repeated = await client.post(
        f"/api/v1/library/publications/{publication_id}/clone",
        headers=learner_headers,
    )
    assert repeated.json() == {**clone, "already_cloned": True}
    clone_exam = await client.get(f"/api/v1/exams/{clone['exam_id']}", headers=learner_headers)
    assert clone_exam.json()["pasted_context"] == ""
    assert clone_exam.json()["sources"] == []
    changed = await client.patch(
        f"/api/v1/exams/{clone['exam_id']}",
        headers=learner_headers,
        json={"title": "My independent copy", "configuration_version": 1},
    )
    assert changed.status_code == 200, changed.text
    original = await client.get(f"/api/v1/exams/{exam_id}", headers=owner_headers)
    assert original.json()["title"] == "Algorithms final"

    class_response = await client.post(
        f"/api/v1/subjects/{subject_id}/classes",
        headers=owner_headers,
        json={"name": "Final cohort", "exam_scope": "selected_exams", "exam_ids": [exam_id]},
    )
    assert class_response.status_code == 201, class_response.text
    class_id = class_response.json()["id"]
    added = await client.post(
        f"/api/v1/classes/{class_id}/members",
        headers=owner_headers,
        json={"email": "LEARNER@example.com"},
    )
    assert added.status_code == 201, added.text
    assert "email" not in added.json()
    duplicate = await client.post(
        f"/api/v1/classes/{class_id}/members",
        headers=owner_headers,
        json={"email": "learner@example.com"},
    )
    assert duplicate.status_code == 409
    accessible = await client.get(f"/api/v1/subjects/{subject_id}", headers=learner_headers)
    assert accessible.status_code == 200
    forbidden_dashboard = await client.get(
        f"/api/v1/classes/{class_id}/dashboard", headers=learner_headers
    )
    assert forbidden_dashboard.status_code == 404

    empty_dashboard = await client.get(
        f"/api/v1/classes/{class_id}/dashboard", headers=owner_headers
    )
    assert empty_dashboard.status_code == 200
    assert empty_dashboard.json()["active_learners"] == 0
    assert empty_dashboard.json()["readiness_coverage"] == 0

    async with database.session() as session, session.begin():
        mock = MockExam(
            exam_id=exam_id,
            blueprint_id=None,
            generator="test",
            title="Dashboard fixture",
            instructions="",
            duration_minutes=30,
            max_score=10,
            generation_metadata={},
        )
        session.add(mock)
        await session.flush()
        question = MockQuestion(
            mock_exam_id=mock.id,
            section_id="core",
            position=1,
            question_type="open",
            prompt="Explain the reasoning.",
            points=10,
            answer_key="private answer key",
            citations=[],
            skill_ids=["reasoning"],
            difficulty="matched",
            grading_mode="rubric",
            rubric={},
        )
        session.add(question)
        await session.flush()
        mock_id = mock.id
        question_id = question.id
        for user_id, score in ((owner_id, 8), (learner_id, 4)):
            attempt = Attempt(
                mock_exam_id=mock.id,
                exam_id=exam_id,
                user_id=user_id,
                status=AttemptStatus.EVALUATED,
                submitted_at=datetime.now(UTC),
                duration_seconds=1200,
                score=score,
                max_score=10,
                result={"feedback": "private feedback"},
            )
            session.add(attempt)
            await session.flush()
            session.add(
                QuestionEvaluation(
                    attempt_id=attempt.id,
                    question_id=question.id,
                    strategy="deterministic",
                    awarded_points=score,
                    max_points=10,
                    dimension_scores=[],
                    answer_evidence=["private answer excerpt"],
                    source_evidence=[],
                    feedback={"improvement": "private coaching"},
                    confidence=1,
                    flags=[],
                    evaluator_metadata={},
                )
            )

    dashboard = await client.get(
        f"/api/v1/classes/{class_id}/dashboard?exam_id={exam_id}",
        headers=owner_headers,
    )
    assert dashboard.status_code == 200, dashboard.text
    metrics = dashboard.json()
    assert metrics["member_count"] == 2
    assert metrics["active_learners"] == 2
    assert metrics["total_attempts"] == 2
    assert metrics["average_percentage"] == 60
    assert metrics["readiness_percentage"] == 60
    assert metrics["readiness_coverage"] == 1
    assert metrics["pass_rate"] == 50
    assert metrics["weak_skills"] == [{"skill_id": "reasoning", "percentage": 60, "support": 2}]
    dashboard_text = dashboard.text.casefold()
    for private_value in ("answer", "feedback", "coaching", "excerpt", "email"):
        assert private_value not in dashboard_text

    analytics = await client.get(f"/api/v1/exams/{exam_id}/analytics", headers=owner_headers)
    assert analytics.status_code == 200, analytics.text
    profile = analytics.json()
    assert profile["model_version"] == "analytics.v1"
    assert profile["readiness"]["status"] == "early_signal"
    assert profile["readiness"]["index"] is not None
    assert profile["skills"][0]["skill_id"] == "reasoning"
    assert profile["skills"][0]["mastery"] == 0.8
    assert profile["adaptive"]["eligible"] is True
    assert profile["adaptive"]["target_skill_ids"] == ["reasoning"]
    for private_value in (
        "private answer",
        "private feedback",
        "private coaching",
        "private answer excerpt",
    ):
        assert private_value not in analytics.text.casefold()

    overview = await client.get("/api/v1/analytics/overview", headers=owner_headers)
    assert overview.status_code == 200, overview.text
    assert overview.json()["total_attempts"] == 1
    assert overview.json()["total_evaluated_questions"] == 1
    assert overview.json()["next_action"]["exam_id"] == exam_id

    adaptive = await client.post(
        f"/api/v1/exams/{exam_id}/mocks",
        headers=owner_headers,
        json={"mode": "adaptive"},
    )
    assert adaptive.status_code == 201, adaptive.text
    generated = adaptive.json()
    assert generated["generation_metadata"]["generation_mode"] == "adaptive"
    assert generated["generation_metadata"]["target_skills"] == ["reasoning"]
    assert generated["questions"][0]["skill_ids"] == ["reasoning"]

    readiness_before = profile["readiness"]["index"]
    async with database.session() as session, session.begin():
        improved_attempt = Attempt(
            mock_exam_id=mock_id,
            exam_id=exam_id,
            user_id=owner_id,
            status=AttemptStatus.EVALUATED,
            submitted_at=datetime.now(UTC),
            duration_seconds=900,
            score=10,
            max_score=10,
            result={"feedback": "new private feedback"},
        )
        session.add(improved_attempt)
        await session.flush()
        session.add(
            QuestionEvaluation(
                attempt_id=improved_attempt.id,
                question_id=question_id,
                strategy="deterministic",
                awarded_points=10,
                max_points=10,
                dimension_scores=[],
                answer_evidence=["new private answer excerpt"],
                source_evidence=[],
                feedback={"improvement": "new private coaching"},
                confidence=1,
                flags=[],
                evaluator_metadata={},
            )
        )

    updated_analytics = await client.get(
        f"/api/v1/exams/{exam_id}/analytics", headers=owner_headers
    )
    assert updated_analytics.status_code == 200, updated_analytics.text
    updated_profile = updated_analytics.json()
    assert updated_profile["attempt_ids"] != profile["attempt_ids"]
    assert len(updated_profile["attempt_ids"]) == 2
    assert updated_profile["readiness"]["index"] > readiness_before
    for private_value in (
        "new private feedback",
        "new private coaching",
        "new private answer excerpt",
    ):
        assert private_value not in updated_analytics.text.casefold()
