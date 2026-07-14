"""Workspace CRUD endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.workspace import (
    WorkspaceCreateRequest,
    WorkspaceListResponse,
    WorkspaceResponse,
    WorkspaceUpdateRequest,
)
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

router = APIRouter(prefix="/workspaces")
SessionDependency = Annotated[AsyncSession, Depends(get_session)]


def not_found() -> HTTPException:
    """Hide the distinction between absent and inaccessible resources."""
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create(
    payload: WorkspaceCreateRequest,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
) -> WorkspaceResponse:
    """Create a private-by-default workspace."""
    async with session.begin():
        workspace = await create_workspace(session, current_user.id, payload)
    return WorkspaceResponse.model_validate(workspace)


@router.get("")
async def list_accessible(
    current_user: WorkspaceReadUser,
    session: SessionDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> WorkspaceListResponse:
    """Return offset-paginated workspaces accessible to the current user."""
    page = await list_workspaces(session, current_user.id, limit=limit, offset=offset)
    return WorkspaceListResponse(
        items=[WorkspaceResponse.model_validate(item) for item in page.items],
        total=page.total,
        limit=limit,
        offset=offset,
    )


@router.get("/{workspace_id}")
async def read(
    workspace_id: UUID,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
) -> WorkspaceResponse:
    """Return one accessible workspace."""
    try:
        workspace = await get_workspace(session, current_user.id, workspace_id)
    except WorkspaceNotFoundError as exc:
        raise not_found() from exc
    return WorkspaceResponse.model_validate(workspace)


@router.patch("/{workspace_id}")
async def update(
    workspace_id: UUID,
    payload: WorkspaceUpdateRequest,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
) -> WorkspaceResponse:
    """Update an owned workspace."""
    if not payload.model_fields_set:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one field is required",
        )
    try:
        async with session.begin():
            workspace = await update_workspace(session, current_user.id, workspace_id, payload)
    except WorkspaceNotFoundError as exc:
        raise not_found() from exc
    return WorkspaceResponse.model_validate(workspace)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    workspace_id: UUID,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
    response: Response,
) -> None:
    """Delete an owned workspace."""
    try:
        async with session.begin():
            await delete_workspace(session, current_user.id, workspace_id)
    except WorkspaceNotFoundError as exc:
        raise not_found() from exc
    response.status_code = status.HTTP_204_NO_CONTENT
