"""Subject-scoped Class CRUD endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.classroom import (
    ClassCreateRequest,
    ClassListResponse,
    ClassResponse,
    ClassUpdateRequest,
)
from app.db.dependencies import get_session
from app.modules.auth.dependencies import WorkspaceReadUser, WorkspaceWriteUser
from app.modules.classes.service import (
    ClassNotFoundError,
    ClassRecord,
    InvalidClassScopeError,
    create_class,
    delete_class,
    get_class,
    list_classes,
    update_class,
)
from app.modules.workspaces.service import WorkspaceNotFoundError

router = APIRouter()
SessionDependency = Annotated[AsyncSession, Depends(get_session)]


def response_model(record: ClassRecord) -> ClassResponse:
    classroom = record.classroom
    return ClassResponse(
        id=classroom.id,
        subject_id=classroom.workspace_id,
        owner_id=classroom.owner_id,
        name=classroom.name,
        description=classroom.description,
        exam_scope=classroom.exam_scope,
        exam_ids=record.exam_ids,
        created_at=classroom.created_at,
        updated_at=classroom.updated_at,
    )


def invalid_scope(exc: InvalidClassScopeError) -> HTTPException:
    return HTTPException(status_code=422, detail=str(exc))


@router.post("/subjects/{subject_id}/classes", status_code=status.HTTP_201_CREATED)
async def create(
    subject_id: UUID,
    payload: ClassCreateRequest,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
) -> ClassResponse:
    try:
        async with session.begin():
            record = await create_class(session, current_user.id, subject_id, payload)
    except WorkspaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Subject not found") from exc
    except InvalidClassScopeError as exc:
        raise invalid_scope(exc) from exc
    return response_model(record)


@router.get("/subjects/{subject_id}/classes")
async def list_for_subject(
    subject_id: UUID,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ClassListResponse:
    try:
        page = await list_classes(session, current_user.id, subject_id, limit=limit, offset=offset)
    except WorkspaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Subject not found") from exc
    return ClassListResponse(
        items=[response_model(item) for item in page.items],
        total=page.total,
        limit=limit,
        offset=offset,
    )


@router.get("/classes/{class_id}")
async def read(
    class_id: UUID,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
) -> ClassResponse:
    try:
        record = await get_class(session, current_user.id, class_id)
    except ClassNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Class not found") from exc
    return response_model(record)


@router.patch("/classes/{class_id}")
async def update(
    class_id: UUID,
    payload: ClassUpdateRequest,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
) -> ClassResponse:
    if not payload.model_fields_set:
        raise HTTPException(status_code=422, detail="At least one field is required")
    try:
        async with session.begin():
            record = await update_class(session, current_user.id, class_id, payload)
    except ClassNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Class not found") from exc
    except InvalidClassScopeError as exc:
        raise invalid_scope(exc) from exc
    return response_model(record)


@router.delete("/classes/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    class_id: UUID,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
    response: Response,
) -> None:
    try:
        async with session.begin():
            await delete_class(session, current_user.id, class_id)
    except ClassNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Class not found") from exc
    response.status_code = status.HTTP_204_NO_CONTENT
