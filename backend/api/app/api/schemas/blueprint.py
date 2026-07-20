"""Blueprint extraction, review, and approval contracts."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.ai.schemas import BlueprintDraft
from app.db.models.blueprint import BlueprintStatus


class BlueprintExtractionRequest(BaseModel):
    artifact_ids: list[UUID] | None = Field(default=None, max_length=30)


class BlueprintUpdateRequest(BaseModel):
    content: BlueprintDraft


class BlueprintResponse(BaseModel):
    id: UUID
    exam_id: UUID
    version: int
    status: BlueprintStatus
    content: dict[str, Any]
    source_artifact_ids: list[str]
    provider: str
    model: str
    prompt_version: str
    schema_version: str
    overall_confidence: float
    validation_errors: list[dict[str, Any]]
    error_code: str | None
    error_message: str | None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime
