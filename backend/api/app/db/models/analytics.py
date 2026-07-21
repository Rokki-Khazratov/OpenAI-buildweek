"""Versioned, privacy-safe analytics materializations."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SkillObservationRecord(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Canonical immutable evidence derived from a validated evaluation fact."""

    __tablename__ = "skill_observations"
    __table_args__ = (
        UniqueConstraint(
            "attempt_id",
            "question_id",
            "skill_id",
            "contract_version",
            name="uq_skill_observation_fact_version",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    exam_id: Mapped[UUID] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    attempt_id: Mapped[UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[UUID] = mapped_column(
        ForeignKey("mock_questions.id", ondelete="CASCADE"), index=True
    )
    skill_id: Mapped[str] = mapped_column(String(200), index=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    normalized_score: Mapped[float] = mapped_column(Float)
    point_share: Mapped[float] = mapped_column(Float)
    evaluation_confidence: Mapped[float] = mapped_column(Float)
    difficulty: Mapped[str] = mapped_column(String(32), server_default="matched")
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    taxonomy_source: Mapped[str] = mapped_column(String(64), server_default="blueprint")
    evaluation_model_version: Mapped[str] = mapped_column(String(160))
    contract_version: Mapped[str] = mapped_column(String(32), server_default="skill_observation.v1")


class AnalyticsSnapshot(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Append-only personal analytics result for one evidence revision."""

    __tablename__ = "analytics_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "attempt_id",
            "model_version",
            "input_revision_hash",
            name="uq_analytics_snapshot_revision",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    exam_id: Mapped[UUID] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    attempt_id: Mapped[UUID] = mapped_column(
        ForeignKey("attempts.id", ondelete="CASCADE"), index=True
    )
    model_version: Mapped[str] = mapped_column(String(64), index=True)
    policy_version: Mapped[str] = mapped_column(String(64), index=True)
    input_revision_hash: Mapped[str] = mapped_column(String(64))
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    readiness_index: Mapped[float | None] = mapped_column(Float)
    readiness_confidence: Mapped[float] = mapped_column(Float)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)


class AnalyticsShadowResult(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Candidate policy output kept separate from user-facing analytics."""

    __tablename__ = "analytics_shadow_results"
    __table_args__ = (
        UniqueConstraint("snapshot_id", "candidate_version", name="uq_analytics_shadow_candidate"),
    )

    snapshot_id: Mapped[UUID] = mapped_column(
        ForeignKey("analytics_snapshots.id", ondelete="CASCADE"), index=True
    )
    candidate_version: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
    comparison: Mapped[dict[str, Any]] = mapped_column(JSONB)


class SkillTaxonomyEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Stable skill identity with versioned aliases inside one exam."""

    __tablename__ = "skill_taxonomy_entries"
    __table_args__ = (
        UniqueConstraint("exam_id", "canonical_skill_id", name="uq_exam_canonical_skill"),
    )

    exam_id: Mapped[UUID] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    canonical_skill_id: Mapped[str] = mapped_column(String(200))
    display_label: Mapped[str] = mapped_column(String(240))
    aliases: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    blueprint_versions: Mapped[list[int]] = mapped_column(JSONB, default=list, server_default="[]")
    source_section_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")


class CohortAnalyticsEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Privacy-safe product event for cohort analytics experiments."""

    __tablename__ = "cohort_analytics_events"

    class_id: Mapped[UUID] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    event_name: Mapped[str] = mapped_column(String(80), index=True)
    model_version: Mapped[str] = mapped_column(String(64))
    properties: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
