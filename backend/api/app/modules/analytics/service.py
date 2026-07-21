"""Database-backed assembly of personal analytics responses."""

from collections import defaultdict
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.analytics import (
    AdaptiveAnalyticsResponse,
    AnalyticsConstantsResponse,
    AnalyticsOverviewResponse,
    AnalyticsTrajectoryPointResponse,
    ExamAnalyticsResponse,
    ExamAnalyticsSummaryResponse,
    GlobalTrajectoryPointResponse,
    ReadinessResponse,
    RecommendationResponse,
    SkillAnalyticsResponse,
)
from app.db.models.attempt import (
    Attempt,
    AttemptStatus,
    MockQuestion,
    QuestionEvaluation,
)
from app.db.models.blueprint import BlueprintStatus, ExamBlueprint
from app.db.models.exam import Exam
from app.db.models.workspace import Workspace
from app.modules.analytics.model import (
    COVERAGE_SCALE,
    MODEL_VERSION,
    READINESS_UNCERTAINTY_PENALTY,
    RECENCY_HALF_LIFE_DAYS,
    AnalyticsResult,
    BlueprintSkill,
    ReadinessMetric,
    Recommendation,
    SkillMetric,
    SkillObservation,
    calculate_analytics,
)
from app.modules.exams.service import get_exam
from app.modules.workspaces.service import accessible_workspace_filter


def _slug(value: str) -> str:
    normalized = "-".join(value.casefold().split())
    return "".join(character for character in normalized if character.isalnum() or character == "-")


def _constants() -> AnalyticsConstantsResponse:
    return AnalyticsConstantsResponse(
        recency_half_life_days=RECENCY_HALF_LIFE_DAYS,
        coverage_scale=COVERAGE_SCALE,
        readiness_uncertainty_penalty=READINESS_UNCERTAINTY_PENALTY,
    )


def _skill_response(item: SkillMetric) -> SkillAnalyticsResponse:
    return SkillAnalyticsResponse(
        skill_id=item.skill_id,
        label=item.label,
        blueprint_weight=item.blueprint_weight,
        mastery=item.mastery,
        confidence=item.confidence,
        confidence_level=item.confidence_level,
        evidence_count=item.evidence_count,
        effective_evidence=item.effective_evidence,
        attempt_count=item.attempt_count,
        trend=item.trend,
        trend_delta=item.trend_delta,
        latest_observed_at=item.latest_observed_at,
    )


def _readiness_response(item: ReadinessMetric) -> ReadinessResponse:
    return ReadinessResponse(
        index=item.index,
        raw_mastery=item.raw_mastery,
        confidence=item.confidence,
        coverage=item.coverage,
        status=item.status,
        pass_threshold=item.pass_threshold,
        explanation=item.explanation,
    )


def _recommendation_response(
    item: Recommendation, *, exam_id: UUID | None = None
) -> RecommendationResponse:
    return RecommendationResponse(
        exam_id=exam_id,
        action=item.action,
        title=item.title,
        reason=item.reason,
        target_skill_ids=item.target_skill_ids,
        confidence=item.confidence,
        priority=item.priority,
    )


async def _blueprint_skills(session: AsyncSession, exam: Exam) -> list[BlueprintSkill]:
    approved = await session.scalar(
        select(ExamBlueprint)
        .where(
            ExamBlueprint.exam_id == exam.id,
            ExamBlueprint.status == BlueprintStatus.APPROVED,
        )
        .order_by(ExamBlueprint.version.desc())
    )
    content = approved.content if approved is not None else {}
    taxonomy = {
        str(item.get("id")): str(item.get("label") or item.get("id"))
        for item in content.get("skill_taxonomy", [])
        if isinstance(item, dict) and item.get("id")
    }
    raw_sections = content.get("sections") if approved is not None else exam.blueprint
    sections = raw_sections if isinstance(raw_sections, list) else []
    weights: dict[str, float] = defaultdict(float)
    labels = dict(taxonomy)
    for section in sections:
        if not isinstance(section, dict):
            continue
        title = str(section.get("title") or "Core knowledge")
        points = float(section.get("points") or 0)
        raw_skills = section.get("skills")
        skills = [str(item) for item in raw_skills] if isinstance(raw_skills, list) else []
        if not skills:
            skills = [_slug(title) or "core-knowledge"]
        for skill_id in skills:
            labels.setdefault(skill_id, skill_id.replace("-", " ").title())
            weights[skill_id] += max(0.0, points) / len(skills)
    if not weights:
        weights["core-knowledge"] = 1.0
        labels["core-knowledge"] = "Core knowledge"
    total = sum(weights.values()) or 1.0
    return [
        BlueprintSkill(skill_id=skill_id, label=labels[skill_id], weight=weight / total)
        for skill_id, weight in sorted(weights.items())
    ]


