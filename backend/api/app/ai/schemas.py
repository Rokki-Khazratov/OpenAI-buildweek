"""Structured inputs and outputs shared by every AI provider."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class SourceChunkInput(BaseModel):
    chunk_id: str
    artifact_id: str
    artifact_name: str
    artifact_kind: str
    page_number: int | None
    text: str


class SkillDefinition(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=200)


class UnresolvedField(BaseModel):
    path: str = Field(min_length=1, max_length=240)
    reason: str = Field(min_length=1, max_length=500)


class BlueprintSectionDraft(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    question_type: str = Field(min_length=1, max_length=120)
    question_count: int = Field(ge=1, le=200)
    duration_minutes: int = Field(ge=1, le=1440)
    points: int = Field(ge=1, le=10000)
    skills: list[str] = Field(min_length=1, max_length=20)
    confidence: float = Field(ge=0, le=1)
    source_refs: list[str] = Field(min_length=1, max_length=30)


class BlueprintRulesDraft(BaseModel):
    duration_minutes: int | None = Field(default=None, ge=1, le=1440)
    total_points: int | None = Field(default=None, ge=1, le=10000)
    pass_percentage: int | None = Field(default=None, ge=1, le=100)
    penalty: str = Field(default="", max_length=1000)
    allowed_materials: str = Field(default="", max_length=1000)
    grading_notes: str = Field(default="", max_length=4000)
    source_refs: list[str] = Field(default_factory=list, max_length=30)


class BlueprintDraft(BaseModel):
    sections: list[BlueprintSectionDraft] = Field(min_length=1, max_length=50)
    rules: BlueprintRulesDraft
    skill_taxonomy: list[SkillDefinition] = Field(min_length=1, max_length=200)
    unresolved_fields: list[UnresolvedField] = Field(default_factory=list, max_length=100)
    overall_confidence: float = Field(ge=0, le=1)


class BlueprintExtractionInput(BaseModel):
    exam_title: str
    exam_description: str
    exam_type: str
    language: str
    pasted_context: str
    existing_blueprint: list[dict[str, object]]
    existing_rules: dict[str, object]
    chunks: list[SourceChunkInput] = Field(min_length=1)
    validation_feedback: list[str] = Field(default_factory=list)


class RubricLevel(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    points: int = Field(ge=0)
    description: str = Field(min_length=1, max_length=600)


class RubricDimension(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=160)
    max_points: int = Field(ge=1)
    criteria: list[RubricLevel] = Field(min_length=2, max_length=8)


class QuestionRubric(BaseModel):
    version: Literal["rubric.v1"] = "rubric.v1"
    dimensions: list[RubricDimension] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def unique_dimensions(self) -> "QuestionRubric":
        ids = [item.id for item in self.dimensions]
        if len(ids) != len(set(ids)):
            raise ValueError("Rubric dimension IDs must be unique")
        return self


class GeneratedQuestion(BaseModel):
    section_id: str
    question_type: str
    prompt: str = Field(min_length=10)
    points: int = Field(ge=1)
    answer_key: str = Field(min_length=1)
    skill_ids: list[str] = Field(min_length=1, max_length=10)
    difficulty: Literal["easy", "matched", "hard"] = "matched"
    grading_mode: Literal["objective", "rubric"] = "rubric"
    rubric: QuestionRubric | None = None
    citation_chunk_ids: list[str] = Field(min_length=1)


class GeneratedMock(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    instructions: str = Field(default="", max_length=4000)
    questions: list[GeneratedQuestion] = Field(min_length=1, max_length=200)


class MockGenerationInput(BaseModel):
    exam_context: dict[str, object]
    chunks: list[SourceChunkInput] = Field(min_length=1)
    adaptation_context: dict[str, object] = Field(default_factory=dict)
    validation_feedback: list[str] = Field(default_factory=list)


class EvaluationDimensionScore(BaseModel):
    dimension_id: str
    awarded_points: int = Field(ge=0)
    reason: str = Field(min_length=1, max_length=1000)
    answer_evidence: list[str] = Field(default_factory=list, max_length=5)


class EvaluationFeedback(BaseModel):
    strength: str = Field(default="", max_length=1000)
    improvement: str = Field(default="", max_length=1000)
    next_step: str = Field(default="", max_length=1000)


class EvaluationSourceEvidence(BaseModel):
    chunk_id: str
    quote: str = Field(min_length=1, max_length=500)


class OpenQuestionEvaluation(BaseModel):
    question_id: str
    dimension_scores: list[EvaluationDimensionScore]
    suggested_points: int = Field(ge=0)
    feedback: EvaluationFeedback
    source_evidence: list[EvaluationSourceEvidence] = Field(default_factory=list, max_length=8)
    confidence: float = Field(ge=0, le=1)
    flags: list[str] = Field(default_factory=list, max_length=10)


class EvaluationBatch(BaseModel):
    evaluations: list[OpenQuestionEvaluation]
    overall_feedback: str = Field(default="", max_length=2000)


class EvaluationQuestionInput(BaseModel):
    question_id: str
    prompt: str
    student_answer: str
    maximum_points: int
    answer_key: str
    rubric: dict[str, object]
    source_chunks: list[SourceChunkInput]


class EvaluationInput(BaseModel):
    exam_rules: dict[str, object]
    language: str
    questions: list[EvaluationQuestionInput] = Field(min_length=1)
    validation_feedback: list[str] = Field(default_factory=list)
