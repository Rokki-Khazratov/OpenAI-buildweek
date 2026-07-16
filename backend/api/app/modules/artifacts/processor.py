"""Restart-safe artifact job processor."""

from datetime import UTC, datetime
from uuid import UUID

from anyio import to_thread
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models.artifact import (
    Artifact,
    ArtifactChunk,
    ArtifactPage,
    ArtifactProcessingJob,
    JobStatus,
    ProcessingStatus,
)
from app.integrations.storage import StorageProtocol
from app.modules.artifacts.parsing import (
    CHUNKER_VERSION,
    PARSER_VERSION,
    DocumentValidationError,
    chunk_document,
    parse_document,
)


class TransientProcessingError(RuntimeError):
    pass


async def record_transient_failure(
    session: AsyncSession,
    job_id: UUID,
    exc: TransientProcessingError,
) -> None:
    """Persist retry-visible failure state after the processing transaction rolled back."""
    job = await session.scalar(
        select(ArtifactProcessingJob).where(ArtifactProcessingJob.id == job_id).with_for_update()
    )
    if job is None:
        return
    artifact = await session.scalar(
        select(Artifact).where(Artifact.id == job.artifact_id).with_for_update()
    )
    now = datetime.now(UTC)
    job.status = JobStatus.FAILED
    job.finished_at = now
    job.error_code = "artifact_processing_unavailable"
    job.error_detail = type(exc.__cause__).__name__ if exc.__cause__ else type(exc).__name__
    if artifact is not None:
        artifact.processing_status = ProcessingStatus.FAILED
        artifact.failure_code = "artifact_processing_unavailable"
        artifact.failure_message = "Processing is temporarily unavailable. Retry this file."
    await session.flush()


async def process_job(
    session: AsyncSession,
    storage: StorageProtocol,
    settings: Settings,
    job_id: UUID,
    *,
    worker_id: str = "worker",
) -> None:
    job = await session.scalar(
        select(ArtifactProcessingJob).where(ArtifactProcessingJob.id == job_id).with_for_update()
    )
    if job is None or job.status == JobStatus.SUCCEEDED:
        return
    artifact = await session.scalar(
        select(Artifact).where(Artifact.id == job.artifact_id).with_for_update()
    )
    if artifact is None:
        return
    job.status = JobStatus.RUNNING
    job.started_at = datetime.now(UTC)
    job.worker_id = worker_id
    job.attempt_count += 1
    artifact.processing_status = ProcessingStatus.PROCESSING
    artifact.failure_code = None
    artifact.failure_message = None
    await session.flush()

    try:
        data = await to_thread.run_sync(storage.get_bytes, artifact.storage_key)
        document = parse_document(
            data,
            artifact.declared_media_type,
            max_pages=settings.artifact_max_pages,
            max_characters=settings.artifact_max_characters,
        )
        chunks = chunk_document(document)
        await session.execute(delete(ArtifactChunk).where(ArtifactChunk.artifact_id == artifact.id))
        await session.execute(delete(ArtifactPage).where(ArtifactPage.artifact_id == artifact.id))
        page_by_number: dict[int, ArtifactPage] = {}
        for page in document.pages:
            item = ArtifactPage(
                artifact_id=artifact.id,
                parser_version=PARSER_VERSION,
                page_number=page.number,
                text=page.text,
                heading=page.heading,
            )
            session.add(item)
            page_by_number[page.number] = item
        await session.flush()
        for chunk in chunks:
            page_row = page_by_number[chunk.page_number]
            session.add(
                ArtifactChunk(
                    artifact_id=artifact.id,
                    page_id=page_row.id,
                    parser_version=PARSER_VERSION,
                    chunker_version=CHUNKER_VERSION,
                    chunk_index=chunk.index,
                    text=chunk.text,
                    token_count=max(1, len(chunk.text.split())),
                    start_offset=chunk.start_offset,
                    end_offset=chunk.end_offset,
                    attributes={"page_number": chunk.page_number},
                )
            )
        now = datetime.now(UTC)
        artifact.detected_media_type = document.media_type
        artifact.parser_version = PARSER_VERSION
        artifact.page_count = len(document.pages)
        artifact.character_count = sum(len(page.text) for page in document.pages)
        artifact.processing_status = ProcessingStatus.READY
        artifact.processed_at = now
        job.status = JobStatus.SUCCEEDED
        job.finished_at = now
        job.error_code = None
        job.error_detail = None
        await session.flush()
    except DocumentValidationError as exc:
        now = datetime.now(UTC)
        artifact.processing_status = ProcessingStatus.FAILED
        artifact.failure_code = exc.code
        artifact.failure_message = str(exc)
        job.status = JobStatus.FAILED
        job.finished_at = now
        job.error_code = exc.code
        job.error_detail = str(exc)
        await session.flush()
    except Exception as exc:
        raise TransientProcessingError from exc
