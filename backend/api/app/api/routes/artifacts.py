"""Private Exam artifact upload and processing endpoints."""

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.artifact import (
    ArtifactContentSummary,
    ArtifactDownloadResponse,
    ArtifactListResponse,
    ArtifactResponse,
    ArtifactUploadRequest,
    ArtifactUploadResponse,
    PresignedUpload,
)
from app.core.config import Settings
from app.core.dependencies import get_runtime_settings, get_storage
from app.db.dependencies import get_session
from app.integrations.storage import StorageProtocol
from app.modules.artifacts.service import (
    ArtifactNotFoundError,
    ArtifactStateError,
    ArtifactValidationError,
    complete_upload,
    content_summary,
    create_upload,
    delete_artifact,
    get_owned_artifact,
    list_artifacts,
    retry_artifact,
)
from app.modules.artifacts.tasks import dispatch_job
from app.modules.auth.dependencies import WorkspaceReadUser, WorkspaceWriteUser
from app.modules.exams.service import ExamNotFoundError

router = APIRouter()
SessionDependency = Annotated[AsyncSession, Depends(get_session)]
StorageDependency = Annotated[StorageProtocol, Depends(get_storage)]
SettingsDependency = Annotated[Settings, Depends(get_runtime_settings)]


def artifact_not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Artifact not found")


def artifact_error(exc: ArtifactValidationError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={"code": exc.code, "message": str(exc)},
    )


def best_effort_dispatch(job_id: UUID, settings: Settings) -> None:
    if not settings.artifact_dispatch_jobs:
        return
    try:
        dispatch_job(job_id)
    except Exception:
        # PostgreSQL remains authoritative. Manual retry or a reconciliation task can redispatch.
        return


@router.post(
    "/exams/{exam_id}/artifacts/uploads",
    status_code=status.HTTP_201_CREATED,
)
async def start_upload(
    exam_id: UUID,
    payload: ArtifactUploadRequest,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
    storage: StorageDependency,
    settings: SettingsDependency,
) -> ArtifactUploadResponse:
    try:
        async with session.begin():
            artifact, url, expires_at = await create_upload(
                session, storage, settings, current_user.id, exam_id, payload
            )
    except ExamNotFoundError as exc:
        raise artifact_not_found() from exc
    except ArtifactValidationError as exc:
        raise artifact_error(exc) from exc
    return ArtifactUploadResponse(
        artifact=ArtifactResponse.model_validate(artifact),
        upload=PresignedUpload(
            url=url,
            headers={"Content-Type": artifact.declared_media_type},
            expires_at=expires_at,
        ),
    )


@router.post("/artifacts/{artifact_id}/complete")
async def finish_upload(
    artifact_id: UUID,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
    storage: StorageDependency,
    settings: SettingsDependency,
) -> ArtifactResponse:
    try:
        async with session.begin():
            artifact, job = await complete_upload(session, storage, current_user.id, artifact_id)
            await session.refresh(artifact)
            response = ArtifactResponse.model_validate(artifact)
    except ArtifactNotFoundError as exc:
        raise artifact_not_found() from exc
    except ArtifactValidationError as exc:
        raise artifact_error(exc) from exc
    except ArtifactStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    best_effort_dispatch(job.id, settings)
    return response


@router.get("/exams/{exam_id}/artifacts")
async def read_exam_artifacts(
    exam_id: UUID,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
) -> ArtifactListResponse:
    try:
        items = await list_artifacts(session, current_user.id, exam_id)
    except ExamNotFoundError as exc:
        raise artifact_not_found() from exc
    return ArtifactListResponse(
        items=[ArtifactResponse.model_validate(item) for item in items], total=len(items)
    )


@router.get("/artifacts/{artifact_id}")
async def read_artifact(
    artifact_id: UUID,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
) -> ArtifactResponse:
    try:
        artifact = await get_owned_artifact(session, current_user.id, artifact_id)
    except ArtifactNotFoundError as exc:
        raise artifact_not_found() from exc
    return ArtifactResponse.model_validate(artifact)


@router.get("/artifacts/{artifact_id}/download")
async def artifact_download(
    artifact_id: UUID,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
    storage: StorageDependency,
    settings: SettingsDependency,
) -> ArtifactDownloadResponse:
    try:
        artifact = await get_owned_artifact(session, current_user.id, artifact_id)
    except ArtifactNotFoundError as exc:
        raise artifact_not_found() from exc
    expires_at = datetime.now(UTC) + timedelta(seconds=settings.artifact_download_expiry_seconds)
    from anyio import to_thread

    url = await to_thread.run_sync(
        storage.presign_get,
        artifact.storage_key,
        settings.artifact_download_expiry_seconds,
    )
    return ArtifactDownloadResponse(url=url, expires_at=expires_at)


@router.get("/artifacts/{artifact_id}/content-summary")
async def read_content_summary(
    artifact_id: UUID,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
) -> ArtifactContentSummary:
    try:
        pages, characters, chunks, preview = await content_summary(
            session, current_user.id, artifact_id
        )
    except ArtifactNotFoundError as exc:
        raise artifact_not_found() from exc
    except ArtifactStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ArtifactContentSummary(
        page_count=pages,
        character_count=characters,
        chunk_count=chunks,
        preview=preview,
    )


@router.post("/artifacts/{artifact_id}/retry")
async def retry_processing(
    artifact_id: UUID,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
    settings: SettingsDependency,
) -> ArtifactResponse:
    try:
        async with session.begin():
            artifact, job = await retry_artifact(session, current_user.id, artifact_id)
            await session.refresh(artifact)
            response = ArtifactResponse.model_validate(artifact)
    except ArtifactNotFoundError as exc:
        raise artifact_not_found() from exc
    except ArtifactStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    best_effort_dispatch(job.id, settings)
    return response


@router.delete("/artifacts/{artifact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_artifact(
    artifact_id: UUID,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
    storage: StorageDependency,
    response: Response,
) -> None:
    try:
        async with session.begin():
            await delete_artifact(session, storage, current_user.id, artifact_id)
    except ArtifactNotFoundError as exc:
        raise artifact_not_found() from exc
    response.status_code = status.HTTP_204_NO_CONTENT
