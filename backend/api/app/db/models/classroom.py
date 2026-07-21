"""Study classes and their optional selected-exam scope."""

from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ClassExamScope(StrEnum):
    """Whether a class follows every exam or an explicit subset."""

    SUBJECT = "subject"
    SELECTED_EXAMS = "selected_exams"


class ClassMemberRole(StrEnum):
    OWNER = "owner"
    MEMBER = "member"


class Classroom(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A collaborative study group attached to one subject."""

    __tablename__ = "classes"

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        index=True,
    )
    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    exam_scope: Mapped[ClassExamScope] = mapped_column(
        Enum(
            ClassExamScope,
            name="class_exam_scope",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        default=ClassExamScope.SUBJECT,
        server_default=ClassExamScope.SUBJECT.value,
    )


class ClassExam(Base):
    """Selected exams visible to a class with selected-exam scope."""

    __tablename__ = "class_exams"

    class_id: Mapped[UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"),
        primary_key=True,
    )
    exam_id: Mapped[UUID] = mapped_column(
        ForeignKey("exams.id", ondelete="CASCADE"),
        primary_key=True,
    )


class ClassMember(TimestampMixin, Base):
    """An existing account participating in a class."""

    __tablename__ = "class_members"

    class_id: Mapped[UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[ClassMemberRole] = mapped_column(
        Enum(
            ClassMemberRole,
            name="class_member_role",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=lambda members: [member.value for member in members],
        ),
        default=ClassMemberRole.MEMBER,
        server_default=ClassMemberRole.MEMBER.value,
    )
    leaderboard_opt_in: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
