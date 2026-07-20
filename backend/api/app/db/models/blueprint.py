"""Versioned AI-extracted exam blueprints."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class BlueprintStatus(StrEnum):
    EXTRACTING = "extracting"
    DRAFT = "draft"
    APPROVED = "approved"
    FAILED = "failed"
    STALE = "stale"


class ExamBlueprint(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Immutable-by-version extraction result with an explicit review lifecycle."""

    __tablename__ = "exam_blueprints"
    __table_args__ = (
        UniqueConstraint("exam_id", "version", name="uq_exam_blueprints_exam_version"),
        UniqueConstraint("exam_id", "idempotency_key", name="uq_exam_blueprints_exam_idempotency"),
    )

    exam_id: Mapped[UUID] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    status: Mapped[BlueprintStatus] = mapped_column(
        Enum(
            BlueprintStatus,
            name="blueprint_status",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        default=BlueprintStatus.EXTRACTING,
        server_default=BlueprintStatus.EXTRACTING.value,
        index=True,
    )
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    source_artifact_ids: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    source_revision_hash: Mapped[str] = mapped_column(String(64))
    provider: Mapped[str] = mapped_column(String(64))
    model: Mapped[str] = mapped_column(String(120))
    prompt_version: Mapped[str] = mapped_column(String(64))
    schema_version: Mapped[str] = mapped_column(String(64))
    input_hash: Mapped[str] = mapped_column(String(64))
    idempotency_key: Mapped[str | None] = mapped_column(String(200))
    overall_confidence: Mapped[float] = mapped_column(Float, default=0, server_default="0")
    validation_errors: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, server_default="[]"
    )
    error_code: Mapped[str | None] = mapped_column(String(120))
    error_message: Mapped[str | None] = mapped_column(Text)
    approved_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
