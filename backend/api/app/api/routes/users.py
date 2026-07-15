"""Current-user profile endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.auth import UserResponse, UserUpdateRequest
from app.db.dependencies import get_session
from app.db.models.user import User
from app.modules.auth.dependencies import ProfileReadUser, ProfileWriteUser

router = APIRouter()
SessionDependency = Annotated[AsyncSession, Depends(get_session)]


@router.get("/me")
async def read_me(current_user: ProfileReadUser, session: SessionDependency) -> UserResponse:
    """Return the current account without sensitive fields."""
    user = await session.get(User, current_user.id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse.model_validate(user)


@router.patch("/me")
async def update_me(
    payload: UserUpdateRequest,
    current_user: ProfileWriteUser,
    session: SessionDependency,
) -> UserResponse:
    """Update mutable fields on the current account."""
    async with session.begin():
        user = await session.get(User, current_user.id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        user.display_name = payload.display_name.strip()
        await session.flush()
        await session.refresh(user)
    return UserResponse.model_validate(user)
