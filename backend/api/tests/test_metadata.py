"""Initial ORM metadata checks."""

from app.db import models  # noqa: F401
from app.db.base import Base


def test_initial_schema_tables_are_registered() -> None:
    assert set(Base.metadata.tables) == {
        "audit_events",
        "artifact_chunks",
        "artifact_pages",
        "artifact_processing_jobs",
        "artifacts",
        "attempt_responses",
        "attempts",
        "class_exams",
        "classes",
        "exams",
        "mock_exams",
        "mock_questions",
        "refresh_tokens",
        "users",
        "workspace_members",
        "workspaces",
    }
