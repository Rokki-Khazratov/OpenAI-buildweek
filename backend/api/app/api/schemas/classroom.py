"""Class CRUD schemas."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.db.models.classroom import ClassExamScope, ClassMemberRole


class ClassCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=4000)
    exam_scope: ClassExamScope = ClassExamScope.SUBJECT
    exam_ids: list[UUID] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Name cannot be blank")
        return normalized


class ClassUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=4000)
    exam_scope: ClassExamScope | None = None
    exam_ids: list[UUID] | None = None


class ClassResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    subject_id: UUID
    owner_id: UUID
    name: str
    description: str | None
    exam_scope: ClassExamScope
    exam_ids: list[UUID]
    member_count: int
    created_at: datetime
    updated_at: datetime


class ClassListResponse(BaseModel):
    items: list[ClassResponse]
    total: int
    limit: int
    offset: int


class ClassMemberAddRequest(BaseModel):
    email: EmailStr


class ClassMemberResponse(BaseModel):
    user_id: UUID
    display_name: str
    role: ClassMemberRole
    leaderboard_opt_in: bool
    joined_at: datetime


class ClassSkillMetric(BaseModel):
    skill_id: str
    label: str
    mastery_percentage: float
    confidence: float
    support: int
    evidence_count: int
    signal: Literal["confirmed_gap", "low_evidence", "healthy"]


class ClassDashboardResponse(BaseModel):
    class_id: UUID
    exam_id: UUID | None
    model_version: str
    privacy_threshold: int
    suppressed: bool
    suppression_reason: str | None
    member_count: int
    active_learners: int
    eligible_learners: int
    total_attempts: int
    median_readiness_index: float | None
    readiness_coverage: float
    readiness_confidence_distribution: dict[str, int]
    low_evidence_percentage: float | None
    weak_skills: list[ClassSkillMetric]
    recommended_action: str | None


class CohortAnalyticsEventRequest(BaseModel):
    event_name: Literal[
        "dashboard_viewed",
        "recommendation_accepted",
        "adaptive_mock_started",
        "adaptive_mock_completed",
    ]
    properties: dict[str, str | int | float | bool] = Field(default_factory=dict)


class CohortExperimentSummaryResponse(BaseModel):
    class_id: UUID
    model_version: str
    event_counts: dict[str, int]
    recommendation_acceptance_rate: float | None
    adaptive_completion_rate: float | None
