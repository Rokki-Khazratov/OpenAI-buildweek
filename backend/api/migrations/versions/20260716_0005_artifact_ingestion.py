"""Add private artifacts and durable ingestion records.

Revision ID: 20260716_0005
Revises: 20260716_0004
Create Date: 2026-07-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260716_0005"
down_revision: str | None = "20260716_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    ]


def string_enum(name: str, *values: str) -> sa.Enum:
    return sa.Enum(*values, name=name, native_enum=False, create_constraint=True)


def upgrade() -> None:
    op.create_table(
        "artifacts",
        sa.Column("exam_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column(
            "kind",
            string_enum(
                "artifact_kind", "past_exam", "rubric", "notes", "solutions", "syllabus", "other"
            ),
            nullable=False,
        ),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("declared_media_type", sa.String(160), nullable=False),
        sa.Column("detected_media_type", sa.String(160)),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(64)),
        sa.Column("storage_key", sa.String(600), nullable=False),
        sa.Column("storage_etag", sa.String(200)),
        sa.Column(
            "upload_status",
            string_enum("artifact_upload_status", "pending", "uploaded", "expired", "cancelled"),
            server_default="pending",
            nullable=False,
        ),
        sa.Column(
            "processing_status",
            string_enum(
                "artifact_processing_status",
                "not_queued",
                "queued",
                "processing",
                "ready",
                "failed",
                "deleting",
            ),
            server_default="not_queued",
            nullable=False,
        ),
        sa.Column("failure_code", sa.String(120)),
        sa.Column("failure_message", sa.String(500)),
        sa.Column("parser_version", sa.String(64)),
        sa.Column("page_count", sa.Integer()),
        sa.Column("character_count", sa.Integer()),
        sa.Column("uploaded_at", sa.DateTime(timezone=True)),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.Column("id", sa.Uuid(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["exam_id"], ["exams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key"),
    )
    op.create_index(op.f("ix_artifacts_exam_id"), "artifacts", ["exam_id"])
    op.create_index(op.f("ix_artifacts_owner_id"), "artifacts", ["owner_id"])

    op.create_table(
        "artifact_processing_jobs",
        sa.Column("artifact_id", sa.Uuid(), nullable=False),
        sa.Column("job_type", sa.String(32), server_default="ingest", nullable=False),
        sa.Column(
            "status",
            string_enum(
                "artifact_job_status", "queued", "running", "succeeded", "failed", "cancelled"
            ),
            server_default="queued",
            nullable=False,
        ),
        sa.Column("idempotency_key", sa.String(200), nullable=False),
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("max_attempts", sa.Integer(), server_default="3", nullable=False),
        sa.Column(
            "available_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("worker_id", sa.String(200)),
        sa.Column("error_code", sa.String(120)),
        sa.Column("error_detail", sa.String(500)),
        sa.Column("id", sa.Uuid(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["artifact_id"], ["artifacts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index(
        op.f("ix_artifact_processing_jobs_artifact_id"), "artifact_processing_jobs", ["artifact_id"]
    )
    op.create_index(
        op.f("ix_artifact_processing_jobs_status"), "artifact_processing_jobs", ["status"]
    )

    op.create_table(
        "artifact_pages",
        sa.Column("artifact_id", sa.Uuid(), nullable=False),
        sa.Column("parser_version", sa.String(64), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("heading", sa.String(500)),
        sa.Column(
            "metadata", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["artifact_id"], ["artifacts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("artifact_id", "parser_version", "page_number"),
    )
    op.create_index(op.f("ix_artifact_pages_artifact_id"), "artifact_pages", ["artifact_id"])

    op.create_table(
        "artifact_chunks",
        sa.Column("artifact_id", sa.Uuid(), nullable=False),
        sa.Column("page_id", sa.Uuid()),
        sa.Column("parser_version", sa.String(64), nullable=False),
        sa.Column("chunker_version", sa.String(64), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("start_offset", sa.Integer(), nullable=False),
        sa.Column("end_offset", sa.Integer(), nullable=False),
        sa.Column(
            "metadata", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["artifact_id"], ["artifacts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["page_id"], ["artifact_pages.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("artifact_id", "parser_version", "chunker_version", "chunk_index"),
    )
    op.create_index(op.f("ix_artifact_chunks_artifact_id"), "artifact_chunks", ["artifact_id"])
    op.create_index(op.f("ix_artifact_chunks_page_id"), "artifact_chunks", ["page_id"])


def downgrade() -> None:
    op.drop_table("artifact_chunks")
    op.drop_table("artifact_pages")
    op.drop_table("artifact_processing_jobs")
    op.drop_table("artifacts")
