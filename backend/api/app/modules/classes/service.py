"""Subject-scoped classes, existing-user membership, and cohort aggregates."""

from collections import defaultdict
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.classroom import (
    ClassCreateRequest,
    ClassDashboardResponse,
    ClassMemberResponse,
    ClassParticipantMetric,
    ClassSkillMetric,
    ClassUpdateRequest,
)
from app.db.models.attempt import Attempt, AttemptStatus, MockQuestion, QuestionEvaluation
from app.db.models.audit import AuditEvent
from app.db.models.classroom import (
    ClassExam,
    ClassExamScope,
    ClassMember,
    ClassMemberRole,
    Classroom,
)
from app.db.models.exam import Exam
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.modules.workspaces.service import (
    accessible_workspace_filter,
    get_owned_workspace,
    get_workspace,
)


class ClassNotFoundError(LookupError):
    pass


class InvalidClassScopeError(ValueError):
    pass


class ClassMemberNotFoundError(LookupError):
    pass


class ClassMemberConflictError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class ClassRecord:
    classroom: Classroom
    exam_ids: list[UUID]
    member_count: int


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


async def _member_count(session: AsyncSession, class_id: UUID) -> int:
    value = await session.scalar(
        select(func.count()).select_from(ClassMember).where(ClassMember.class_id == class_id)
    )
    return value or 0


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
    session.add_all(ClassExam(class_id=classroom.id, exam_id=item) for item in exam_ids)
    session.add(
        ClassMember(class_id=classroom.id, user_id=owner_id, role=ClassMemberRole.OWNER)
    )
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
    return ClassRecord(classroom, exam_ids, 1)


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
    items = [
        ClassRecord(item, await _exam_ids(session, item.id), await _member_count(session, item.id))
        for item in result.all()
    ]
    return ClassPage(items, total or 0)


async def get_class(session: AsyncSession, user_id: UUID, class_id: UUID) -> ClassRecord:
    classroom = await session.scalar(
        select(Classroom)
        .join(Workspace, Workspace.id == Classroom.workspace_id)
        .where(Classroom.id == class_id, accessible_workspace_filter(user_id))
    )
    if classroom is None:
        raise ClassNotFoundError
    return ClassRecord(
        classroom, await _exam_ids(session, class_id), await _member_count(session, class_id)
    )


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
    session.add_all(ClassExam(class_id=class_id, exam_id=item) for item in exam_ids)
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
    return ClassRecord(classroom, exam_ids, await _member_count(session, class_id))


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


async def list_class_members(
    session: AsyncSession, owner_id: UUID, class_id: UUID
) -> list[ClassMemberResponse]:
    await get_owned_class(session, owner_id, class_id)
    rows = (
        await session.execute(
            select(ClassMember, User.display_name)
            .join(User, User.id == ClassMember.user_id)
            .where(ClassMember.class_id == class_id)
            .order_by(ClassMember.role, ClassMember.created_at, ClassMember.user_id)
        )
    ).all()
    return [
        ClassMemberResponse(
            user_id=member.user_id,
            display_name=name,
            role=member.role,
            leaderboard_opt_in=member.leaderboard_opt_in,
            joined_at=member.created_at,
        )
        for member, name in rows
    ]


async def add_class_member(
    session: AsyncSession, owner_id: UUID, class_id: UUID, email: str
) -> ClassMemberResponse:
    classroom = await get_owned_class(session, owner_id, class_id)
    user = await session.scalar(select(User).where(func.lower(User.email) == email.casefold()))
    if user is None or not user.is_active:
        raise ClassMemberNotFoundError
    existing = await session.get(ClassMember, {"class_id": class_id, "user_id": user.id})
    if existing is not None:
        raise ClassMemberConflictError("This participant is already in the class")
    member = ClassMember(class_id=class_id, user_id=user.id, role=ClassMemberRole.MEMBER)
    session.add(member)
    workspace_member = await session.get(
        WorkspaceMember, {"workspace_id": classroom.workspace_id, "user_id": user.id}
    )
    if workspace_member is None:
        session.add(
            WorkspaceMember(
                workspace_id=classroom.workspace_id,
                user_id=user.id,
                role=WorkspaceRole.MEMBER,
            )
        )
    session.add(
        AuditEvent(
            actor_id=owner_id,
            workspace_id=classroom.workspace_id,
            action="class.member_added",
            details={"class_id": str(class_id), "user_id": str(user.id)},
        )
    )
    await session.flush()
    await session.refresh(member)
    return ClassMemberResponse(
        user_id=user.id,
        display_name=user.display_name,
        role=member.role,
        leaderboard_opt_in=member.leaderboard_opt_in,
        joined_at=member.created_at,
    )


async def remove_class_member(
    session: AsyncSession, owner_id: UUID, class_id: UUID, user_id: UUID
) -> None:
    classroom = await get_owned_class(session, owner_id, class_id)
    member = await session.get(ClassMember, {"class_id": class_id, "user_id": user_id})
    if member is None:
        raise ClassMemberNotFoundError
    if member.role == ClassMemberRole.OWNER:
        raise ClassMemberConflictError("The class owner cannot be removed")
    await session.delete(member)
    session.add(
        AuditEvent(
            actor_id=owner_id,
            workspace_id=classroom.workspace_id,
            action="class.member_removed",
            details={"class_id": str(class_id), "user_id": str(user_id)},
        )
    )
    await session.flush()


