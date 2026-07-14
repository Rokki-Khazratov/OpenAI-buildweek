"""Exam definitions owned by a subject workspace."""

from datetime import date
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Date, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ExamStatus(StrEnum):
    """Lifecycle state of an exam definition."""

    DRAFT = "draft"
    READY = "ready"
    ARCHIVED = "archived"


class Exam(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A target exam inside one subject."""

    __tablename__ = "exams"

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    exam_type: Mapped[str | None] = mapped_column(String(120))
    language: Mapped[str] = mapped_column(String(32), default="en", server_default="en")
    target_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[ExamStatus] = mapped_column(
        Enum(
            ExamStatus,
            name="exam_status",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        default=ExamStatus.DRAFT,
        server_default=ExamStatus.DRAFT.value,
    )
