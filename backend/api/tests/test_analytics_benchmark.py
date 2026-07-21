"""Frozen qualitative benchmark for analytics.v2 and adaptive.v2."""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from app.modules.analytics.model import BlueprintSkill, SkillObservation, calculate_analytics

NOW = datetime(2026, 7, 21, 12, tzinfo=UTC)
FIXTURE = Path(__file__).parent / "fixtures" / "analytics_benchmark.v1.json"


def test_frozen_qualitative_benchmark() -> None:
    scenarios = json.loads(FIXTURE.read_text())
    for scenario in scenarios:
        observations = [
            SkillObservation(
                attempt_id=uuid4(),
                question_id=uuid4(),
                skill_id="reasoning",
                observed_at=NOW - timedelta(days=(len(scenario["scores"]) - index) * 3),
                score=score,
                point_share=1,
                evaluation_confidence=0.9,
            )
            for index, score in enumerate(scenario["scores"])
        ]
        result = calculate_analytics(
            [BlueprintSkill("reasoning", "Reasoning", 1)],
            observations,
            pass_threshold=60,
            target_date=None,
            now=NOW,
        )
        metric = result.skills[0]
        if "expected_trend" in scenario:
            assert metric.trend == scenario["expected_trend"], scenario["name"]
        if "expected_confidence" in scenario:
            assert metric.confidence_level == scenario["expected_confidence"], scenario["name"]
        if "expected_status_not" in scenario:
            assert result.readiness.status != scenario["expected_status_not"], scenario["name"]
        assert result.readiness.index is None or 0 <= result.readiness.index <= 100


def test_difficulty_is_bounded_and_time_never_reduces_mastery() -> None:
    attempt_id = uuid4()
    question_id = uuid4()
    matched = SkillObservation(
        attempt_id=attempt_id,
        question_id=question_id,
        skill_id="reasoning",
        observed_at=NOW,
        score=0.7,
        point_share=1,
        evaluation_confidence=1,
        difficulty="matched",
        duration_seconds=60,
    )
    hard_slow = SkillObservation(
        attempt_id=attempt_id,
        question_id=question_id,
        skill_id="reasoning",
        observed_at=NOW,
        score=0.7,
        point_share=1,
        evaluation_confidence=1,
        difficulty="harder",
        duration_seconds=600,
    )
    base = calculate_analytics(
        [BlueprintSkill("reasoning", "Reasoning", 1)],
        [matched],
        pass_threshold=60,
        target_date=None,
        now=NOW,
    )
    adjusted = calculate_analytics(
        [BlueprintSkill("reasoning", "Reasoning", 1)],
        [hard_slow],
        pass_threshold=60,
        target_date=None,
        now=NOW,
    )
    assert adjusted.skills[0].mastery is not None
    assert base.skills[0].mastery is not None
    assert adjusted.skills[0].mastery >= base.skills[0].mastery
    assert adjusted.skills[0].timing_signal in {"typical", "slow_but_correct"}
    assert adjusted.policy_version == "adaptive.v2"
