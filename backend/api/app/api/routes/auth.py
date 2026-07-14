"""Registration and token lifecycle endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.auth import (
    RefreshTokenRequest,
    RegisterRequest,
    TokenPairResponse,
    UserResponse,
)
from app.core.config import Settings
from app.core.dependencies import get_runtime_settings
from app.db.dependencies import get_session
from app.modules.auth.service import (
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    authenticate_user,
    issue_tokens,
    register_user,
    revoke_refresh_token,
    rotate_refresh_token,
)

router = APIRouter(prefix="/auth")
SessionDependency = Annotated[AsyncSession, Depends(get_session)]
SettingsDependency = Annotated[Settings, Depends(get_runtime_settings)]
LoginFormDependency = Annotated[OAuth2PasswordRequestForm, Depends()]


def token_response(access_token: str, refresh_token: str, expires_in: int) -> TokenPairResponse:
    """Map internal credentials to the public API contract."""
    return TokenPairResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, session: SessionDependency) -> UserResponse:
    """Create a new platform account."""
    try:
        async with session.begin():
            user = await register_user(session, payload)
    except (EmailAlreadyRegisteredError, IntegrityError) as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        ) from exc
    return UserResponse.model_validate(user)


@router.post("/login")
async def login(
    form: LoginFormDependency,
    session: SessionDependency,
    settings: SettingsDependency,
) -> TokenPairResponse:
    """Exchange email/password credentials for a new token pair."""
    try:
        async with session.begin():
            user = await authenticate_user(session, form.username, form.password)
            issued = await issue_tokens(session, user, settings)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return token_response(issued.access_token, issued.refresh_token, issued.expires_in)


@router.post("/refresh")
async def refresh(
    payload: RefreshTokenRequest,
    session: SessionDependency,
    settings: SettingsDependency,
) -> TokenPairResponse:
    """Rotate an active refresh token and return a new token pair."""
    try:
        async with session.begin():
            issued = await rotate_refresh_token(session, payload.refresh_token, settings)
    except InvalidRefreshTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        ) from exc
    return token_response(issued.access_token, issued.refresh_token, issued.expires_in)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    payload: RefreshTokenRequest,
    session: SessionDependency,
    response: Response,
) -> None:
    """Idempotently revoke a refresh token."""
    async with session.begin():
        await revoke_refresh_token(session, payload.refresh_token)
    response.status_code = status.HTTP_204_NO_CONTENT
