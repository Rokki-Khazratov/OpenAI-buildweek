"""Add D1-D3 analytics foundation.

Revision ID: 20260721_0009
Revises: 20260720_0008
Create Date: 2026-07-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260721_0009"
down_revision: str | None = "20260720_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def identity_timestamps() -> list[sa.Column]:
    return [
        sa.Column("id", sa.Uuid(), nullable=False),
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
        "skill_observations",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("exam_id", sa.Uuid(), nullable=False),
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("question_id", sa.Uuid(), nullable=False),
        sa.Column("skill_id", sa.String(200), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("normalized_score", sa.Float(), nullable=False),
        sa.Column("point_share", sa.Float(), nullable=False),
        sa.Column("evaluation_confidence", sa.Float(), nullable=False),
        sa.Column("difficulty", sa.String(32), server_default="matched", nullable=False),
        sa.Column("duration_seconds", sa.Integer()),
        sa.Column("taxonomy_source", sa.String(64), server_default="blueprint", nullable=False),
        sa.Column("evaluation_model_version", sa.String(160), nullable=False),
        sa.Column(
            "contract_version", sa.String(32), server_default="skill_observation.v1", nullable=False
        ),
        *identity_timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exam_id"], ["exams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["mock_questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "attempt_id",
            "question_id",
            "skill_id",
            "contract_version",
            name="uq_skill_observation_fact_version",
        ),
    )
    for column in ("user_id", "exam_id", "attempt_id", "question_id", "skill_id", "observed_at"):
        op.create_index(op.f(f"ix_skill_observations_{column}"), "skill_observations", [column])

    op.create_table(
        "analytics_snapshots",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("exam_id", sa.Uuid(), nullable=False),
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("model_version", sa.String(64), nullable=False),
        sa.Column("policy_version", sa.String(64), nullable=False),
        sa.Column("input_revision_hash", sa.String(64), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("readiness_index", sa.Float()),
        sa.Column("readiness_confidence", sa.Float(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        *identity_timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exam_id"], ["exams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["attempt_id"], ["attempts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "attempt_id",
            "model_version",
            "input_revision_hash",
            name="uq_analytics_snapshot_revision",
        ),
    )
    for column in (
        "user_id",
        "exam_id",
        "attempt_id",
        "model_version",
        "policy_version",
        "computed_at",
    ):
        op.create_index(op.f(f"ix_analytics_snapshots_{column}"), "analytics_snapshots", [column])

    op.create_table(
        "analytics_shadow_results",
        sa.Column("snapshot_id", sa.Uuid(), nullable=False),
        sa.Column("candidate_version", sa.String(64), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("comparison", postgresql.JSONB(), nullable=False),
        *identity_timestamps(),
        sa.ForeignKeyConstraint(["snapshot_id"], ["analytics_snapshots.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "snapshot_id", "candidate_version", name="uq_analytics_shadow_candidate"
        ),
    )
    op.create_index(
        op.f("ix_analytics_shadow_results_snapshot_id"), "analytics_shadow_results", ["snapshot_id"]
    )
    op.create_index(
        op.f("ix_analytics_shadow_results_candidate_version"),
        "analytics_shadow_results",
        ["candidate_version"],
    )

    op.create_table(
        "skill_taxonomy_entries",
        sa.Column("exam_id", sa.Uuid(), nullable=False),
        sa.Column("canonical_skill_id", sa.String(200), nullable=False),
        sa.Column("display_label", sa.String(240), nullable=False),
        sa.Column("aliases", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("blueprint_versions", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("source_section_ids", postgresql.JSONB(), server_default="[]", nullable=False),
        *identity_timestamps(),
        sa.ForeignKeyConstraint(["exam_id"], ["exams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("exam_id", "canonical_skill_id", name="uq_exam_canonical_skill"),
    )
    op.create_index(
        op.f("ix_skill_taxonomy_entries_exam_id"), "skill_taxonomy_entries", ["exam_id"]
    )

    op.create_table(
        "cohort_analytics_events",
        sa.Column("class_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("event_name", sa.String(80), nullable=False),
        sa.Column("model_version", sa.String(64), nullable=False),
        sa.Column("properties", postgresql.JSONB(), server_default="{}", nullable=False),
        *identity_timestamps(),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("class_id", "actor_id", "event_name"):
        op.create_index(
            op.f(f"ix_cohort_analytics_events_{column}"), "cohort_analytics_events", [column]
        )


def downgrade() -> None:
    op.drop_table("cohort_analytics_events")
    op.drop_table("skill_taxonomy_entries")
    op.drop_table("analytics_shadow_results")
    op.drop_table("analytics_snapshots")
    op.drop_table("skill_observations")