async def _attempts(session: AsyncSession, user_id: UUID, exam_id: UUID) -> list[Attempt]:
    return list(
        (
            await session.scalars(
                select(Attempt)
                .where(
                    Attempt.user_id == user_id,
                    Attempt.exam_id == exam_id,
                    Attempt.status == AttemptStatus.EVALUATED,
                )
                .order_by(Attempt.submitted_at, Attempt.id)
            )
        ).all()
    )


async def _observations(
    session: AsyncSession, user_id: UUID, exam_id: UUID
) -> list[SkillObservation]:
    rows = (
        await session.execute(
            select(
                QuestionEvaluation,
                MockQuestion.skill_ids,
                MockQuestion.topic,
                MockQuestion.section_id,
                Attempt.submitted_at,
            )
            .join(Attempt, Attempt.id == QuestionEvaluation.attempt_id)
            .join(MockQuestion, MockQuestion.id == QuestionEvaluation.question_id)
            .where(
                Attempt.user_id == user_id,
                Attempt.exam_id == exam_id,
                Attempt.status == AttemptStatus.EVALUATED,
                QuestionEvaluation.max_points > 0,
            )
        )
    ).all()
    observations: list[SkillObservation] = []
    for evaluation, raw_skills, topic, section_id, submitted_at in rows:
        skills = [str(item) for item in raw_skills] if isinstance(raw_skills, list) else []
        if not skills:
            skills = [str(topic or section_id or "core-knowledge")]
        observed_at = submitted_at or evaluation.created_at
        for skill_id in dict.fromkeys(skills):
            observations.append(
                SkillObservation(
                    attempt_id=evaluation.attempt_id,
                    question_id=evaluation.question_id,
                    skill_id=skill_id,
                    observed_at=observed_at,
                    score=evaluation.awarded_points / evaluation.max_points,
                    point_share=evaluation.max_points / len(skills),
                    evaluation_confidence=evaluation.confidence,
                )
            )
    return observations


def _pass_threshold(exam: Exam) -> int:
    return int(exam.rules.get("passPercentage", 50))


async def exam_analytics(
    session: AsyncSession,
    user_id: UUID,
    exam_id: UUID,
    *,
    now: datetime | None = None,
) -> ExamAnalyticsResponse:
    computed_at = now or datetime.now(UTC)
    exam = await get_exam(session, user_id, exam_id)
    blueprint_skills = await _blueprint_skills(session, exam)
    attempts = await _attempts(session, user_id, exam_id)
    observations = await _observations(session, user_id, exam_id)
    result = calculate_analytics(
        blueprint_skills,
        observations,
        pass_threshold=_pass_threshold(exam),
        target_date=exam.target_date,
        now=computed_at,
    )
    trajectory: list[AnalyticsTrajectoryPointResponse] = []
    included: set[UUID] = set()
    for attempt in attempts[-10:]:
        if attempt.submitted_at is None or attempt.score is None:
            continue
        included.add(attempt.id)
        historical = calculate_analytics(
            blueprint_skills,
            [item for item in observations if item.attempt_id in included],
            pass_threshold=_pass_threshold(exam),
            target_date=exam.target_date,
            now=attempt.submitted_at,
        )
        trajectory.append(
            AnalyticsTrajectoryPointResponse(
                attempt_id=attempt.id,
                observed_at=attempt.submitted_at,
                score_percentage=round(attempt.score / max(1, attempt.max_score) * 100, 1),
                readiness_index=historical.readiness.index,
                readiness_confidence=historical.readiness.confidence,
            )
        )
    return ExamAnalyticsResponse(
        model_version=MODEL_VERSION,
        computed_at=computed_at,
        exam_id=exam.id,
        exam_title=exam.title,
        attempt_ids=[item.id for item in attempts],
        constants=_constants(),
        readiness=_readiness_response(result.readiness),
        skills=[_skill_response(item) for item in result.skills],
        trajectory=trajectory,
        recommendations=[
            _recommendation_response(item, exam_id=exam.id) for item in result.recommendations
        ],
        adaptive=AdaptiveAnalyticsResponse(
            eligible=result.adaptive_eligible,
            target_skill_ids=result.adaptive_target_skill_ids,
            reason=result.adaptive_reason,
            confidence_level=result.adaptive_confidence,
        ),
    )


