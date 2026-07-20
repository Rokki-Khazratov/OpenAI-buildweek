"""AI blueprint extraction, review, and approval endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.blueprint import (
    BlueprintExtractionRequest,
    BlueprintResponse,
    BlueprintUpdateRequest,
)
from app.db.dependencies import get_session
from app.db.models.blueprint import ExamBlueprint
from app.modules.auth.dependencies import WorkspaceWriteUser
from app.modules.blueprints.service import (
    BlueprintNotFoundError,
    BlueprintStateError,
    approve_blueprint,
    extract_blueprint,
    get_current_blueprint,
    get_owned_blueprint,
    update_blueprint_draft,
)
from app.modules.exams.service import ExamNotFoundError

router = APIRouter()
SessionDependency = Annotated[AsyncSession, Depends(get_session)]


def response(record: ExamBlueprint) -> BlueprintResponse:
    return BlueprintResponse(
        id=record.id,
        exam_id=record.exam_id,
        version=record.version,
        status=record.status,
        content=record.content,
        source_artifact_ids=record.source_artifact_ids,
        provider=record.provider,
        model=record.model,
        prompt_version=record.prompt_version,
        schema_version=record.schema_version,
        overall_confidence=record.overall_confidence,
        validation_errors=record.validation_errors,
        error_code=record.error_code,
        error_message=record.error_message,
        approved_at=record.approved_at,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.post(
    "/exams/{exam_id}/blueprints/extractions",
    status_code=status.HTTP_201_CREATED,
)
async def create_extraction(
    exam_id: UUID,
    payload: BlueprintExtractionRequest,
    request: Request,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> BlueprintResponse:
    try:
        record = await extract_blueprint(
            session,
            current_user.id,
            exam_id,
            request.app.state.settings,
            artifact_ids=payload.artifact_ids,
            idempotency_key=idempotency_key,
        )
    except ExamNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Exam not found") from exc
    except BlueprintStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return response(record)


@router.get("/exams/{exam_id}/blueprints/current")
async def read_current(
    exam_id: UUID,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
) -> BlueprintResponse:
    try:
        return response(await get_current_blueprint(session, current_user.id, exam_id))
    except (BlueprintNotFoundError, ExamNotFoundError) as exc:
        raise HTTPException(status_code=404, detail="Blueprint not found") from exc


@router.patch("/blueprints/{blueprint_id}")
async def update_draft(
    blueprint_id: UUID,
    payload: BlueprintUpdateRequest,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
) -> BlueprintResponse:
    try:
        async with session.begin():
            record = await update_blueprint_draft(
                session, current_user.id, blueprint_id, payload.content
            )
        await session.refresh(record)
    except BlueprintNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Blueprint not found") from exc
    except BlueprintStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return response(record)


@router.post("/blueprints/{blueprint_id}/approve")
async def approve(
    blueprint_id: UUID,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
) -> BlueprintResponse:
    try:
        async with session.begin():
            record = await approve_blueprint(session, current_user.id, blueprint_id)
        await session.refresh(record)
    except BlueprintNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Blueprint not found") from exc
    except BlueprintStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return response(record)


@router.post("/blueprints/{blueprint_id}/retry", status_code=status.HTTP_201_CREATED)
async def retry(
    blueprint_id: UUID,
    request: Request,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> BlueprintResponse:
    try:
        record = await get_owned_blueprint(session, current_user.id, blueprint_id)
    except BlueprintNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Blueprint not found") from exc
    try:
        next_record = await extract_blueprint(
            session,
            current_user.id,
            record.exam_id,
            request.app.state.settings,
            artifact_ids=[UUID(item) for item in record.source_artifact_ids],
            idempotency_key=idempotency_key,
        )
    except BlueprintStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return response(next_record)
