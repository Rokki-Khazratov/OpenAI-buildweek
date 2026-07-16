"""Exam definitions owned by a subject workspace."""

from datetime import date
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import Date, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
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
    pasted_context: Mapped[str] = mapped_column(Text, default="", server_default="")
    sources: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, server_default="[]")
    blueprint: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, server_default="[]"
    )
    rules: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    scenario: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    configuration_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
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
