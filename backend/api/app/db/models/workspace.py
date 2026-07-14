"""Workspace persistence models."""

from datetime import date
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Date, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class WorkspaceVisibility(StrEnum):
    """Who may discover or access a workspace."""

    PRIVATE = "private"
    TEAM = "team"
    PUBLIC = "public"


class WorkspaceRole(StrEnum):
    """Membership role inside a workspace."""

    OWNER = "owner"
    MEMBER = "member"


class Workspace(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Student-owned course and exam-preparation space."""

    __tablename__ = "workspaces"

    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200))
    university: Mapped[str | None] = mapped_column(String(200))
    course_code: Mapped[str | None] = mapped_column(String(64))
    subject: Mapped[str | None] = mapped_column(String(200))
    visibility: Mapped[WorkspaceVisibility] = mapped_column(
        Enum(
            WorkspaceVisibility,
            name="workspace_visibility",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        default=WorkspaceVisibility.PRIVATE,
        server_default=WorkspaceVisibility.PRIVATE.value,
    )
    target_exam_date: Mapped[date | None] = mapped_column(Date)


class WorkspaceMember(TimestampMixin, Base):
    """A user's explicit membership in a workspace."""

    __tablename__ = "workspace_members"

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role: Mapped[WorkspaceRole] = mapped_column(
        Enum(
            WorkspaceRole,
            name="workspace_role",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        default=WorkspaceRole.MEMBER,
        server_default=WorkspaceRole.MEMBER.value,
    )
