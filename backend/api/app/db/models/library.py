"""Published exam contracts and their private clones."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class LibraryPublication(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A privacy-safe, immutable-at-read snapshot of one Exam contract."""

    __tablename__ = "library_publications"
    __table_args__ = (
        UniqueConstraint("source_exam_id", name="uq_library_publications_source_exam"),
    )

    publisher_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    source_exam_id: Mapped[UUID] = mapped_column(
        ForeignKey("exams.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    subject_title: Mapped[str] = mapped_column(String(200))
    university: Mapped[str | None] = mapped_column(String(200))
    course_code: Mapped[str | None] = mapped_column(String(64))
    exam_type: Mapped[str | None] = mapped_column(String(120))
    language: Mapped[str] = mapped_column(String(32))
    blueprint_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB)
    rules_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB)
    scenario_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB)
    source_configuration_version: Mapped[int] = mapped_column(Integer)
    blueprint_version: Mapped[int] = mapped_column(Integer)
    rights_note: Mapped[str] = mapped_column(Text, default="", server_default="")
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    clone_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class LibraryClone(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Provenance for a user's idempotent private clone."""

    __tablename__ = "library_clones"
    __table_args__ = (
        UniqueConstraint("publication_id", "user_id", name="uq_library_clones_publication_user"),
    )

    publication_id: Mapped[UUID] = mapped_column(
        ForeignKey("library_publications.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    exam_id: Mapped[UUID] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
