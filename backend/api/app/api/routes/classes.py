"""Subject-scoped Class CRUD endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.classroom import (
    ClassCreateRequest,
    ClassDashboardResponse,
    ClassListResponse,
    ClassMemberAddRequest,
    ClassMemberResponse,
    ClassResponse,
    ClassUpdateRequest,
)
from app.db.dependencies import get_session
from app.modules.auth.dependencies import WorkspaceReadUser, WorkspaceWriteUser
from app.modules.classes.service import (
    ClassMemberConflictError,
    ClassMemberNotFoundError,
    ClassNotFoundError,
    ClassRecord,
    InvalidClassScopeError,
    add_class_member,
    class_dashboard,
    create_class,
    delete_class,
    get_class,
    list_class_members,
    list_classes,
    remove_class_member,
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
        member_count=record.member_count,
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


@router.get("/classes/{class_id}/members")
async def members(
    class_id: UUID,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
) -> list[ClassMemberResponse]:
    try:
        return await list_class_members(session, current_user.id, class_id)
    except ClassNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Class not found") from exc


@router.post("/classes/{class_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    class_id: UUID,
    payload: ClassMemberAddRequest,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
) -> ClassMemberResponse:
    try:
        async with session.begin():
            return await add_class_member(session, current_user.id, class_id, str(payload.email))
    except ClassNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Class not found") from exc
    except ClassMemberNotFoundError as exc:
        raise HTTPException(status_code=404, detail="No active account uses that email") from exc
    except ClassMemberConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete("/classes/{class_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    class_id: UUID,
    user_id: UUID,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
    response: Response,
) -> None:
    try:
        async with session.begin():
            await remove_class_member(session, current_user.id, class_id, user_id)
    except ClassNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Class not found") from exc
    except ClassMemberNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Participant not found") from exc
    except ClassMemberConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    response.status_code = status.HTTP_204_NO_CONTENT


@router.get("/classes/{class_id}/dashboard")
async def dashboard(
    class_id: UUID,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
    exam_id: UUID | None = None,
) -> ClassDashboardResponse:
    try:
        return await class_dashboard(session, current_user.id, class_id, exam_id)
    except ClassNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Class not found") from exc
    except InvalidClassScopeError as exc:
        raise invalid_scope(exc) from exc