def _top_skill(result: ExamAnalyticsResponse) -> SkillAnalyticsResponse | None:
    values = [item for item in result.skills if item.mastery is not None]
    return max(values, key=lambda item: (item.mastery or 0.0, item.confidence), default=None)


def _priority_skill(result: ExamAnalyticsResponse) -> SkillAnalyticsResponse | None:
    targets = set(result.adaptive.target_skill_ids)
    return next((item for item in result.skills if item.skill_id in targets), None)


async def analytics_overview(
    session: AsyncSession, user_id: UUID, *, now: datetime | None = None
) -> AnalyticsOverviewResponse:
    computed_at = now or datetime.now(UTC)
    exams = list(
        (
            await session.scalars(
                select(Exam)
                .join(Workspace, Workspace.id == Exam.workspace_id)
                .where(accessible_workspace_filter(user_id))
                .order_by(Exam.target_date.asc().nulls_last(), Exam.created_at.desc())
            )
        ).all()
    )
    profiles = [await exam_analytics(session, user_id, exam.id, now=computed_at) for exam in exams]
    summaries: list[ExamAnalyticsSummaryResponse] = []
    for exam, profile in zip(exams, profiles, strict=True):
        latest_score = profile.trajectory[-1].score_percentage if profile.trajectory else None
        summaries.append(
            ExamAnalyticsSummaryResponse(
                exam_id=exam.id,
                exam_title=exam.title,
                target_date=exam.target_date.isoformat() if exam.target_date else None,
                attempt_count=len(profile.attempt_ids),
                latest_score_percentage=latest_score,
                readiness=profile.readiness,
                top_skill=_top_skill(profile),
                priority_skill=_priority_skill(profile),
            )
        )
    evaluated_questions = int(
        await session.scalar(
            select(func.count(QuestionEvaluation.id))
            .join(Attempt, Attempt.id == QuestionEvaluation.attempt_id)
            .where(Attempt.user_id == user_id, Attempt.status == AttemptStatus.EVALUATED)
        )
        or 0
    )
    recent_rows = (
        await session.execute(
            select(Attempt, Exam.title)
            .join(Exam, Exam.id == Attempt.exam_id)
            .where(Attempt.user_id == user_id, Attempt.status == AttemptStatus.EVALUATED)
            .order_by(Attempt.submitted_at.desc(), Attempt.id)
            .limit(10)
        )
    ).all()
    recent = [
        GlobalTrajectoryPointResponse(
            attempt_id=attempt.id,
            exam_id=attempt.exam_id,
            exam_title=title,
            observed_at=attempt.submitted_at or attempt.updated_at,
            score_percentage=round((attempt.score or 0) / max(1, attempt.max_score) * 100, 1),
        )
        for attempt, title in reversed(recent_rows)
    ]
    all_skills = [item for profile in profiles for item in profile.skills]
    recommendations = [
        item for profile in profiles for item in profile.recommendations if item.exam_id is not None
    ]
    next_action = max(recommendations, key=lambda item: item.priority, default=None)
    return AnalyticsOverviewResponse(
        model_version=MODEL_VERSION,
        computed_at=computed_at,
        total_attempts=sum(len(item.attempt_ids) for item in profiles),
        total_evaluated_questions=evaluated_questions,
        established_skill_count=sum(item.confidence_level == "established" for item in all_skills),
        developing_skill_count=sum(item.confidence_level == "developing" for item in all_skills),
        low_evidence_skill_count=sum(
            item.confidence_level == "low_evidence" for item in all_skills
        ),
        exams=summaries,
        next_action=next_action,
        recent_trajectory=recent,
    )


async def adaptive_context(
    session: AsyncSession, user_id: UUID, exam_id: UUID
) -> tuple[AnalyticsResult, ExamAnalyticsResponse]:
    profile = await exam_analytics(session, user_id, exam_id)
    exam = await get_exam(session, user_id, exam_id)
    observations = await _observations(session, user_id, exam_id)
    result = calculate_analytics(
        await _blueprint_skills(session, exam),
        observations,
        pass_threshold=_pass_threshold(exam),
        target_date=exam.target_date,
        now=profile.computed_at,
    )
    return result, profile
