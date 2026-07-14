"""Exam CRUD schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models.exam import ExamStatus


class ExamCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    exam_type: str | None = Field(default=None, max_length=120)
    language: str = Field(default="en", min_length=2, max_length=32)
    target_date: date | None = None

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


class ExamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    subject_id: UUID = Field(validation_alias="workspace_id")
    title: str
    description: str | None
    exam_type: str | None
    language: str
    target_date: date | None
    status: ExamStatus
    created_at: datetime
    updated_at: datetime


class ExamListResponse(BaseModel):
    items: list[ExamResponse]
    total: int
    limit: int
    offset: int
