"""Ownership-aware exam application service."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.exam import ExamCreateRequest, ExamUpdateRequest
from app.db.models.audit import AuditEvent
from app.db.models.exam import Exam, ExamStatus
from app.db.models.workspace import Workspace
from app.modules.workspaces.service import (
    accessible_workspace_filter,
    get_owned_workspace,
    get_workspace,
)


class ExamNotFoundError(LookupError):
    """Raised when an exam is absent or hidden from the caller."""


class ExamConfigurationConflictError(ValueError):
    """Raised when an outdated editor tries to overwrite newer configuration."""


@dataclass(frozen=True, slots=True)
class ExamPage:
    items: list[Exam]
    total: int


async def create_exam(
    session: AsyncSession,
    owner_id: UUID,
    subject_id: UUID,
    payload: ExamCreateRequest,
) -> Exam:
    await get_owned_workspace(session, owner_id, subject_id)
    data = payload.model_dump(exclude={"status"})
    exam = Exam(workspace_id=subject_id, **data)
    exam.status = payload.status or (ExamStatus.READY if payload.blueprint else ExamStatus.DRAFT)
    session.add(exam)
    await session.flush()
    session.add(
        AuditEvent(
            actor_id=owner_id,
            workspace_id=subject_id,
            action="exam.created",
            details={"exam_id": str(exam.id)},
        )
    )
    await session.flush()
    await session.refresh(exam)
    return exam


async def list_exams(
    session: AsyncSession,
    user_id: UUID,
    subject_id: UUID,
    *,
    limit: int,
    offset: int,
) -> ExamPage:
    await get_workspace(session, user_id, subject_id)
    predicate = Exam.workspace_id == subject_id
    total = await session.scalar(select(func.count()).select_from(Exam).where(predicate))
    result = await session.scalars(
        select(Exam)
        .where(predicate)
        .order_by(Exam.created_at.desc(), Exam.id)
        .limit(limit)
        .offset(offset)
    )
    return ExamPage(list(result.all()), total or 0)


async def get_exam(session: AsyncSession, user_id: UUID, exam_id: UUID) -> Exam:
    exam = await session.scalar(
        select(Exam)
        .join(Workspace, Workspace.id == Exam.workspace_id)
        .where(Exam.id == exam_id, accessible_workspace_filter(user_id))
    )
    if exam is None:
        raise ExamNotFoundError
    return exam


async def get_owned_exam(session: AsyncSession, owner_id: UUID, exam_id: UUID) -> Exam:
    exam = await session.scalar(
        select(Exam)
        .join(Workspace, Workspace.id == Exam.workspace_id)
        .where(Exam.id == exam_id, Workspace.owner_id == owner_id)
    )
    if exam is None:
        raise ExamNotFoundError
    return exam


async def update_exam(
    session: AsyncSession,
    owner_id: UUID,
    exam_id: UUID,
    payload: ExamUpdateRequest,
) -> Exam:
    exam = await get_owned_exam(session, owner_id, exam_id)
    updates = payload.model_dump(exclude_unset=True)
    requested_version = updates.pop("configuration_version", None)
    requested_status = updates.pop("status", None)
    changed_fields = set(updates)
    if requested_status is not None:
        changed_fields.add("status")
    if requested_version is not None and requested_version != exam.configuration_version:
        raise ExamConfigurationConflictError
    for field, value in updates.items():
        setattr(exam, field, value.strip() if isinstance(value, str) else value)
    if {"pasted_context", "sources", "blueprint", "rules", "scenario"} & updates.keys():
        exam.configuration_version += 1
        if exam.status != ExamStatus.ARCHIVED:
            exam.status = ExamStatus.READY if exam.blueprint else ExamStatus.DRAFT
    if requested_status is not None:
        exam.status = requested_status
    session.add(
        AuditEvent(
            actor_id=owner_id,
            workspace_id=exam.workspace_id,
            action="exam.updated",
            details={"exam_id": str(exam.id), "fields": sorted(changed_fields)},
        )
    )
    await session.flush()
    await session.refresh(exam)
    return exam


async def delete_exam(session: AsyncSession, owner_id: UUID, exam_id: UUID) -> None:
    exam = await get_owned_exam(session, owner_id, exam_id)
    session.add(
        AuditEvent(
            actor_id=owner_id,
            workspace_id=exam.workspace_id,
            action="exam.deleted",
            details={"exam_id": str(exam.id), "title": exam.title},
        )
    )
    await session.delete(exam)
    await session.flush()
