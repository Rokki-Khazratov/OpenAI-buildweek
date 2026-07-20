"""Add versioned blueprints and evidence-based evaluations.

Revision ID: 20260720_0007
Revises: 20260719_0006
Create Date: 2026-07-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260720_0007"
down_revision: str | None = "20260719_0006"
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


def upgrade() -> None:
    op.create_table(
        "exam_blueprints",
        sa.Column("exam_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "extracting",
                "draft",
                "approved",
                "failed",
                "stale",
                name="blueprint_status",
                native_enum=False,
                create_constraint=True,
            ),
            server_default="extracting",
            nullable=False,
        ),
        sa.Column(
            "content",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "source_artifact_ids",
            postgresql.JSONB(),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("source_revision_hash", sa.String(64), nullable=False),
        sa.Column("provider", sa.String(64), nullable=False),
        sa.Column("model", sa.String(120), nullable=False),
        sa.Column("prompt_version", sa.String(64), nullable=False),
        sa.Column("schema_version", sa.String(64), nullable=False),
        sa.Column("input_hash", sa.String(64), nullable=False),
        sa.Column("idempotency_key", sa.String(200)),
        sa.Column("overall_confidence", sa.Float(), server_default="0", nullable=False),
        sa.Column(
            "validation_errors",
            postgresql.JSONB(),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("error_code", sa.String(120)),
        sa.Column("error_message", sa.Text()),
        sa.Column("approved_by", sa.Uuid()),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("id", sa.Uuid(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["exam_id"], ["exams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("exam_id", "version", name="uq_exam_blueprints_exam_version"),
        sa.UniqueConstraint(
            "exam_id", "idempotency_key", name="uq_exam_blueprints_exam_idempotency"
        ),
    )
    op.create_index(op.f("ix_exam_blueprints_exam_id"), "exam_blueprints", ["exam_id"])
    op.create_index(op.f("ix_exam_blueprints_status"), "exam_blueprints", ["status"])

    op.add_column("mock_exams", sa.Column("blueprint_id", sa.Uuid()))
    op.add_column(
        "mock_exams",
        sa.Column(
            "generation_metadata",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    op.create_foreign_key(
        "fk_mock_exams_blueprint_id_exam_blueprints",
        "mock_exams",
        "exam_blueprints",
        ["blueprint_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_mock_exams_blueprint_id"), "mock_exams", ["blueprint_id"])

    op.add_column(
        "mock_questions",
        sa.Column(
            "skill_ids",
            postgresql.JSONB(),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column(
        "mock_questions",
        sa.Column("difficulty", sa.String(32), server_default="matched", nullable=False),
    )
    op.add_column(
        "mock_questions",
        sa.Column("grading_mode", sa.String(32), server_default="rubric", nullable=False),
    )
    op.add_column(
        "mock_questions",
        sa.Column(
            "rubric",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )

    op.create_table(
        "question_evaluations",
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("question_id", sa.Uuid(), nullable=False),
        sa.Column("strategy", sa.String(32), nullable=False),
        sa.Column("awarded_points", sa.Integer(), nullable=False),
        sa.Column("max_points", sa.Integer(), nullable=False),
        sa.Column(
            "dimension_scores",
            postgresql.JSONB(),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "answer_evidence",
            postgresql.JSONB(),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "source_evidence",
            postgresql.JSONB(),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "feedback",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("confidence", sa.Float(), server_default="0", nullable=False),
        sa.Column(
            "flags",
            postgresql.JSONB(),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "evaluator_metadata",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["mock_questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("attempt_id", "question_id"),
    )
    op.create_index(
        op.f("ix_question_evaluations_attempt_id"), "question_evaluations", ["attempt_id"]
    )
    op.create_index(
        op.f("ix_question_evaluations_question_id"), "question_evaluations", ["question_id"]
    )


def downgrade() -> None:
    op.drop_table("question_evaluations")
    op.drop_column("mock_questions", "rubric")
    op.drop_column("mock_questions", "grading_mode")
    op.drop_column("mock_questions", "difficulty")
    op.drop_column("mock_questions", "skill_ids")
    op.drop_index(op.f("ix_mock_exams_blueprint_id"), table_name="mock_exams")
    op.drop_constraint(
        "fk_mock_exams_blueprint_id_exam_blueprints", "mock_exams", type_="foreignkey"
    )
    op.drop_column("mock_exams", "generation_metadata")
    op.drop_column("mock_exams", "blueprint_id")
    op.drop_table("exam_blueprints")
