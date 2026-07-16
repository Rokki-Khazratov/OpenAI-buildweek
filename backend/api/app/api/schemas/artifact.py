"""Artifact upload and processing API schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models.artifact import ArtifactKind, ProcessingStatus, UploadStatus


class ArtifactUploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    kind: ArtifactKind
    media_type: str = Field(min_length=3, max_length=160)
    size_bytes: int = Field(ge=1)
    sha256: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{64}$")

    @field_validator("filename")
    @classmethod
    def safe_filename(cls, value: str) -> str:
        normalized = value.replace("\\", "/").split("/")[-1].strip()
        if not normalized or normalized in {".", ".."}:
            raise ValueError("Invalid filename")
        return normalized


class PresignedUpload(BaseModel):
    method: str = "PUT"
    url: str
    headers: dict[str, str]
    expires_at: datetime


class ArtifactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    exam_id: UUID
    kind: ArtifactKind
    original_name: str
    declared_media_type: str
    detected_media_type: str | None
    size_bytes: int
    upload_status: UploadStatus
    processing_status: ProcessingStatus
    failure_code: str | None
    failure_message: str | None
    parser_version: str | None
    page_count: int | None
    character_count: int | None
    uploaded_at: datetime | None
    processed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ArtifactUploadResponse(BaseModel):
    artifact: ArtifactResponse
    upload: PresignedUpload


class ArtifactListResponse(BaseModel):
    items: list[ArtifactResponse]
    total: int


class ArtifactDownloadResponse(BaseModel):
    url: str
    expires_at: datetime


class ArtifactContentSummary(BaseModel):
    page_count: int
    character_count: int
    chunk_count: int
    preview: str
