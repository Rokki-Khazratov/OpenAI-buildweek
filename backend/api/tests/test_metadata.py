"""Initial ORM metadata checks."""

from app.db import models  # noqa: F401
from app.db.base import Base


def test_initial_schema_tables_are_registered() -> None:
    assert set(Base.metadata.tables) == {
        "audit_events",
        "class_exams",
        "classes",
        "exams",
        "refresh_tokens",
        "users",
        "workspace_members",
        "workspaces",
    }
