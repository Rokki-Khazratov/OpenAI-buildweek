"""Remove legacy broad workspace grants created by Class membership.

Revision ID: 20260721_0010
Revises: 20260721_0009
Create Date: 2026-07-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260721_0010"
down_revision: str | None = "20260721_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Delete only grants that the legacy Class flow could have created.

    There is no API that creates an independent non-owner WorkspaceMember. Before this
    migration, Class addition was the sole producer of ``role = member`` rows, so
    removing them is the least-privilege migration. Effective Class access is now
    derived from the current ClassMember/ClassExam rows at query time.
    """
    op.execute(
        sa.text("DELETE FROM workspace_members WHERE role = :member_role").bindparams(
            member_role="member"
        )
    )


def downgrade() -> None:
    """Do not recreate ambiguous broad grants during a rollback.

    The removed rows did not record which Class granted them. Recreating every
    membership would widen access and would be less safe than preserving the narrowed
    entitlement model.
    """