async def _scoped_exam_ids(session: AsyncSession, classroom: Classroom) -> list[UUID]:
    if classroom.exam_scope == ClassExamScope.SELECTED_EXAMS:
        return await _exam_ids(session, classroom.id)
    return list(
        (
            await session.scalars(
                select(Exam.id).where(Exam.workspace_id == classroom.workspace_id)
            )
        ).all()
    )


def _percentage(score: int | None, maximum: int) -> float:
    return round(100 * (score or 0) / max(1, maximum), 1)


async def class_dashboard(
    session: AsyncSession,
    owner_id: UUID,
    class_id: UUID,
    exam_id: UUID | None,
) -> ClassDashboardResponse:
    classroom = await get_owned_class(session, owner_id, class_id)
    scoped_ids = await _scoped_exam_ids(session, classroom)
    if exam_id is not None:
        if exam_id not in scoped_ids:
            raise InvalidClassScopeError("The selected exam is outside this class scope")
        scoped_ids = [exam_id]

    member_rows = (
        await session.execute(
            select(ClassMember, User.display_name)
            .join(User, User.id == ClassMember.user_id)
            .where(ClassMember.class_id == class_id)
            .order_by(ClassMember.role, User.display_name)
        )
    ).all()
    member_ids = [member.user_id for member, _ in member_rows]
    attempts: list[Attempt] = []
    if member_ids and scoped_ids:
        attempts = list(
            (
                await session.scalars(
                    select(Attempt)
                    .where(
                        Attempt.user_id.in_(member_ids),
                        Attempt.exam_id.in_(scoped_ids),
                        Attempt.status == AttemptStatus.EVALUATED,
                    )
                    .order_by(Attempt.submitted_at.desc(), Attempt.id)
                )
            ).all()
        )

    exams = (
        list((await session.scalars(select(Exam).where(Exam.id.in_(scoped_ids)))).all())
        if scoped_ids
        else []
    )
    exam_rules = {item.id: item.rules for item in exams}
    attempts_by_user: dict[UUID, list[Attempt]] = defaultdict(list)
    for attempt in attempts:
        attempts_by_user[attempt.user_id].append(attempt)

    skill_points: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0])
    user_skill_points: dict[UUID, dict[str, list[int]]] = defaultdict(
        lambda: defaultdict(lambda: [0, 0, 0])
    )
    if attempts:
        attempt_user = {item.id: item.user_id for item in attempts}
        evaluation_rows = (
            await session.execute(
                select(QuestionEvaluation, MockQuestion.skill_ids)
                .join(MockQuestion, MockQuestion.id == QuestionEvaluation.question_id)
                .where(QuestionEvaluation.attempt_id.in_(list(attempt_user)))
            )
        ).all()
        for evaluation, skill_ids in evaluation_rows:
            for skill_id in set(skill_ids or []):
                aggregate = skill_points[str(skill_id)]
                aggregate[0] += evaluation.awarded_points
                aggregate[1] += evaluation.max_points
                aggregate[2] += 1
                participant = user_skill_points[attempt_user[evaluation.attempt_id]][str(skill_id)]
                participant[0] += evaluation.awarded_points
                participant[1] += evaluation.max_points
                participant[2] += 1

    participants: list[ClassParticipantMetric] = []
    latest_scores: list[float] = []
    all_scores = [_percentage(item.score, item.max_score) for item in attempts]
    for member, display_name in member_rows:
        own_attempts = attempts_by_user.get(member.user_id, [])
        own_scores = [_percentage(item.score, item.max_score) for item in own_attempts]
        readiness = own_scores[0] if own_scores else None
        if readiness is not None:
            latest_scores.append(readiness)
        weak = sorted(
            (
                (skill_id, 100 * values[0] / max(1, values[1]))
                for skill_id, values in user_skill_points.get(member.user_id, {}).items()
            ),
            key=lambda item: (item[1], item[0]),
        )
        participants.append(
            ClassParticipantMetric(
                user_id=member.user_id,
                display_name=display_name,
                role=member.role,
                attempts=len(own_attempts),
                average_percentage=round(sum(own_scores) / len(own_scores), 1)
                if own_scores
                else None,
                readiness_percentage=readiness,
                last_activity_at=own_attempts[0].submitted_at if own_attempts else None,
                weak_skill_ids=[skill_id for skill_id, score in weak if score < 70][:3],
            )
        )

    passed = 0
    for attempt in attempts:
        threshold = int(exam_rules.get(attempt.exam_id, {}).get("passPercentage", 50))
        passed += _percentage(attempt.score, attempt.max_score) >= threshold
    weak_skills = [
        ClassSkillMetric(
            skill_id=skill_id,
            percentage=round(100 * values[0] / max(1, values[1]), 1),
            support=values[2],
        )
        for skill_id, values in sorted(
            skill_points.items(), key=lambda item: (item[1][0] / max(1, item[1][1]), item[0])
        )
    ]
    return ClassDashboardResponse(
        class_id=class_id,
        exam_id=exam_id,
        member_count=len(member_rows),
        active_learners=len(attempts_by_user),
        total_attempts=len(attempts),
        average_percentage=round(sum(all_scores) / len(all_scores), 1) if all_scores else None,
        readiness_percentage=round(sum(latest_scores) / len(latest_scores), 1)
        if latest_scores
        else None,
        readiness_coverage=round(len(latest_scores) / max(1, len(member_rows)), 2),
        pass_rate=round(100 * passed / len(attempts), 1) if attempts else None,
        weak_skills=weak_skills,
        participants=participants,
    )
