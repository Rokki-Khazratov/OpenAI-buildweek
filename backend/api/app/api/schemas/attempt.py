"""P0 mock and attempt API schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.db.models.attempt import AttemptStatus


class MockQuestionResponse(BaseModel):
    id: UUID
    section_id: str
    position: int
    question_type: str
    prompt: str
    points: int
    topic: str | None = None
    skill_ids: list[str] = Field(default_factory=list)
    difficulty: str = "matched"
    citations: list[dict[str, str | int | None]] = Field(default_factory=list)


class MockExamResponse(BaseModel):
    id: UUID
    exam_id: UUID
    generator: str
    title: str
    instructions: str
    duration_minutes: int
    max_score: int
    generation_metadata: dict[str, object] = Field(default_factory=dict)
    questions: list[MockQuestionResponse]


class AttemptResponseItem(BaseModel):
    question_id: UUID
    answer: str
    flagged: bool
    version: int
    saved_at: datetime


class AttemptDetailResponse(BaseModel):
    id: UUID
    mock_exam: MockExamResponse
    status: AttemptStatus
    started_at: datetime
    last_saved_at: datetime
    submitted_at: datetime | None
    responses: list[AttemptResponseItem]


class ResponseSaveRequest(BaseModel):
    answer: str = Field(default="", max_length=50000)
    flagged: bool = False
    version: int | None = Field(default=None, ge=1)


class RubricDimensionResult(BaseModel):
    dimension_id: str
    awarded_points: int
    max_points: int
    reason: str
    answer_evidence: list[str] = Field(default_factory=list)


class QuestionResultResponse(BaseModel):
    question_id: UUID
    section_id: str
    question_number: int
    prompt: str
    question_type: str
    skill_ids: list[str]
    awarded_points: int
    max_points: int
    normalized_score: float
    strategy: str
    feedback: dict[str, str]
    dimension_scores: list[RubricDimensionResult]
    source_evidence: list[dict[str, str | int | None]]
    confidence: float
    flags: list[str]


class SectionResultResponse(BaseModel):
    section_id: str
    awarded_points: int
    max_points: int
    percentage: int


class AttemptResultResponse(BaseModel):
    attempt_id: UUID
    exam_id: UUID
    score: int
    max_score: int
    percentage: int
    passed: bool
    duration_seconds: int
    submitted_at: datetime
    feedback: str
    evaluator: str
    question_results: list[QuestionResultResponse] = Field(default_factory=list)
    section_results: list[SectionResultResponse] = Field(default_factory=list)


class AttemptSummaryResponse(AttemptResultResponse):
    status: AttemptStatus


class ExamStatisticsResponse(BaseModel):
    exam_id: UUID
    attempt_count: int
    average_percentage: int | None
    best_percentage: int | None
    latest_percentage: int | None
    average_duration_seconds: int | None
    low_confidence: bool
