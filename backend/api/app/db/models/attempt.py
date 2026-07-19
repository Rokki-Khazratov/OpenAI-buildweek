"""Deterministic P0 mocks, questions, attempts, and responses."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AttemptStatus(StrEnum):
    IN_PROGRESS = "in_progress"
    EVALUATED = "evaluated"


class MockExam(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mock_exams"

    exam_id: Mapped[UUID] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    generator: Mapped[str] = mapped_column(
        String(64), default="deterministic_demo", server_default="deterministic_demo"
    )
    title: Mapped[str] = mapped_column(String(240))
    instructions: Mapped[str] = mapped_column(Text, default="", server_default="")
    duration_minutes: Mapped[int] = mapped_column(Integer)
    max_score: Mapped[int] = mapped_column(Integer)


class MockQuestion(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "mock_questions"
    __table_args__ = (UniqueConstraint("mock_exam_id", "position"),)

    mock_exam_id: Mapped[UUID] = mapped_column(
        ForeignKey("mock_exams.id", ondelete="CASCADE"), index=True
    )
    section_id: Mapped[str] = mapped_column(String(200))
    position: Mapped[int] = mapped_column(Integer)
    question_type: Mapped[str] = mapped_column(String(120))
    prompt: Mapped[str] = mapped_column(Text)
    points: Mapped[int] = mapped_column(Integer)
    answer_key: Mapped[str] = mapped_column(Text)
    citations: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, server_default="[]"
    )
    topic: Mapped[str | None] = mapped_column(String(200))


class Attempt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "attempts"

    mock_exam_id: Mapped[UUID] = mapped_column(
        ForeignKey("mock_exams.id", ondelete="CASCADE"), index=True
    )
    exam_id: Mapped[UUID] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[AttemptStatus] = mapped_column(
        Enum(
            AttemptStatus,
            name="attempt_status",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        default=AttemptStatus.IN_PROGRESS,
        server_default=AttemptStatus.IN_PROGRESS.value,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_saved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    score: Mapped[int | None] = mapped_column(Integer)
    max_score: Mapped[int] = mapped_column(Integer)
    result: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")


class AttemptResponse(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "attempt_responses"
    __table_args__ = (UniqueConstraint("attempt_id", "question_id"),)

    attempt_id: Mapped[UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[UUID] = mapped_column(ForeignKey("mock_questions.id", ondelete="CASCADE"))
    answer: Mapped[str] = mapped_column(Text, default="", server_default="")
    flagged: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    saved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
