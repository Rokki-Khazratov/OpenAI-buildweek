"""Deterministic contract tests for AI-generated structures."""

from app.ai.schemas import (
    BlueprintDraft,
    BlueprintRulesDraft,
    BlueprintSectionDraft,
    GeneratedMock,
    GeneratedQuestion,
    QuestionRubric,
    RubricDimension,
    RubricLevel,
    SkillDefinition,
)
from app.ai.validators import validate_blueprint, validate_mock
from app.modules.exams.attempt_service import deterministic_objective_score, distribute_points


def draft() -> BlueprintDraft:
    return BlueprintDraft(
        sections=[
            BlueprintSectionDraft(
                id="theory",
                title="Theory",
                question_type="Open response",
                question_count=1,
                duration_minutes=10,
                points=10,
                skills=["core-theory"],
                confidence=0.9,
                source_refs=["chunk-1"],
            )
        ],
        rules=BlueprintRulesDraft(
            duration_minutes=10,
            total_points=10,
            pass_percentage=50,
            source_refs=["chunk-1"],
        ),
        skill_taxonomy=[SkillDefinition(id="core-theory", label="Core theory")],
        overall_confidence=0.9,
    )


def test_blueprint_validator_rejects_foreign_evidence_and_conflicting_totals() -> None:
    value = draft()
    assert validate_blueprint(value, allowed_chunk_ids={"chunk-1"}) == []
    value.sections[0].source_refs = ["foreign-chunk"]
    value.rules.total_points = 12
    errors = validate_blueprint(value, allowed_chunk_ids={"chunk-1"})
    assert {item["path"] for item in errors} == {
        "sections.0.source_refs",
        "rules.total_points",
    }


def test_mock_validator_enforces_blueprint_and_rubric_arithmetic() -> None:
    rubric = QuestionRubric(
        dimensions=[
            RubricDimension(
                id="accuracy",
                label="Accuracy",
                max_points=10,
                criteria=[
                    RubricLevel(label="full", points=10, description="Correct"),
                    RubricLevel(label="none", points=0, description="Incorrect"),
                ],
            )
        ]
    )
    generated = GeneratedMock(
        title="Mock",
        questions=[
            GeneratedQuestion(
                section_id="theory",
                question_type="Open response",
                prompt="Explain the central theory using the supplied source.",
                points=10,
                answer_key="Supported explanation",
                skill_ids=["core-theory"],
                rubric=rubric,
                citation_chunk_ids=["chunk-1"],
            )
        ],
    )
    blueprint = [
        {
            "id": "theory",
            "questionType": "Open response",
            "questionCount": 1,
            "points": 10,
        }
    ]
    assert (
        validate_mock(generated, blueprint_sections=blueprint, allowed_chunk_ids={"chunk-1"}) == []
    )
    generated.questions[0].points = 9
    errors = validate_mock(generated, blueprint_sections=blueprint, allowed_chunk_ids={"chunk-1"})
    assert any("needs 10 points" in item for item in errors)
    assert any("rubric points" in item for item in errors)


def test_deterministic_score_and_point_distribution_are_exact() -> None:
    assert distribute_points(10, 3) == [4, 3, 3]
    assert deterministic_objective_score("  Vienna ", "vienna", 5) == 5
    assert deterministic_objective_score("3.1400", "3.14", 5) == 5
    assert deterministic_objective_score("wrong", "right", 5) == 0
