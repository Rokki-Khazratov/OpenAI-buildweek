"""Add embeddings and grounded question metadata.

Revision ID: 20260719_0006
Revises: 20260716_0005
Create Date: 2026-07-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "20260719_0006"
down_revision: str | None = "20260716_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("artifact_chunks", sa.Column("embedding", Vector(1536), nullable=True))
    op.add_column("artifact_chunks", sa.Column("embedding_model", sa.String(120), nullable=True))
    op.create_index(
        "ix_artifact_chunks_embedding_hnsw",
        "artifact_chunks",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
    op.add_column(
        "mock_questions",
        sa.Column(
            "citations",
            postgresql.JSONB(),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column("mock_questions", sa.Column("topic", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("mock_questions", "topic")
    op.drop_column("mock_questions", "citations")
    op.drop_index("ix_artifact_chunks_embedding_hnsw", table_name="artifact_chunks")
    op.drop_column("artifact_chunks", "embedding_model")
    op.drop_column("artifact_chunks", "embedding")
