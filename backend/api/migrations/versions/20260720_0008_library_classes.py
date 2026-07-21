"""Add Exam Library publication and Class membership.

Revision ID: 20260720_0008
Revises: 20260720_0007
Create Date: 2026-07-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260720_0008"
down_revision: str | None = "20260720_0007"
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
        "library_publications",
        sa.Column("publisher_id", sa.Uuid(), nullable=False),
        sa.Column("source_exam_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("subject_title", sa.String(200), nullable=False),
        sa.Column("university", sa.String(200)),
        sa.Column("course_code", sa.String(64)),
        sa.Column("exam_type", sa.String(120)),
        sa.Column("language", sa.String(32), nullable=False),
        sa.Column("blueprint_snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("rules_snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("scenario_snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("source_configuration_version", sa.Integer(), nullable=False),
        sa.Column("blueprint_version", sa.Integer(), nullable=False),
        sa.Column("rights_note", sa.Text(), server_default="", nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("clone_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["publisher_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_exam_id"], ["exams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_exam_id", name="uq_library_publications_source_exam"),
    )
    op.create_index(
        op.f("ix_library_publications_publisher_id"),
        "library_publications",
        ["publisher_id"],
    )
    op.create_index(
        op.f("ix_library_publications_source_exam_id"),
        "library_publications",
        ["source_exam_id"],
    )

    op.create_table(
        "library_clones",
        sa.Column("publication_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("exam_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["publication_id"], ["library_publications.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exam_id"], ["exams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("publication_id", "user_id", name="uq_library_clones_publication_user"),
    )
    for column in ("publication_id", "user_id", "workspace_id", "exam_id"):
        op.create_index(op.f(f"ix_library_clones_{column}"), "library_clones", [column])

    op.create_table(
        "class_members",
        sa.Column("class_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "owner",
                "member",
                name="class_member_role",
                native_enum=False,
                create_constraint=True,
            ),
            server_default="member",
            nullable=False,
        ),
        sa.Column(
            "leaderboard_opt_in",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        *timestamps(),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("class_id", "user_id"),
    )

    op.execute(
        "INSERT INTO class_members (class_id, user_id, role) "
        "SELECT id, owner_id, 'owner' FROM classes ON CONFLICT DO NOTHING"
    )


def downgrade() -> None:
    op.drop_table("class_members")
    op.drop_table("library_clones")
    op.drop_table("library_publications")
