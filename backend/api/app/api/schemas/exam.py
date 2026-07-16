"""Exam CRUD schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models.exam import ExamStatus


class ExamSourcePayload(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    name: str = Field(min_length=1, max_length=500)
    kind: str = Field(min_length=1, max_length=64)
    size: str = Field(default="", max_length=64)
    status: str = Field(default="attached", max_length=64)


class BlueprintSectionPayload(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    questionType: str = Field(min_length=1, max_length=120)
    questionCount: int = Field(ge=1, le=200)
    durationMinutes: int = Field(ge=1, le=1440)
    points: int = Field(ge=1, le=10000)


class ExamRulesPayload(BaseModel):
    durationMinutes: int = Field(default=60, ge=1, le=1440)
    totalPoints: int = Field(default=100, ge=1, le=10000)
    passPercentage: int = Field(default=50, ge=1, le=100)
    penalty: str = Field(default="", max_length=1000)
    allowedMaterials: str = Field(default="", max_length=1000)
    gradingNotes: str = Field(default="", max_length=4000)


class ExamScenarioPayload(BaseModel):
    mode: str = Field(default="full_exam", max_length=64)
    difficulty: str = Field(default="matched", max_length=64)
    instructions: str = Field(default="", max_length=4000)


class ExamCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    exam_type: str | None = Field(default=None, max_length=120)
    language: str = Field(default="en", min_length=2, max_length=32)
    target_date: date | None = None
    pasted_context: str = Field(default="", max_length=20000)
    sources: list[ExamSourcePayload] = Field(default_factory=list, max_length=100)
    blueprint: list[BlueprintSectionPayload] = Field(default_factory=list, max_length=50)
    rules: ExamRulesPayload = Field(default_factory=ExamRulesPayload)
    scenario: ExamScenarioPayload = Field(default_factory=ExamScenarioPayload)

    @field_validator("title", "language")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank")
        return normalized

    @field_validator("description", "exam_type")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class ExamUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    exam_type: str | None = Field(default=None, max_length=120)
    language: str | None = Field(default=None, min_length=2, max_length=32)
    target_date: date | None = None
    status: ExamStatus | None = None
    pasted_context: str | None = Field(default=None, max_length=20000)
    sources: list[ExamSourcePayload] | None = Field(default=None, max_length=100)
    blueprint: list[BlueprintSectionPayload] | None = Field(default=None, max_length=50)
    rules: ExamRulesPayload | None = None
    scenario: ExamScenarioPayload | None = None
    configuration_version: int | None = Field(default=None, ge=1)


class ExamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    subject_id: UUID = Field(validation_alias="workspace_id")
    title: str
    description: str | None
    exam_type: str | None
    language: str
    target_date: date | None
    pasted_context: str
    sources: list[ExamSourcePayload]
    blueprint: list[BlueprintSectionPayload]
    rules: ExamRulesPayload
    scenario: ExamScenarioPayload
    configuration_version: int
    status: ExamStatus
    created_at: datetime
    updated_at: datetime


class ExamListResponse(BaseModel):
    items: list[ExamResponse]
    total: int
    limit: int
    offset: int
