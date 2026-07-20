"""Deterministic P0 mocks, questions, attempts, and responses."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
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
    blueprint_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("exam_blueprints.id", ondelete="SET NULL"), index=True
    )
    generator: Mapped[str] = mapped_column(
        String(64), default="deterministic_demo", server_default="deterministic_demo"
    )
    title: Mapped[str] = mapped_column(String(240))
    instructions: Mapped[str] = mapped_column(Text, default="", server_default="")
    duration_minutes: Mapped[int] = mapped_column(Integer)
    max_score: Mapped[int] = mapped_column(Integer)
    generation_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default="{}"
    )


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
    skill_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    difficulty: Mapped[str] = mapped_column(String(32), default="matched", server_default="matched")
    grading_mode: Mapped[str] = mapped_column(String(32), default="rubric", server_default="rubric")
    rubric: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")


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


class QuestionEvaluation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One validated grading fact per question and attempt."""

    __tablename__ = "question_evaluations"
    __table_args__ = (UniqueConstraint("attempt_id", "question_id"),)

    attempt_id: Mapped[UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[UUID] = mapped_column(
        ForeignKey("mock_questions.id", ondelete="CASCADE"), index=True
    )
    strategy: Mapped[str] = mapped_column(String(32))
    awarded_points: Mapped[int] = mapped_column(Integer)
    max_points: Mapped[int] = mapped_column(Integer)
    dimension_scores: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, server_default="[]"
    )
    answer_evidence: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    source_evidence: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, server_default="[]"
    )
    feedback: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    confidence: Mapped[float] = mapped_column(Float, default=0, server_default="0")
    flags: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    evaluator_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default="{}"
    )
