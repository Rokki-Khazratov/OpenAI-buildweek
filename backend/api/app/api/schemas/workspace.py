"""Workspace CRUD API schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models.workspace import WorkspaceVisibility


class WorkspaceCreateRequest(BaseModel):
    """Create a student-owned course workspace."""

    title: str = Field(min_length=1, max_length=200)
    university: str | None = Field(default=None, max_length=200)
    course_code: str | None = Field(default=None, max_length=64)
    subject: str | None = Field(default=None, max_length=200)
    visibility: WorkspaceVisibility = WorkspaceVisibility.PRIVATE
    target_exam_date: date | None = None

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Title cannot be blank")
        return normalized

    @field_validator("university", "course_code", "subject")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class WorkspaceUpdateRequest(BaseModel):
    """Mutable workspace metadata."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    university: str | None = Field(default=None, max_length=200)
    course_code: str | None = Field(default=None, max_length=64)
    subject: str | None = Field(default=None, max_length=200)
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

    @field_validator("university", "course_code", "subject")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class WorkspaceResponse(BaseModel):
    """Workspace representation visible to an authorized member."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: UUID
    title: str
    university: str | None
    course_code: str | None
    subject: str | None
    visibility: WorkspaceVisibility
    target_exam_date: date | None
    created_at: datetime
    updated_at: datetime


class WorkspaceListResponse(BaseModel):
    """Offset-paginated workspace collection."""

    items: list[WorkspaceResponse]
    total: int
    limit: int
    offset: int
