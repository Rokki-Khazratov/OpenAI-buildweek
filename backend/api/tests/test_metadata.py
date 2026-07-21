"""Initial ORM metadata checks."""

from app.db import models  # noqa: F401
from app.db.base import Base


def test_initial_schema_tables_are_registered() -> None:
    assert set(Base.metadata.tables) == {
        "audit_events",
        "analytics_shadow_results",
        "analytics_snapshots",
        "artifact_chunks",
        "artifact_pages",
        "artifact_processing_jobs",
        "artifacts",
        "attempt_responses",
        "attempts",
        "class_exams",
        "class_members",
        "classes",
        "cohort_analytics_events",
        "exams",
        "exam_blueprints",
        "library_clones",
        "library_publications",
        "mock_exams",
        "mock_questions",
        "question_evaluations",
        "refresh_tokens",
        "skill_observations",
        "skill_taxonomy_entries",
        "users",
        "workspace_members",
        "workspaces",
    }
