"""Subject-scoped classes, existing-user membership, and cohort aggregates."""

from collections import defaultdict
from dataclasses import dataclass
from statistics import median
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.classroom import (
    ClassCreateRequest,
    ClassDashboardResponse,
    ClassMemberResponse,
    ClassSkillMetric,
    ClassUpdateRequest,
    CohortExperimentSummaryResponse,
)
from app.db.models.analytics import CohortAnalyticsEvent
from app.db.models.attempt import Attempt, AttemptStatus
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
from app.modules.analytics.model import MODEL_VERSION
from app.modules.analytics.service import exam_analytics
from app.modules.workspaces.service import (
    accessible_workspace_filter,
    get_owned_workspace,
    get_workspace,
)

COHORT_PRIVACY_THRESHOLD = 3
COHORT_SKILL_SUPPORT_THRESHOLD = 3


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
    session.add(ClassMember(class_id=classroom.id, user_id=owner_id, role=ClassMemberRole.OWNER))
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

    member_ids = list(
        (
            await session.scalars(
                select(ClassMember.user_id)
                .where(ClassMember.class_id == class_id)
                .order_by(ClassMember.user_id)
            )
        ).all()
    )
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

    active_ids = {item.user_id for item in attempts}
    suppression_reason: str | None = None
    if len(member_ids) < COHORT_PRIVACY_THRESHOLD:
        suppression_reason = f"At least {COHORT_PRIVACY_THRESHOLD} class members are required."
    elif len(scoped_ids) != 1:
        suppression_reason = "Select one exam so blueprint and taxonomy versions remain comparable."
    if suppression_reason:
        return ClassDashboardResponse(
            class_id=class_id,
            exam_id=exam_id,
            model_version=MODEL_VERSION,
            privacy_threshold=COHORT_PRIVACY_THRESHOLD,
            suppressed=True,
            suppression_reason=suppression_reason,
            member_count=len(member_ids),
            active_learners=len(active_ids),
            eligible_learners=0,
            total_attempts=len(attempts),
            median_readiness_index=None,
            readiness_coverage=0,
            readiness_confidence_distribution={
                "low_evidence": 0,
                "developing": 0,
                "established": 0,
            },
            low_evidence_percentage=None,
            weak_skills=[],
            recommended_action=None,
        )

    selected_exam_id = scoped_ids[0]
    profiles = [
        await exam_analytics(session, member_id, selected_exam_id)
        for member_id in member_ids
        if member_id in active_ids
    ]
    eligible = [item for item in profiles if item.readiness.index is not None]
    readiness_values = [
        item.readiness.index for item in eligible if item.readiness.index is not None
    ]
    confidence_distribution = {"low_evidence": 0, "developing": 0, "established": 0}
    skill_values: dict[str, list[tuple[float, float, int, str]]] = defaultdict(list)
    for profile in eligible:
        level = (
            "low_evidence"
            if profile.readiness.confidence < 0.35
            else "developing"
            if profile.readiness.confidence < 0.70
            else "established"
        )
        confidence_distribution[level] += 1
        for skill in profile.skills:
            if skill.mastery is not None:
                skill_values[skill.skill_id].append(
                    (skill.mastery, skill.confidence, skill.evidence_count, skill.label)
                )
    weak_skills: list[ClassSkillMetric] = []
    for skill_id, values in skill_values.items():
        if len(values) < COHORT_SKILL_SUPPORT_THRESHOLD:
            continue
        mastery = sum(item[0] for item in values) / len(values)
        confidence = sum(item[1] for item in values) / len(values)
        weak_skills.append(
            ClassSkillMetric(
                skill_id=skill_id,
                label=values[0][3],
                mastery_percentage=round(mastery * 100, 1),
                confidence=round(confidence, 4),
                support=len(values),
                evidence_count=sum(item[2] for item in values),
                signal=(
                    "low_evidence"
                    if confidence < 0.35
                    else "confirmed_gap"
                    if mastery < 0.7
                    else "healthy"
                ),
            )
        )
    weak_skills.sort(key=lambda item: (item.mastery_percentage, item.skill_id))
    low_evidence = confidence_distribution["low_evidence"]
    action = None
    priority = next((item for item in weak_skills if item.signal == "confirmed_gap"), None)
    if priority:
        action = f"Review {priority.label} with the whole class."
    elif low_evidence:
        action = "Collect more comparable evidence before changing instruction."
    return ClassDashboardResponse(
        class_id=class_id,
        exam_id=exam_id,
        model_version=MODEL_VERSION,
        privacy_threshold=COHORT_PRIVACY_THRESHOLD,
        suppressed=False,
        suppression_reason=None,
        member_count=len(member_ids),
        active_learners=len(active_ids),
        eligible_learners=len(eligible),
        total_attempts=len(attempts),
        median_readiness_index=round(float(median(readiness_values)), 1)
        if readiness_values
        else None,
        readiness_coverage=round(len(eligible) / max(1, len(member_ids)), 2),
        readiness_confidence_distribution=confidence_distribution,
        low_evidence_percentage=round(100 * low_evidence / len(eligible), 1) if eligible else None,
        weak_skills=weak_skills,
        recommended_action=action,
    )


async def record_cohort_event(
    session: AsyncSession,
    owner_id: UUID,
    class_id: UUID,
    event_name: str,
    properties: dict[str, str | int | float | bool],
) -> None:
    classroom = await get_owned_class(session, owner_id, class_id)
    session.add(
        CohortAnalyticsEvent(
            class_id=classroom.id,
            actor_id=owner_id,
            event_name=event_name,
            model_version=MODEL_VERSION,
            properties=properties,
        )
    )
    session.add(
        AuditEvent(
            actor_id=owner_id,
            workspace_id=classroom.workspace_id,
            action=f"cohort_analytics.{event_name}",
            details={"class_id": str(class_id)},
        )
    )
    await session.flush()


async def cohort_experiment_summary(
    session: AsyncSession, owner_id: UUID, class_id: UUID
) -> CohortExperimentSummaryResponse:
    await get_owned_class(session, owner_id, class_id)
    rows = (
        await session.execute(
            select(CohortAnalyticsEvent.event_name, func.count(CohortAnalyticsEvent.id))
            .where(CohortAnalyticsEvent.class_id == class_id)
            .group_by(CohortAnalyticsEvent.event_name)
        )
    ).all()
    counts = {name: int(count) for name, count in rows}
    viewed = counts.get("dashboard_viewed", 0)
    started = counts.get("adaptive_mock_started", 0)
    return CohortExperimentSummaryResponse(
        class_id=class_id,
        model_version=MODEL_VERSION,
        event_counts=counts,
        recommendation_acceptance_rate=round(counts.get("recommendation_accepted", 0) / viewed, 4)
        if viewed
        else None,
        adaptive_completion_rate=round(counts.get("adaptive_mock_completed", 0) / started, 4)
        if started
        else None,
    )
