"""Privacy-safe Exam Library contracts."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PublicationUpsertRequest(BaseModel):
    rights_note: str = Field(default="Shared for private study use.", max_length=2000)


class LibraryPublicationResponse(BaseModel):
    id: UUID
    source_exam_id: UUID | None = None
    title: str
    description: str | None
    subject_title: str
    university: str | None
    course_code: str | None
    exam_type: str | None
    language: str
    blueprint: dict[str, object]
    rules: dict[str, object]
    scenario: dict[str, object]
    source_configuration_version: int
    blueprint_version: int
    rights_note: str
    publisher_name: str
    clone_count: int
    is_published: bool
    published_at: datetime


class LibraryPublicationListResponse(BaseModel):
    items: list[LibraryPublicationResponse]
    total: int
    limit: int
    offset: int


class LibraryCloneResponse(BaseModel):
    publication_id: UUID
    subject_id: UUID
    exam_id: UUID
    already_cloned: bool

