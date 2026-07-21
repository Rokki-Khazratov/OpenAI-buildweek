"""Pure, versioned analytics calculations with no database dependencies."""

import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Literal
from uuid import UUID

MODEL_VERSION = "analytics.v2"
POLICY_VERSION = "adaptive.v2"
RECENCY_HALF_LIFE_DAYS = 30.0
COVERAGE_SCALE = 3.0
READINESS_UNCERTAINTY_PENALTY = 15.0

Trend = Literal["insufficient_data", "improving", "stable", "declining"]
ConfidenceLevel = Literal["low_evidence", "developing", "established"]
ReadinessStatus = Literal["no_data", "early_signal", "at_risk", "on_track", "ready"]


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


@dataclass(frozen=True, slots=True)
class BlueprintSkill:
    skill_id: str
    label: str
    weight: float


@dataclass(frozen=True, slots=True)
class SkillObservation:
    attempt_id: UUID
    question_id: UUID
    skill_id: str
    observed_at: datetime
    score: float
    point_share: float
    evaluation_confidence: float
    difficulty: str = "matched"
    duration_seconds: int | None = None


@dataclass(frozen=True, slots=True)
class SkillMetric:
    skill_id: str
    label: str
    blueprint_weight: float
    mastery: float | None
    confidence: float
    confidence_level: ConfidenceLevel
    evidence_count: int
    effective_evidence: float
    attempt_count: int
    trend: Trend
    trend_delta: float | None
    latest_observed_at: datetime | None
    timing_signal: Literal["not_used", "typical", "slow_but_correct"]


@dataclass(frozen=True, slots=True)
class ReadinessMetric:
    index: float | None
    raw_mastery: float | None
    confidence: float
    coverage: float
    status: ReadinessStatus
    pass_threshold: int
    explanation: str


@dataclass(frozen=True, slots=True)
class Recommendation:
    action: str
    title: str
    reason: str
    target_skill_ids: list[str]
    confidence: float
    priority: float


@dataclass(frozen=True, slots=True)
class AnalyticsResult:
    skills: list[SkillMetric]
    readiness: ReadinessMetric
    recommendations: list[Recommendation]
    adaptive_eligible: bool
    adaptive_target_skill_ids: list[str]
    adaptive_reason: str
    adaptive_confidence: ConfidenceLevel
    policy_version: str
    adaptive_target_reasons: dict[str, str]
    exploration_share: float


def difficulty_adjusted_score(item: SkillObservation) -> float:
    """Apply a deliberately small, bounded correction to validated difficulty."""
    correction = {"easier": -0.03, "easy": -0.03, "harder": 0.05, "hard": 0.05}.get(
        item.difficulty.casefold(), 0.0
    )
    return clamp(item.score + correction)


def recency_weight(observed_at: datetime, now: datetime) -> float:
    observed = observed_at if observed_at.tzinfo else observed_at.replace(tzinfo=UTC)
    current = now if now.tzinfo else now.replace(tzinfo=UTC)
    age_days = max(0.0, (current - observed).total_seconds() / 86400)
    return math.pow(0.5, age_days / RECENCY_HALF_LIFE_DAYS)


def confidence_level(value: float) -> ConfidenceLevel:
    if value < 0.35:
        return "low_evidence"
    if value < 0.70:
        return "developing"
    return "established"


def _weighted_average(values: list[tuple[float, float]]) -> float:
    total_weight = sum(weight for _, weight in values)
    if total_weight <= 0:
        return 0.0
    return sum(value * weight for value, weight in values) / total_weight


def _trend(observations: list[SkillObservation]) -> tuple[Trend, float | None]:
    grouped: dict[UUID, list[tuple[float, float]]] = defaultdict(list)
    observed_at: dict[UUID, datetime] = {}
    for item in observations:
        weight = max(0.01, item.point_share) * clamp(item.evaluation_confidence, 0.25, 1.0)
        grouped[item.attempt_id].append((clamp(item.score), weight))
        observed_at[item.attempt_id] = item.observed_at
    ordered = sorted(grouped, key=lambda attempt_id: (observed_at[attempt_id], str(attempt_id)))[
        -5:
    ]
    if len(ordered) < 3:
        return "insufficient_data", None
    values = [_weighted_average(grouped[attempt_id]) for attempt_id in ordered]
    delta = sum(values[-2:]) / 2 - sum(values[:2]) / 2
    if delta >= 0.08:
        return "improving", round(delta, 4)
    if delta <= -0.08:
        return "declining", round(delta, 4)
    return "stable", round(delta, 4)


