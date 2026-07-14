"""User-facing subject schemas backed by the workspace aggregate."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models.workspace import WorkspaceVisibility


class SubjectCreateRequest(BaseModel):
    """Create a subject that may contain multiple exams."""

    title: str = Field(min_length=1, max_length=200)
    university: str | None = Field(default=None, max_length=200)
    course_code: str | None = Field(default=None, max_length=64)
    visibility: WorkspaceVisibility = WorkspaceVisibility.PRIVATE
    target_exam_date: date | None = None

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Title cannot be blank")
        return normalized

    @field_validator("university", "course_code")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class SubjectUpdateRequest(BaseModel):
    """Mutable subject metadata."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    university: str | None = Field(default=None, max_length=200)
    course_code: str | None = Field(default=None, max_length=64)
    visibility: WorkspaceVisibility | None = None
    target_exam_date: date | None = None

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("Title cannot be null")
        normalized = value.strip()
        if not normalized:
            raise ValueError("Title cannot be blank")
        return normalized

    @field_validator("university", "course_code")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class SubjectResponse(BaseModel):
    """Public subject representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: UUID
    title: str
    university: str | None
    course_code: str | None
    visibility: WorkspaceVisibility
    target_exam_date: date | None
    created_at: datetime
    updated_at: datetime


class SubjectListResponse(BaseModel):
    """Offset-paginated subjects."""

    items: list[SubjectResponse]
    total: int
    limit: int
    offset: int
