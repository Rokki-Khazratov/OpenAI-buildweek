"""Ownership-aware workspace application service."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.api.schemas.workspace import WorkspaceCreateRequest, WorkspaceUpdateRequest
from app.db.models.audit import AuditEvent
from app.db.models.classroom import ClassExam, ClassExamScope, ClassMember, Classroom
from app.db.models.exam import Exam
from app.db.models.workspace import Workspace, WorkspaceMember, WorkspaceRole


class WorkspaceNotFoundError(LookupError):
    """Raised when a workspace is absent or intentionally hidden from a caller."""


@dataclass(frozen=True, slots=True)
class WorkspacePage:
    """Internal paginated workspace result."""

    items: list[Workspace]
    total: int


def accessible_workspace_filter(user_id: UUID) -> ColumnElement[bool]:
    """Build the Subject-shell predicate for direct or Class-derived access."""
    member_workspace_ids = select(WorkspaceMember.workspace_id).where(
        WorkspaceMember.user_id == user_id
    )
    class_workspace_ids = (
        select(Classroom.workspace_id)
        .join(ClassMember, ClassMember.class_id == Classroom.id)
        .where(ClassMember.user_id == user_id)
    )
    return or_(
        Workspace.owner_id == user_id,
        Workspace.id.in_(member_workspace_ids),
        Workspace.id.in_(class_workspace_ids),
    )


def accessible_exam_filter(user_id: UUID) -> ColumnElement[bool]:
    """Build the Exam predicate for direct, subject-wide, or selected Class access.

    A Class grant is deliberately derived from its current scope rows instead of being
    copied into ``WorkspaceMember``. This makes removal and scope edits take effect in
    the same transaction without leaving a broad Subject grant behind.
    """
    owner_access = (
        select(Workspace.id)
        .where(
            Workspace.id == Exam.workspace_id,
            Workspace.owner_id == user_id,
        )
        .correlate(Exam)
        .exists()
    )
    direct_member_access = (
        select(WorkspaceMember.workspace_id)
        .where(
            WorkspaceMember.workspace_id == Exam.workspace_id,
            WorkspaceMember.user_id == user_id,
        )
        .correlate(Exam)
        .exists()
    )
    subject_class_access = (
        select(ClassMember.class_id)
        .join(Classroom, Classroom.id == ClassMember.class_id)
        .where(
            ClassMember.user_id == user_id,
            Classroom.workspace_id == Exam.workspace_id,
            Classroom.exam_scope == ClassExamScope.SUBJECT,
        )
        .correlate(Exam)
        .exists()
    )
    selected_exam_access = (
        select(ClassMember.class_id)
        .join(Classroom, Classroom.id == ClassMember.class_id)
        .join(ClassExam, ClassExam.class_id == Classroom.id)
        .where(
            ClassMember.user_id == user_id,
            Classroom.workspace_id == Exam.workspace_id,
            Classroom.exam_scope == ClassExamScope.SELECTED_EXAMS,
            ClassExam.exam_id == Exam.id,
        )
        .correlate(Exam)
        .exists()
    )
    return or_(owner_access, direct_member_access, subject_class_access, selected_exam_access)


async def create_workspace(
    session: AsyncSession,
    owner_id: UUID,
    payload: WorkspaceCreateRequest,
) -> Workspace:
    """Create a workspace and its owner membership atomically."""
    workspace = Workspace(owner_id=owner_id, **payload.model_dump())
    session.add(workspace)
    await session.flush()
    session.add(
        WorkspaceMember(
            workspace_id=workspace.id,
            user_id=owner_id,
            role=WorkspaceRole.OWNER,
        )
    )
    session.add(
        AuditEvent(
            actor_id=owner_id,
            workspace_id=workspace.id,
            action="workspace.created",
            details={"visibility": workspace.visibility.value},
        )
    )
    await session.flush()
    await session.refresh(workspace)
    return workspace


async def list_workspaces(
    session: AsyncSession,
    user_id: UUID,
    *,
    limit: int,
    offset: int,
) -> WorkspacePage:
    """List workspaces visible through ownership or membership."""
    access_filter = accessible_workspace_filter(user_id)
    total = await session.scalar(select(func.count()).select_from(Workspace).where(access_filter))
    result = await session.scalars(
        select(Workspace)
        .where(access_filter)
        .order_by(Workspace.created_at.desc(), Workspace.id)
        .limit(limit)
        .offset(offset)
    )
    return WorkspacePage(items=list(result.all()), total=total or 0)


async def get_workspace(session: AsyncSession, user_id: UUID, workspace_id: UUID) -> Workspace:
    """Return an accessible workspace without leaking inaccessible IDs."""
    workspace = await session.scalar(
        select(Workspace).where(
            Workspace.id == workspace_id,
            accessible_workspace_filter(user_id),
        )
    )
    if workspace is None:
        raise WorkspaceNotFoundError
    return workspace


async def get_owned_workspace(
    session: AsyncSession,
    owner_id: UUID,
    workspace_id: UUID,
) -> Workspace:
    """Return a workspace only when the caller owns it."""
    workspace = await session.scalar(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.owner_id == owner_id,
        )
    )
    if workspace is None:
        raise WorkspaceNotFoundError
    return workspace


async def update_workspace(
    session: AsyncSession,
    owner_id: UUID,
    workspace_id: UUID,
    payload: WorkspaceUpdateRequest,
) -> Workspace:
    """Update mutable metadata on an owned workspace."""
    workspace = await get_owned_workspace(session, owner_id, workspace_id)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(workspace, field, value.strip() if isinstance(value, str) else value)
    session.add(
        AuditEvent(
            actor_id=owner_id,
            workspace_id=workspace.id,
            action="workspace.updated",
            details={"fields": sorted(updates)},
        )
    )
    await session.flush()
    await session.refresh(workspace)
    return workspace


async def delete_workspace(session: AsyncSession, owner_id: UUID, workspace_id: UUID) -> None:
    """Delete an owned workspace and record a non-referencing audit event."""
    workspace = await get_owned_workspace(session, owner_id, workspace_id)
    session.add(
        AuditEvent(
            actor_id=owner_id,
            workspace_id=None,
            action="workspace.deleted",
            details={"workspace_id": str(workspace.id), "title": workspace.title},
        )
    )
    await session.delete(workspace)
    await session.flush()
