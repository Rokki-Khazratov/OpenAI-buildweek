"""Security-sensitive audit trail model."""

from typing import Any
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AuditEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Append-only record of a security or ownership-sensitive action."""

    __tablename__ = "audit_events"

    actor_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    workspace_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("workspaces.id", ondelete="SET NULL"),
        index=True,
    )
    action: Mapped[str] = mapped_column(String(120), index=True)
    details: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict)
