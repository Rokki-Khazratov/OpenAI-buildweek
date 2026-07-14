"""User-facing Subject CRUD backed by workspace storage."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.subject import (
    SubjectCreateRequest,
    SubjectListResponse,
    SubjectResponse,
    SubjectUpdateRequest,
)
from app.api.schemas.workspace import WorkspaceCreateRequest, WorkspaceUpdateRequest
from app.db.dependencies import get_session
from app.modules.auth.dependencies import WorkspaceReadUser, WorkspaceWriteUser
from app.modules.workspaces.service import (
    WorkspaceNotFoundError,
    create_workspace,
    delete_workspace,
    get_workspace,
    list_workspaces,
    update_workspace,
)

router = APIRouter(prefix="/subjects")
SessionDependency = Annotated[AsyncSession, Depends(get_session)]


def not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create(
    payload: SubjectCreateRequest,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
) -> SubjectResponse:
    workspace_payload = WorkspaceCreateRequest(subject=None, **payload.model_dump())
    async with session.begin():
        subject = await create_workspace(session, current_user.id, workspace_payload)
    return SubjectResponse.model_validate(subject)


@router.get("")
async def list_accessible(
    current_user: WorkspaceReadUser,
    session: SessionDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SubjectListResponse:
    page = await list_workspaces(session, current_user.id, limit=limit, offset=offset)
    return SubjectListResponse(
        items=[SubjectResponse.model_validate(item) for item in page.items],
        total=page.total,
        limit=limit,
        offset=offset,
    )


@router.get("/{subject_id}")
async def read(
    subject_id: UUID,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
) -> SubjectResponse:
    try:
        subject = await get_workspace(session, current_user.id, subject_id)
    except WorkspaceNotFoundError as exc:
        raise not_found() from exc
    return SubjectResponse.model_validate(subject)


@router.patch("/{subject_id}")
async def update(
    subject_id: UUID,
    payload: SubjectUpdateRequest,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
) -> SubjectResponse:
    if not payload.model_fields_set:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one field is required",
        )
    workspace_payload = WorkspaceUpdateRequest.model_validate(
        payload.model_dump(exclude_unset=True)
    )
    try:
        async with session.begin():
            subject = await update_workspace(
                session, current_user.id, subject_id, workspace_payload
            )
    except WorkspaceNotFoundError as exc:
        raise not_found() from exc
    return SubjectResponse.model_validate(subject)


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    subject_id: UUID,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
    response: Response,
) -> None:
    try:
        async with session.begin():
            await delete_workspace(session, current_user.id, subject_id)
    except WorkspaceNotFoundError as exc:
        raise not_found() from exc
    response.status_code = status.HTTP_204_NO_CONTENT
