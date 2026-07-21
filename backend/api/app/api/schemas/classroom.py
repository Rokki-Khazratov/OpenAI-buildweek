"""Class CRUD schemas."""

from datetime import datetime
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
    percentage: float
    support: int


class ClassParticipantMetric(BaseModel):
    user_id: UUID
    display_name: str
    role: ClassMemberRole
    attempts: int
    average_percentage: float | None
    readiness_percentage: float | None
    last_activity_at: datetime | None
    weak_skill_ids: list[str]


class ClassDashboardResponse(BaseModel):
    class_id: UUID
    exam_id: UUID | None
    member_count: int
    active_learners: int
    total_attempts: int
    average_percentage: float | None
    readiness_percentage: float | None
    readiness_coverage: float
    pass_rate: float | None
    weak_skills: list[ClassSkillMetric]
    participants: list[ClassParticipantMetric]
