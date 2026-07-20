"""Artifact ownership, upload, lifecycle, and summary services."""

from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

from anyio import to_thread
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.artifact import ArtifactUploadRequest
from app.core.config import Settings
from app.db.models.artifact import (
    Artifact,
    ArtifactChunk,
    ArtifactPage,
    ArtifactProcessingJob,
    ProcessingStatus,
    UploadStatus,
)
from app.integrations.storage import StorageProtocol
from app.modules.exams.service import ExamNotFoundError, get_owned_exam

ALLOWED_TYPES = {
    "application/pdf": {".pdf"},
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {".docx"},
    "text/plain": {".txt"},
}


class ArtifactNotFoundError(LookupError):
    pass


class ArtifactValidationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class ArtifactStateError(ValueError):
    pass


async def get_owned_artifact(session: AsyncSession, owner_id: UUID, artifact_id: UUID) -> Artifact:
    artifact = await session.scalar(
        select(Artifact).where(Artifact.id == artifact_id, Artifact.owner_id == owner_id)
    )
    if artifact is None:
        raise ArtifactNotFoundError
    try:
        await get_owned_exam(session, owner_id, artifact.exam_id)
    except ExamNotFoundError as exc:
        raise ArtifactNotFoundError from exc
    return artifact


def validate_upload(payload: ArtifactUploadRequest, settings: Settings) -> None:
    if payload.size_bytes > settings.artifact_max_size_bytes:
        raise ArtifactValidationError("artifact_too_large", "File exceeds the 25 MiB P1 limit.")
    allowed_extensions = ALLOWED_TYPES.get(payload.media_type)
    if not allowed_extensions or Path(payload.filename).suffix.lower() not in allowed_extensions:
        raise ArtifactValidationError(
            "artifact_type_not_allowed", "P1 supports PDF, DOCX, and TXT files only."
        )


async def create_upload(
    session: AsyncSession,
    storage: StorageProtocol,
    settings: Settings,
    owner_id: UUID,
    exam_id: UUID,
    payload: ArtifactUploadRequest,
) -> tuple[Artifact, str, datetime]:
    await get_owned_exam(session, owner_id, exam_id)
    validate_upload(payload, settings)
    count = await session.scalar(
        select(func.count()).select_from(Artifact).where(Artifact.exam_id == exam_id)
    )
    if int(count or 0) >= settings.artifact_max_files_per_exam:
        raise ArtifactValidationError(
            "artifact_limit_reached", "This Exam already has the maximum number of files."
        )
    artifact_id = uuid4()
    artifact = Artifact(
        id=artifact_id,
        exam_id=exam_id,
        owner_id=owner_id,
        kind=payload.kind,
        original_name=payload.filename,
        declared_media_type=payload.media_type,
        size_bytes=payload.size_bytes,
        sha256=payload.sha256.lower() if payload.sha256 else None,
        storage_key=f"users/{owner_id}/exams/{exam_id}/artifacts/{artifact_id}/original",
    )
    session.add(artifact)
    await session.flush()
    url = await to_thread.run_sync(
        storage.presign_put,
        artifact.storage_key,
        artifact.declared_media_type,
        settings.artifact_upload_expiry_seconds,
    )
    expires_at = datetime.now(UTC) + timedelta(seconds=settings.artifact_upload_expiry_seconds)
    return artifact, url, expires_at


async def complete_upload(
    session: AsyncSession,
    storage: StorageProtocol,
    owner_id: UUID,
    artifact_id: UUID,
) -> tuple[Artifact, ArtifactProcessingJob]:
    artifact = await get_owned_artifact(session, owner_id, artifact_id)
    if artifact.upload_status == UploadStatus.UPLOADED:
        job = await session.scalar(
            select(ArtifactProcessingJob)
            .where(ArtifactProcessingJob.artifact_id == artifact.id)
            .order_by(ArtifactProcessingJob.created_at.desc())
        )
        if job is None:
            raise ArtifactStateError("Uploaded artifact has no processing job")
        return artifact, job
    if artifact.upload_status != UploadStatus.PENDING:
        raise ArtifactStateError("Upload is no longer active")
    try:
        metadata = await to_thread.run_sync(storage.head, artifact.storage_key)
    except Exception as exc:
        raise ArtifactValidationError(
            "artifact_object_missing", "Uploaded object was not found."
        ) from exc
    if metadata.size_bytes != artifact.size_bytes:
        raise ArtifactValidationError(
            "artifact_metadata_mismatch", "Uploaded file size does not match the upload request."
        )
    if metadata.content_type.split(";", 1)[0].lower() != artifact.declared_media_type.lower():
        raise ArtifactValidationError(
            "artifact_metadata_mismatch", "Uploaded content type does not match the upload request."
        )
    now = datetime.now(UTC)
    artifact.upload_status = UploadStatus.UPLOADED
    artifact.processing_status = ProcessingStatus.QUEUED
    artifact.storage_etag = metadata.etag
    artifact.uploaded_at = now
    job = ArtifactProcessingJob(
        artifact_id=artifact.id,
        idempotency_key=f"{artifact.id}:ingest:v1",
    )
    session.add(job)
    from app.modules.blueprints.service import mark_exam_blueprints_stale

    await mark_exam_blueprints_stale(session, artifact.exam_id)
    await session.flush()
    return artifact, job


