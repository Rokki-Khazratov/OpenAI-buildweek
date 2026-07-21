"""Deterministic tests for the versioned personal analytics model."""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from app.modules.analytics.model import (
    BlueprintSkill,
    SkillObservation,
    calculate_analytics,
    calculate_skill_metric,
)

NOW = datetime(2026, 7, 21, 12, tzinfo=UTC)


def observation(
    *,
    skill_id: str,
    score: float,
    attempt_id: UUID | None = None,
    days_ago: int = 0,
    confidence: float = 1.0,
) -> SkillObservation:
    return SkillObservation(
        attempt_id=attempt_id or uuid4(),
        question_id=uuid4(),
        skill_id=skill_id,
        observed_at=NOW - timedelta(days=days_ago),
        score=score,
        point_share=1.0,
        evaluation_confidence=confidence,
    )


def test_no_evidence_requires_a_diagnostic_mock() -> None:
    result = calculate_analytics(
        [BlueprintSkill("reasoning", "Reasoning", 1.0)],
        [],
        pass_threshold=60,
        target_date=None,
        now=NOW,
    )

    assert result.readiness.index is None
    assert result.readiness.status == "no_data"
    assert result.adaptive_eligible is False
    assert result.adaptive_target_skill_ids == []
    assert result.recommendations[0].action == "run_full_mock"


def test_sparse_evidence_is_explicitly_low_confidence() -> None:
    result = calculate_analytics(
        [BlueprintSkill("reasoning", "Reasoning", 1.0)],
        [observation(skill_id="reasoning", score=0.8, confidence=0.6)],
        pass_threshold=60,
        target_date=None,
        now=NOW,
    )

    skill = result.skills[0]
    assert skill.mastery == 0.8
    assert skill.confidence_level == "low_evidence"
    assert result.readiness.status == "early_signal"
    assert result.adaptive_eligible is True
    assert result.recommendations[0].action == "collect_evidence"


def test_trend_uses_recent_attempt_level_signals() -> None:
    skill = BlueprintSkill("reasoning", "Reasoning", 1.0)
    improving = [
        observation(skill_id="reasoning", score=score, days_ago=days)
        for score, days in [(0.35, 12), (0.45, 8), (0.70, 4), (0.85, 0)]
    ]
    declining = [
        observation(skill_id="reasoning", score=score, days_ago=days)
        for score, days in [(0.90, 12), (0.80, 8), (0.55, 4), (0.35, 0)]
    ]

    improving_metric = calculate_skill_metric(skill, improving, now=NOW)
    declining_metric = calculate_skill_metric(skill, declining, now=NOW)

    assert improving_metric.trend == "improving"
    assert (improving_metric.trend_delta or 0) > 0
    assert declining_metric.trend == "declining"
    assert (declining_metric.trend_delta or 0) < 0


def test_readiness_is_bounded_and_blueprint_weighted() -> None:
    observations = [
        observation(skill_id="core", score=0.9, days_ago=index % 3) for index in range(16)
    ] + [observation(skill_id="secondary", score=0.4, days_ago=index % 3) for index in range(16)]
    result = calculate_analytics(
        [
            BlueprintSkill("core", "Core", 0.8),
            BlueprintSkill("secondary", "Secondary", 0.2),
        ],
        observations,
        pass_threshold=60,
        target_date=NOW.date() + timedelta(days=7),
        now=NOW,
    )

    assert result.readiness.raw_mastery == 0.8
    assert result.readiness.index is not None
    assert 0 <= result.readiness.index <= 100
    assert result.readiness.confidence >= 0.7
    assert result.adaptive_target_skill_ids[0] == "secondary"
