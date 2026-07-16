"""Persist the complete P0 exam configuration.

Revision ID: 20260716_0003
Revises: 20260714_0002
Create Date: 2026-07-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260716_0003"
down_revision: str | None = "20260714_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "exams", sa.Column("pasted_context", sa.Text(), server_default="", nullable=False)
    )
    op.add_column(
        "exams",
        sa.Column(
            "sources",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column(
        "exams",
        sa.Column(
            "blueprint",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column(
        "exams",
        sa.Column(
            "rules",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column(
        "exams",
        sa.Column(
            "scenario",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column(
        "exams",
        sa.Column("configuration_version", sa.Integer(), server_default="1", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("exams", "configuration_version")
    op.drop_column("exams", "scenario")
    op.drop_column("exams", "rules")
    op.drop_column("exams", "blueprint")
    op.drop_column("exams", "sources")
    op.drop_column("exams", "pasted_context")