def calculate_skill_metric(
    skill: BlueprintSkill,
    observations: list[SkillObservation],
    *,
    now: datetime,
) -> SkillMetric:
    if not observations:
        return SkillMetric(
            skill_id=skill.skill_id,
            label=skill.label,
            blueprint_weight=skill.weight,
            mastery=None,
            confidence=0.0,
            confidence_level="low_evidence",
            evidence_count=0,
            effective_evidence=0.0,
            attempt_count=0,
            trend="insufficient_data",
            trend_delta=None,
            latest_observed_at=None,
            timing_signal="not_used",
        )
    weighted_scores: list[tuple[float, float]] = []
    effective_evidence = 0.0
    for item in observations:
        recency = recency_weight(item.observed_at, now)
        evaluator = clamp(item.evaluation_confidence, 0.25, 1.0)
        weighted_scores.append(
            (
                difficulty_adjusted_score(item),
                max(0.01, item.point_share) * evaluator * recency,
            )
        )
        effective_evidence += evaluator * recency
    mastery = _weighted_average(weighted_scores)
    if len(observations) < 2:
        consistency = 0.5
    else:
        variance = _weighted_average(
            [((score - mastery) ** 2, weight) for score, weight in weighted_scores]
        )
        consistency = 1 - min(math.sqrt(max(0.0, variance)) / 0.5, 1.0)
    coverage = 1 - math.exp(-effective_evidence / COVERAGE_SCALE)
    latest = max(item.observed_at for item in observations)
    freshness = recency_weight(latest, now)
    confidence = clamp(coverage * (0.6 + 0.4 * consistency) * (0.7 + 0.3 * freshness))
    trend, delta = _trend(observations)
    timed = [item for item in observations if item.duration_seconds is not None]
    timing_signal: Literal["not_used", "typical", "slow_but_correct"] = "not_used"
    if timed:
        timing_signal = "typical"
        latest_timed = max(timed, key=lambda item: item.observed_at)
        durations = sorted(item.duration_seconds or 0 for item in timed)
        median = durations[len(durations) // 2]
        if latest_timed.score >= 0.7 and (latest_timed.duration_seconds or 0) > max(
            60, median * 1.5
        ):
            timing_signal = "slow_but_correct"
    return SkillMetric(
        skill_id=skill.skill_id,
        label=skill.label,
        blueprint_weight=round(skill.weight, 6),
        mastery=round(mastery, 4),
        confidence=round(confidence, 4),
        confidence_level=confidence_level(confidence),
        evidence_count=len(observations),
        effective_evidence=round(effective_evidence, 4),
        attempt_count=len({item.attempt_id for item in observations}),
        trend=trend,
        trend_delta=delta,
        latest_observed_at=latest,
        timing_signal=timing_signal,
    )


def _urgency_factor(target_date: date | None, now: datetime) -> float:
    if target_date is None:
        return 1.0
    days = (target_date - now.date()).days
    if days <= 14:
        return 1.2
    if days <= 30:
        return 1.1
    return 1.0


def _readiness(metrics: list[SkillMetric], pass_threshold: int) -> ReadinessMetric:
    total_evidence = sum(item.evidence_count for item in metrics)
    if total_evidence == 0:
        return ReadinessMetric(
            index=None,
            raw_mastery=None,
            confidence=0.0,
            coverage=0.0,
            status="no_data",
            pass_threshold=pass_threshold,
            explanation="Complete a mock to create the first readiness signal.",
        )
    raw_mastery = sum(
        (item.mastery if item.mastery is not None else 0.5) * item.blueprint_weight
        for item in metrics
    )
    overall_confidence = sum(item.confidence * item.blueprint_weight for item in metrics)
    coverage = sum(
        (1.0 if item.evidence_count else 0.0) * item.blueprint_weight for item in metrics
    )
    index = clamp(
        raw_mastery * 100 - (1 - overall_confidence) * READINESS_UNCERTAINTY_PENALTY,
        0,
        100,
    )
    if overall_confidence < 0.35:
        status: ReadinessStatus = "early_signal"
    elif index < pass_threshold:
        status = "at_risk"
    elif index >= pass_threshold + 10 and overall_confidence >= 0.70:
        status = "ready"
    else:
        status = "on_track"
    missing = [item.label for item in metrics if item.evidence_count == 0]
    established_gaps = sorted(
        (item for item in metrics if item.mastery is not None and item.confidence >= 0.35),
        key=lambda item: ((item.mastery or 0.0), -item.blueprint_weight),
    )
    if missing:
        explanation = "Confidence is limited by missing evidence in " + ", ".join(missing[:2]) + "."
    elif established_gaps:
        explanation = f"Readiness is most limited by {established_gaps[0].label}."
    else:
        explanation = "Readiness reflects the available evaluated evidence."
    return ReadinessMetric(
        index=round(index, 1),
        raw_mastery=round(raw_mastery, 4),
        confidence=round(overall_confidence, 4),
        coverage=round(coverage, 4),
        status=status,
        pass_threshold=pass_threshold,
        explanation=explanation,
    )


def calculate_analytics(
    blueprint_skills: list[BlueprintSkill],
    observations: list[SkillObservation],
    *,
    pass_threshold: int,
    target_date: date | None,
    now: datetime,
) -> AnalyticsResult:
    by_skill: dict[str, list[SkillObservation]] = defaultdict(list)
    for observation in observations:
        by_skill[observation.skill_id].append(observation)
    metrics = [
        calculate_skill_metric(skill, by_skill.get(skill.skill_id, []), now=now)
        for skill in blueprint_skills
    ]
    metrics.sort(key=lambda item: (-item.blueprint_weight, item.label.casefold()))
    readiness = _readiness(metrics, pass_threshold)
    urgency = _urgency_factor(target_date, now)
    ranked: list[tuple[float, SkillMetric]] = []
    for metric in metrics:
        mastery = metric.mastery if metric.mastery is not None else 0.5
        trend_factor = (
            1.2 if metric.trend == "declining" else 0.9 if metric.trend == "improving" else 1.0
        )
        priority = (
            metric.blueprint_weight
            * (1 - mastery)
            * (0.5 + 0.5 * metric.confidence)
            * trend_factor
            * urgency
        )
        ranked.append((priority, metric))
    ranked.sort(key=lambda pair: (-pair[0], pair[1].label.casefold()))
    candidates = [
        metric
        for _, metric in ranked
        if metric.mastery is None or metric.mastery < 0.75 or metric.confidence < 0.35
    ]
    exploitation = [item for item in candidates if item.confidence >= 0.35]
    exploration = [item for item in candidates if item.confidence < 0.35]
    retention = [
        item
        for item in metrics
        if item.mastery is not None
        and item.mastery >= 0.75
        and item.latest_observed_at is not None
        and recency_weight(item.latest_observed_at, now) < 0.5
    ]
    targets: list[SkillMetric] = []
    for pool in (exploitation[:2], exploration[:1], retention[:1], candidates):
        for item in pool:
            if item.skill_id not in {target.skill_id for target in targets}:
                targets.append(item)
            if len(targets) == 3:
                break
        if len(targets) == 3:
            break
    recommendations: list[Recommendation] = []
    if readiness.status == "no_data":
        recommendations.append(
            Recommendation(
                action="run_full_mock",
                title="Complete a diagnostic mock",
                reason=(
                    "No evaluated evidence exists yet, so ExamTwin cannot estimate "
                    "readiness reliably."
                ),
                target_skill_ids=[],
                confidence=0.0,
                priority=1.0,
            )
        )
    else:
        for priority, metric in ranked[:3]:
            if metric.confidence < 0.35:
                action = "collect_evidence"
                title = f"Collect more evidence for {metric.label}"
                reason = f"Only {metric.evidence_count} evaluated question(s) support this signal."
            elif metric.trend == "declining":
                action = "reverse_decline"
                title = f"Reverse the decline in {metric.label}"
                reason = (
                    f"Mastery is {round((metric.mastery or 0) * 100)}% and recent "
                    "performance is declining."
                )
            else:
                action = "practice_weak_skill"
                title = f"Practice {metric.label} next"
                reason = (
                    f"Mastery is {round((metric.mastery or 0) * 100)}% across "
                    f"{metric.evidence_count} evaluated question(s), with "
                    f"{round(metric.blueprint_weight * 100)}% blueprint weight."
                )
            recommendations.append(
                Recommendation(
                    action=action,
                    title=title,
                    reason=reason,
                    target_skill_ids=[metric.skill_id],
                    confidence=metric.confidence,
                    priority=round(priority, 4),
                )
            )
    target_ids = [metric.skill_id for metric in targets] if readiness.status != "no_data" else []
    target_reasons = {
        metric.skill_id: (
            "collect_evidence"
            if metric.confidence < 0.35
            else "retention_refresh"
            if metric in retention
            else "confirmed_gap"
        )
        for metric in targets
    }
    exploration_share = (
        sum(reason == "collect_evidence" for reason in target_reasons.values())
        / len(target_reasons)
        if target_reasons
        else 0.0
    )
    adaptive_confidence: ConfidenceLevel = min(
        (item.confidence_level for item in targets),
        default="low_evidence",
        key=lambda level: {"low_evidence": 0, "developing": 1, "established": 2}[level],
    )
    if not target_ids:
        adaptive_reason = "Complete another full mock before generating an adaptive target set."
    elif adaptive_confidence == "low_evidence":
        adaptive_reason = (
            "This diagnostic adaptive mock will collect evidence for high-impact skills."
        )
    else:
        adaptive_reason = "This mock targets the highest-impact skills limiting readiness."
    return AnalyticsResult(
        skills=metrics,
        readiness=readiness,
        recommendations=recommendations,
        adaptive_eligible=bool(target_ids),
        adaptive_target_skill_ids=target_ids,
        adaptive_reason=adaptive_reason,
        adaptive_confidence=adaptive_confidence,
        policy_version=POLICY_VERSION,
        adaptive_target_reasons=target_reasons,
        exploration_share=round(exploration_share, 4),
    )
