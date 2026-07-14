"""Add exams and subject-scoped classes.

Revision ID: 20260714_0002
Revises: 20260714_0001
Create Date: 2026-07-14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260714_0002"
down_revision: str | None = "20260714_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create exam, class, and selected-exam association tables."""
    op.create_table(
        "exams",
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("exam_type", sa.String(length=120), nullable=True),
        sa.Column("language", sa.String(length=32), server_default="en", nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "draft",
                "ready",
                "archived",
                name="exam_status",
                native_enum=False,
                create_constraint=True,
            ),
            server_default="draft",
            nullable=False,
        ),
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
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_exams_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_exams")),
    )
    op.create_index(op.f("ix_exams_workspace_id"), "exams", ["workspace_id"], unique=False)

    op.create_table(
        "classes",
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "exam_scope",
            sa.Enum(
                "subject",
                "selected_exams",
                name="class_exam_scope",
                native_enum=False,
                create_constraint=True,
            ),
            server_default="subject",
            nullable=False,
        ),
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
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_classes_owner_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_classes_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_classes")),
    )
    op.create_index(op.f("ix_classes_owner_id"), "classes", ["owner_id"], unique=False)
    op.create_index(op.f("ix_classes_workspace_id"), "classes", ["workspace_id"], unique=False)

    op.create_table(
        "class_exams",
        sa.Column("class_id", sa.Uuid(), nullable=False),
        sa.Column("exam_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["class_id"],
            ["classes.id"],
            name=op.f("fk_class_exams_class_id_classes"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["exam_id"],
            ["exams.id"],
            name=op.f("fk_class_exams_exam_id_exams"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("class_id", "exam_id", name=op.f("pk_class_exams")),
    )


def downgrade() -> None:
    """Remove exam and class tables."""
    op.drop_table("class_exams")
    op.drop_index(op.f("ix_classes_workspace_id"), table_name="classes")
    op.drop_index(op.f("ix_classes_owner_id"), table_name="classes")
    op.drop_table("classes")
    op.drop_index(op.f("ix_exams_workspace_id"), table_name="exams")
    op.drop_table("exams")
