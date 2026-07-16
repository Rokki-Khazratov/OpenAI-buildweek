"""Private Exam artifacts and durable ingestion state."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


def enum_column(enum_type: type[StrEnum], name: str) -> Enum:
    return Enum(
        enum_type,
        name=name,
        native_enum=False,
        create_constraint=True,
        validate_strings=True,
        values_callable=lambda members: [member.value for member in members],
    )


class ArtifactKind(StrEnum):
    PAST_EXAM = "past_exam"
    RUBRIC = "rubric"
    NOTES = "notes"
    SOLUTIONS = "solutions"
    SYLLABUS = "syllabus"
    OTHER = "other"


class UploadStatus(StrEnum):
    PENDING = "pending"
    UPLOADED = "uploaded"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class ProcessingStatus(StrEnum):
    NOT_QUEUED = "not_queued"
    QUEUED = "queued"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"
    DELETING = "deleting"


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Artifact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "artifacts"

    exam_id: Mapped[UUID] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[ArtifactKind] = mapped_column(enum_column(ArtifactKind, "artifact_kind"))
    original_name: Mapped[str] = mapped_column(String(255))
    declared_media_type: Mapped[str] = mapped_column(String(160))
    detected_media_type: Mapped[str | None] = mapped_column(String(160))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str | None] = mapped_column(String(64))
    storage_key: Mapped[str] = mapped_column(String(600), unique=True)
    storage_etag: Mapped[str | None] = mapped_column(String(200))
    upload_status: Mapped[UploadStatus] = mapped_column(
        enum_column(UploadStatus, "artifact_upload_status"),
        default=UploadStatus.PENDING,
        server_default=UploadStatus.PENDING.value,
    )
    processing_status: Mapped[ProcessingStatus] = mapped_column(
        enum_column(ProcessingStatus, "artifact_processing_status"),
        default=ProcessingStatus.NOT_QUEUED,
        server_default=ProcessingStatus.NOT_QUEUED.value,
    )
    failure_code: Mapped[str | None] = mapped_column(String(120))
    failure_message: Mapped[str | None] = mapped_column(String(500))
    parser_version: Mapped[str | None] = mapped_column(String(64))
    page_count: Mapped[int | None] = mapped_column(Integer)
    character_count: Mapped[int | None] = mapped_column(Integer)
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ArtifactProcessingJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "artifact_processing_jobs"

    artifact_id: Mapped[UUID] = mapped_column(
        ForeignKey("artifacts.id", ondelete="CASCADE"), index=True
    )
    job_type: Mapped[str] = mapped_column(String(32), default="ingest", server_default="ingest")
    status: Mapped[JobStatus] = mapped_column(
        enum_column(JobStatus, "artifact_job_status"),
        default=JobStatus.QUEUED,
        server_default=JobStatus.QUEUED.value,
        index=True,
    )
    idempotency_key: Mapped[str] = mapped_column(String(200), unique=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, server_default="3")
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    worker_id: Mapped[str | None] = mapped_column(String(200))
    error_code: Mapped[str | None] = mapped_column(String(120))
    error_detail: Mapped[str | None] = mapped_column(String(500))


class ArtifactPage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "artifact_pages"
    __table_args__ = (UniqueConstraint("artifact_id", "parser_version", "page_number"),)

    artifact_id: Mapped[UUID] = mapped_column(
        ForeignKey("artifacts.id", ondelete="CASCADE"), index=True
    )
    parser_version: Mapped[str] = mapped_column(String(64))
    page_number: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    heading: Mapped[str | None] = mapped_column(String(500))
    attributes: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, default=dict, server_default="{}"
    )


class ArtifactChunk(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "artifact_chunks"
    __table_args__ = (
        UniqueConstraint("artifact_id", "parser_version", "chunker_version", "chunk_index"),
    )

    artifact_id: Mapped[UUID] = mapped_column(
        ForeignKey("artifacts.id", ondelete="CASCADE"), index=True
    )
    page_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("artifact_pages.id", ondelete="CASCADE"), index=True
    )
    parser_version: Mapped[str] = mapped_column(String(64))
    chunker_version: Mapped[str] = mapped_column(String(64))
    chunk_index: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int] = mapped_column(Integer)
    start_offset: Mapped[int] = mapped_column(Integer)
    end_offset: Mapped[int] = mapped_column(Integer)
    attributes: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, default=dict, server_default="{}"
    )
