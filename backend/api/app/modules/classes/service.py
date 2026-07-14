"""Subject-scoped class application service."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.classroom import ClassCreateRequest, ClassUpdateRequest
from app.db.models.audit import AuditEvent
from app.db.models.classroom import ClassExam, ClassExamScope, Classroom
from app.db.models.exam import Exam
from app.db.models.workspace import Workspace
from app.modules.workspaces.service import (
    accessible_workspace_filter,
    get_owned_workspace,
    get_workspace,
)


class ClassNotFoundError(LookupError):
    """Raised when a class is absent or hidden from the caller."""


class InvalidClassScopeError(ValueError):
    """Raised when selected exams do not match the class scope and subject."""


@dataclass(frozen=True, slots=True)
class ClassRecord:
    classroom: Classroom
    exam_ids: list[UUID]


@dataclass(frozen=True, slots=True)
class ClassPage:
    items: list[ClassRecord]
    total: int


async def _validate_exam_scope(
    session: AsyncSession,
    subject_id: UUID,
    exam_scope: ClassExamScope,
    exam_ids: list[UUID],
) -> list[UUID]:
    unique_ids = list(dict.fromkeys(exam_ids))
    if exam_scope == ClassExamScope.SUBJECT:
        if unique_ids:
            raise InvalidClassScopeError("Subject-scoped classes cannot select individual exams")
        return []
    if not unique_ids:
        raise InvalidClassScopeError("Select at least one exam")
    valid_ids = set(
        await session.scalars(
            select(Exam.id).where(Exam.workspace_id == subject_id, Exam.id.in_(unique_ids))
        )
    )
    if valid_ids != set(unique_ids):
        raise InvalidClassScopeError("Every selected exam must belong to the subject")
    return unique_ids


async def _exam_ids(session: AsyncSession, class_id: UUID) -> list[UUID]:
    result = await session.scalars(
        select(ClassExam.exam_id).where(ClassExam.class_id == class_id).order_by(ClassExam.exam_id)
    )
    return list(result.all())


async def create_class(
    session: AsyncSession,
    owner_id: UUID,
    subject_id: UUID,
    payload: ClassCreateRequest,
) -> ClassRecord:
    await get_owned_workspace(session, owner_id, subject_id)
    exam_ids = await _validate_exam_scope(session, subject_id, payload.exam_scope, payload.exam_ids)
    classroom = Classroom(
        workspace_id=subject_id,
        owner_id=owner_id,
        name=payload.name,
        description=payload.description,
        exam_scope=payload.exam_scope,
    )
    session.add(classroom)
    await session.flush()
    session.add_all(ClassExam(class_id=classroom.id, exam_id=exam_id) for exam_id in exam_ids)
    session.add(
        AuditEvent(
            actor_id=owner_id,
            workspace_id=subject_id,
            action="class.created",
            details={"class_id": str(classroom.id), "exam_scope": classroom.exam_scope.value},
        )
    )
    await session.flush()
    await session.refresh(classroom)
    return ClassRecord(classroom, exam_ids)


async def list_classes(
    session: AsyncSession,
    user_id: UUID,
    subject_id: UUID,
    *,
    limit: int,
    offset: int,
) -> ClassPage:
    await get_workspace(session, user_id, subject_id)
    predicate = Classroom.workspace_id == subject_id
    total = await session.scalar(select(func.count()).select_from(Classroom).where(predicate))
    result = await session.scalars(
        select(Classroom)
        .where(predicate)
        .order_by(Classroom.created_at.desc(), Classroom.id)
        .limit(limit)
        .offset(offset)
    )
    items = [ClassRecord(item, await _exam_ids(session, item.id)) for item in result.all()]
    return ClassPage(items, total or 0)


async def get_class(session: AsyncSession, user_id: UUID, class_id: UUID) -> ClassRecord:
    classroom = await session.scalar(
        select(Classroom)
        .join(Workspace, Workspace.id == Classroom.workspace_id)
        .where(Classroom.id == class_id, accessible_workspace_filter(user_id))
    )
    if classroom is None:
        raise ClassNotFoundError
    return ClassRecord(classroom, await _exam_ids(session, class_id))


async def get_owned_class(session: AsyncSession, owner_id: UUID, class_id: UUID) -> Classroom:
    classroom = await session.scalar(
        select(Classroom).where(Classroom.id == class_id, Classroom.owner_id == owner_id)
    )
    if classroom is None:
        raise ClassNotFoundError
    return classroom


async def update_class(
    session: AsyncSession,
    owner_id: UUID,
    class_id: UUID,
    payload: ClassUpdateRequest,
) -> ClassRecord:
    classroom = await get_owned_class(session, owner_id, class_id)
    updates = payload.model_dump(exclude_unset=True, exclude={"exam_ids"})
    exam_scope = payload.exam_scope or classroom.exam_scope
    current_exam_ids = await _exam_ids(session, class_id)
    requested_exam_ids = payload.exam_ids if payload.exam_ids is not None else current_exam_ids
    exam_ids = await _validate_exam_scope(
        session, classroom.workspace_id, exam_scope, requested_exam_ids
    )
    for field, value in updates.items():
        setattr(classroom, field, value.strip() if isinstance(value, str) else value)
    await session.execute(delete(ClassExam).where(ClassExam.class_id == class_id))
    session.add_all(ClassExam(class_id=class_id, exam_id=exam_id) for exam_id in exam_ids)
    session.add(
        AuditEvent(
            actor_id=owner_id,
            workspace_id=classroom.workspace_id,
            action="class.updated",
            details={"class_id": str(class_id), "fields": sorted(payload.model_fields_set)},
        )
    )
    await session.flush()
    await session.refresh(classroom)
    return ClassRecord(classroom, exam_ids)


async def delete_class(session: AsyncSession, owner_id: UUID, class_id: UUID) -> None:
    classroom = await get_owned_class(session, owner_id, class_id)
    session.add(
        AuditEvent(
            actor_id=owner_id,
            workspace_id=classroom.workspace_id,
            action="class.deleted",
            details={"class_id": str(classroom.id), "name": classroom.name},
        )
    )
    await session.delete(classroom)
    await session.flush()
