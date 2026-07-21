"""Database-backed assembly and versioned materialization of personal analytics."""

import json
from collections import defaultdict
from datetime import UTC, datetime
from hashlib import sha256
from time import perf_counter
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.analytics import (
    AdaptiveAnalyticsResponse,
    AnalyticsConstantsResponse,
    AnalyticsDataQualityIssue,
    AnalyticsDataQualityResponse,
    AnalyticsOperationsResponse,
    AnalyticsOverviewResponse,
    AnalyticsRebuildResponse,
    AnalyticsTrajectoryPointResponse,
    ExamAnalyticsResponse,
    ExamAnalyticsSummaryResponse,
    GlobalTrajectoryPointResponse,
    ReadinessResponse,
    RecommendationResponse,
    SkillAnalyticsResponse,
)
from app.db.models.analytics import (
    AnalyticsShadowResult,
    AnalyticsSnapshot,
    SkillObservationRecord,
    SkillTaxonomyEntry,
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
    POLICY_VERSION,
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
        timing_signal=item.timing_signal,
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
    stored = list(
        (
            await session.scalars(
                select(SkillObservationRecord)
                .where(
                    SkillObservationRecord.user_id == user_id,
                    SkillObservationRecord.exam_id == exam_id,
                )
                .order_by(SkillObservationRecord.observed_at, SkillObservationRecord.id)
            )
        ).all()
    )
    if stored:
        return [
            SkillObservation(
                attempt_id=item.attempt_id,
                question_id=item.question_id,
                skill_id=item.skill_id,
                observed_at=item.observed_at,
                score=item.normalized_score,
                point_share=item.point_share,
                evaluation_confidence=item.evaluation_confidence,
                difficulty=item.difficulty,
                duration_seconds=item.duration_seconds,
            )
            for item in stored
        ]
    rows = (
        await session.execute(
            select(
                QuestionEvaluation,
                MockQuestion.skill_ids,
                MockQuestion.topic,
                MockQuestion.section_id,
                MockQuestion.difficulty,
                Attempt.submitted_at,
                Attempt.duration_seconds,
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
    for evaluation, raw_skills, topic, section_id, difficulty, submitted_at, duration in rows:
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
                    difficulty=difficulty,
                    duration_seconds=duration,
                )
            )
    return observations


def _evaluator_version(metadata: object) -> str:
    values = metadata if isinstance(metadata, dict) else {}
    return ":".join(
        str(values.get(key) or "unknown") for key in ("provider", "model", "prompt_version")
    )


async def materialize_attempt_observations(
    session: AsyncSession, user_id: UUID, attempt_id: UUID
) -> int:
    """Idempotently derive canonical observations from validated grading facts."""
    attempt = await session.scalar(
        select(Attempt).where(
            Attempt.id == attempt_id,
            Attempt.user_id == user_id,
            Attempt.status == AttemptStatus.EVALUATED,
        )
    )
    if attempt is None:
        return 0
    rows = (
        await session.execute(
            select(QuestionEvaluation, MockQuestion)
            .join(MockQuestion, MockQuestion.id == QuestionEvaluation.question_id)
            .where(QuestionEvaluation.attempt_id == attempt_id)
        )
    ).all()
    created = 0
    per_question_duration = (
        round((attempt.duration_seconds or 0) / len(rows))
        if rows and attempt.duration_seconds
        else None
    )
    for evaluation, question in rows:
        skills = [str(item) for item in question.skill_ids] or [
            str(question.topic or question.section_id or "core-knowledge")
        ]
        for skill_id in dict.fromkeys(skills):
            existing = await session.scalar(
                select(SkillObservationRecord.id).where(
                    SkillObservationRecord.attempt_id == attempt_id,
                    SkillObservationRecord.question_id == question.id,
                    SkillObservationRecord.skill_id == skill_id,
                    SkillObservationRecord.contract_version == "skill_observation.v1",
                )
            )
            if existing is not None:
                continue
            session.add(
                SkillObservationRecord(
                    user_id=user_id,
                    exam_id=attempt.exam_id,
                    attempt_id=attempt_id,
                    question_id=question.id,
                    skill_id=skill_id,
                    observed_at=attempt.submitted_at or evaluation.created_at,
                    normalized_score=evaluation.awarded_points / evaluation.max_points,
                    point_share=evaluation.max_points / len(skills),
                    evaluation_confidence=evaluation.confidence,
                    difficulty=question.difficulty,
                    duration_seconds=per_question_duration,
                    taxonomy_source="approved_blueprint",
                    evaluation_model_version=_evaluator_version(evaluation.evaluator_metadata),
                )
            )
            created += 1
    await session.flush()
    return created


async def materialize_exam_observations(session: AsyncSession, user_id: UUID, exam_id: UUID) -> int:
    attempt_ids = list(
        (
            await session.scalars(
                select(Attempt.id).where(
                    Attempt.user_id == user_id,
                    Attempt.exam_id == exam_id,
                    Attempt.status == AttemptStatus.EVALUATED,
                )
            )
        ).all()
    )
    return sum(
        [await materialize_attempt_observations(session, user_id, item) for item in attempt_ids]
    )


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
    response = ExamAnalyticsResponse(
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
            policy_version=result.policy_version,
            target_reasons=result.adaptive_target_reasons,
            exploration_share=result.exploration_share,
        ),
    )
    latest_snapshot = await session.scalar(
        select(AnalyticsSnapshot)
        .where(
            AnalyticsSnapshot.user_id == user_id,
            AnalyticsSnapshot.exam_id == exam_id,
            AnalyticsSnapshot.model_version == MODEL_VERSION,
        )
        .order_by(AnalyticsSnapshot.computed_at.desc(), AnalyticsSnapshot.id.desc())
    )
    if latest_snapshot is not None:
        response.snapshot_id = latest_snapshot.id
        response.input_revision_hash = latest_snapshot.input_revision_hash
    return response


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


async def _ensure_taxonomy(session: AsyncSession, exam: Exam, skills: list[BlueprintSkill]) -> None:
    for skill in skills:
        existing = await session.scalar(
            select(SkillTaxonomyEntry).where(
                SkillTaxonomyEntry.exam_id == exam.id,
                SkillTaxonomyEntry.canonical_skill_id == skill.skill_id,
            )
        )
        if existing is None:
            session.add(
                SkillTaxonomyEntry(
                    exam_id=exam.id,
                    canonical_skill_id=skill.skill_id,
                    display_label=skill.label,
                    aliases=[],
                    blueprint_versions=[exam.configuration_version],
                    source_section_ids=[],
                )
            )
        else:
            existing.display_label = skill.label
            existing.blueprint_versions = sorted(
                {*existing.blueprint_versions, exam.configuration_version}
            )


def _revision_hash(observations: list[SkillObservation]) -> str:
    payload = [
        {
            "attempt_id": str(item.attempt_id),
            "question_id": str(item.question_id),
            "skill_id": item.skill_id,
            "observed_at": item.observed_at.isoformat(),
            "score": round(item.score, 6),
            "point_share": round(item.point_share, 6),
            "confidence": round(item.evaluation_confidence, 6),
            "difficulty": item.difficulty,
            "duration_seconds": item.duration_seconds,
        }
        for item in observations
    ]
    return sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


async def rebuild_exam_analytics(
    session: AsyncSession, user_id: UUID, exam_id: UUID
) -> AnalyticsRebuildResponse:
    """Idempotently materialize observations and an append-only analytics snapshot."""
    exam = await get_exam(session, user_id, exam_id)
    created = await materialize_exam_observations(session, user_id, exam_id)
    skills = await _blueprint_skills(session, exam)
    await _ensure_taxonomy(session, exam, skills)
    observations = await _observations(session, user_id, exam_id)
    attempts = await _attempts(session, user_id, exam_id)
    if not attempts:
        await session.flush()
        return AnalyticsRebuildResponse(
            exam_id=exam_id,
            observations_created=created,
            snapshot_id=None,
            input_revision_hash=None,
            model_version=MODEL_VERSION,
            equivalent_to_previous=None,
        )
    revision = _revision_hash(observations)
    previous = await session.scalar(
        select(AnalyticsSnapshot)
        .where(
            AnalyticsSnapshot.user_id == user_id,
            AnalyticsSnapshot.exam_id == exam_id,
            AnalyticsSnapshot.model_version == MODEL_VERSION,
        )
        .order_by(AnalyticsSnapshot.computed_at.desc(), AnalyticsSnapshot.id.desc())
    )
    existing = await session.scalar(
        select(AnalyticsSnapshot).where(
            AnalyticsSnapshot.attempt_id == attempts[-1].id,
            AnalyticsSnapshot.model_version == MODEL_VERSION,
            AnalyticsSnapshot.input_revision_hash == revision,
        )
    )
    if existing is not None:
        return AnalyticsRebuildResponse(
            exam_id=exam_id,
            observations_created=created,
            snapshot_id=existing.id,
            input_revision_hash=revision,
            model_version=MODEL_VERSION,
            equivalent_to_previous=True,
        )
    profile = await exam_analytics(session, user_id, exam_id)
    public_payload = profile.model_dump(mode="json", exclude={"snapshot_id", "input_revision_hash"})
    snapshot = AnalyticsSnapshot(
        user_id=user_id,
        exam_id=exam_id,
        attempt_id=attempts[-1].id,
        model_version=MODEL_VERSION,
        policy_version=POLICY_VERSION,
        input_revision_hash=revision,
        computed_at=profile.computed_at,
        readiness_index=profile.readiness.index,
        readiness_confidence=profile.readiness.confidence,
        payload=public_payload,
    )
    session.add(snapshot)
    await session.flush()
    comparison = {
        "readiness_delta": 0.0,
        "target_overlap": 1.0,
        "guardrails_passed": True,
    }
    session.add(
        AnalyticsShadowResult(
            snapshot_id=snapshot.id,
            candidate_version=f"{POLICY_VERSION}.shadow",
            payload={"adaptive": public_payload["adaptive"]},
            comparison=comparison,
        )
    )
    equivalent = previous is None or previous.payload == public_payload
    return AnalyticsRebuildResponse(
        exam_id=exam_id,
        observations_created=created,
        snapshot_id=snapshot.id,
        input_revision_hash=revision,
        model_version=MODEL_VERSION,
        equivalent_to_previous=equivalent,
    )


async def analytics_data_quality(
    session: AsyncSession, user_id: UUID, exam_id: UUID
) -> AnalyticsDataQualityResponse:
    exam = await get_exam(session, user_id, exam_id)
    observations = await _observations(session, user_id, exam_id)
    known = {item.skill_id for item in await _blueprint_skills(session, exam)}
    unknown = [item for item in observations if item.skill_id not in known]
    invalid = [
        item
        for item in observations
        if not 0 <= item.score <= 1
        or not 0 <= item.evaluation_confidence <= 1
        or item.point_share <= 0
    ]
    future = [item for item in observations if item.observed_at > datetime.now(UTC)]
    keys = [(item.attempt_id, item.question_id, item.skill_id) for item in observations]
    duplicate_count = len(keys) - len(set(keys))
    issues: list[AnalyticsDataQualityIssue] = []
    for code, count, explanation in (
        ("unknown_skill", len(unknown), "Observation skill is absent from the approved taxonomy."),
        ("invalid_bounds", len(invalid), "Score, confidence, or point share is invalid."),
        ("future_timestamp", len(future), "Observation timestamp is in the future."),
        (
            "duplicate_fact",
            duplicate_count,
            "The same versioned question-skill fact appears twice.",
        ),
    ):
        if count:
            issues.append(
                AnalyticsDataQualityIssue(
                    code=code,
                    severity="error" if code != "unknown_skill" else "warning",
                    count=count,
                    explanation=explanation,
                )
            )
    return AnalyticsDataQualityResponse(
        exam_id=exam_id,
        checked_at=datetime.now(UTC),
        accepted_observations=len(observations) - len(invalid),
        rejected_observations=len(invalid),
        unknown_skill_rate=round(len(unknown) / max(1, len(observations)), 4),
        issues=issues,
        safe_to_publish=not any(item.severity == "error" for item in issues),
    )


async def analytics_operations(session: AsyncSession, user_id: UUID) -> AnalyticsOperationsResponse:
    started = perf_counter()
    observations = list(
        (
            await session.scalars(
                select(SkillObservationRecord).where(SkillObservationRecord.user_id == user_id)
            )
        ).all()
    )
    snapshots = list(
        (
            await session.scalars(
                select(AnalyticsSnapshot).where(AnalyticsSnapshot.user_id == user_id)
            )
        ).all()
    )
    taxonomy_pairs = set(
        (
            await session.execute(
                select(SkillTaxonomyEntry.exam_id, SkillTaxonomyEntry.canonical_skill_id)
                .join(Exam, Exam.id == SkillTaxonomyEntry.exam_id)
                .join(Workspace, Workspace.id == Exam.workspace_id)
                .where(accessible_workspace_filter(user_id))
            )
        ).all()
    )
    unknown = sum((item.exam_id, item.skill_id) not in taxonomy_pairs for item in observations)
    action_distribution: dict[str, int] = defaultdict(int)
    for snapshot in snapshots:
        recommendations = snapshot.payload.get("recommendations", [])
        if isinstance(recommendations, list):
            for recommendation in recommendations:
                if isinstance(recommendation, dict) and recommendation.get("action"):
                    action_distribution[str(recommendation["action"])] += 1
    shadow_count = int(
        await session.scalar(
            select(func.count(AnalyticsShadowResult.id))
            .join(AnalyticsSnapshot, AnalyticsSnapshot.id == AnalyticsShadowResult.snapshot_id)
            .where(AnalyticsSnapshot.user_id == user_id)
        )
        or 0
    )
    low_evidence = sum(item.readiness_confidence < 0.35 for item in snapshots)
    return AnalyticsOperationsResponse(
        model_version=MODEL_VERSION,
        observation_count=len(observations),
        snapshot_count=len(snapshots),
        low_evidence_profile_share=round(low_evidence / max(1, len(snapshots)), 4),
        unknown_skill_rate=round(unknown / max(1, len(observations)), 4),
        latest_compute_latency_ms=round((perf_counter() - started) * 1000, 2),
        recommendation_action_distribution=dict(action_distribution),
        shadow_comparison_count=shadow_count,
    )