async def list_artifacts(session: AsyncSession, owner_id: UUID, exam_id: UUID) -> list[Artifact]:
    await get_owned_exam(session, owner_id, exam_id)
    result = await session.scalars(
        select(Artifact)
        .where(Artifact.exam_id == exam_id, Artifact.owner_id == owner_id)
        .order_by(Artifact.created_at.desc())
    )
    return list(result.all())


async def retry_artifact(
    session: AsyncSession, owner_id: UUID, artifact_id: UUID
) -> tuple[Artifact, ArtifactProcessingJob]:
    artifact = await get_owned_artifact(session, owner_id, artifact_id)
    if artifact.upload_status != UploadStatus.UPLOADED:
        raise ArtifactStateError("Artifact upload is incomplete")
    if artifact.processing_status not in {
        ProcessingStatus.FAILED,
        ProcessingStatus.READY,
        ProcessingStatus.QUEUED,
    }:
        raise ArtifactStateError("Artifact cannot be retried in its current state")
    artifact.processing_status = ProcessingStatus.QUEUED
    artifact.failure_code = None
    artifact.failure_message = None
    job = ArtifactProcessingJob(
        artifact_id=artifact.id,
        idempotency_key=f"{artifact.id}:ingest:v1:retry:{uuid4()}",
    )
    session.add(job)
    await session.flush()
    return artifact, job


async def delete_artifact(
    session: AsyncSession,
    storage: StorageProtocol,
    owner_id: UUID,
    artifact_id: UUID,
) -> None:
    artifact = await get_owned_artifact(session, owner_id, artifact_id)
    artifact.processing_status = ProcessingStatus.DELETING
    from app.modules.blueprints.service import mark_exam_blueprints_stale

    await mark_exam_blueprints_stale(session, artifact.exam_id)
    await session.flush()
    await to_thread.run_sync(storage.delete, artifact.storage_key)
    await session.delete(artifact)
    await session.flush()


async def content_summary(
    session: AsyncSession, owner_id: UUID, artifact_id: UUID
) -> tuple[int, int, int, str]:
    artifact = await get_owned_artifact(session, owner_id, artifact_id)
    if artifact.processing_status != ProcessingStatus.READY:
        raise ArtifactStateError("Artifact is not ready")
    chunk_count = int(
        await session.scalar(
            select(func.count())
            .select_from(ArtifactChunk)
            .where(ArtifactChunk.artifact_id == artifact.id)
        )
        or 0
    )
    first_page = await session.scalar(
        select(ArtifactPage)
        .where(ArtifactPage.artifact_id == artifact.id)
        .order_by(ArtifactPage.page_number)
    )
    preview = (first_page.text[:500] if first_page else "").strip()
    return artifact.page_count or 0, artifact.character_count or 0, chunk_count, preview


async def cancel_pending_upload(
    session: AsyncSession, storage: StorageProtocol, owner_id: UUID, artifact_id: UUID
) -> None:
    artifact = await get_owned_artifact(session, owner_id, artifact_id)
    if artifact.upload_status == UploadStatus.UPLOADED:
        raise ArtifactStateError("Completed uploads must be deleted instead")
    artifact.upload_status = UploadStatus.CANCELLED
    await to_thread.run_sync(storage.delete, artifact.storage_key)
    await session.execute(delete(Artifact).where(Artifact.id == artifact.id))
