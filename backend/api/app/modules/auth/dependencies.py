"""Bearer authentication and scope authorization dependencies."""

from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import OAuth2PasswordBearer, SecurityScopes
from sqlalchemy import select

from app.core.config import Settings
from app.core.dependencies import get_runtime_settings
from app.core.security import InvalidAccessTokenError, decode_access_token
from app.db.dependencies import get_database
from app.db.models.user import User
from app.db.session import DatabaseProtocol

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    scopes={
        "profile:read": "Read the current user profile",
        "profile:write": "Update the current user profile",
        "workspace:read": "Read accessible workspaces",
        "workspace:write": "Create and manage owned workspaces",
    },
)


@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    """Small detached identity passed from auth to endpoint handlers."""

    id: UUID
    email: str
    display_name: str
    is_active: bool


def unauthorized(security_scopes: SecurityScopes) -> HTTPException:
    """Build a standards-compatible bearer challenge."""
    authenticate_value = "Bearer"
    if security_scopes.scopes:
        authenticate_value = f'Bearer scope="{security_scopes.scope_str}"'
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": authenticate_value},
    )


async def get_current_user(
    security_scopes: SecurityScopes,
    token: Annotated[str, Depends(oauth2_scheme)],
    database: Annotated[DatabaseProtocol, Depends(get_database)],
    settings: Annotated[Settings, Depends(get_runtime_settings)],
) -> AuthenticatedUser:
    """Validate bearer claims, scopes, and the current account state."""
    try:
        claims = decode_access_token(token, settings)
    except InvalidAccessTokenError as exc:
        raise unauthorized(security_scopes) from exc

    if not set(security_scopes.scopes).issubset(claims.scopes):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    async with database.session() as session:
        user = await session.scalar(select(User).where(User.id == claims.user_id))

    if user is None or not user.is_active:
        raise unauthorized(security_scopes)
    return AuthenticatedUser(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        is_active=user.is_active,
    )


ProfileReadUser = Annotated[
    AuthenticatedUser,
    Security(get_current_user, scopes=["profile:read"]),
]
ProfileWriteUser = Annotated[
    AuthenticatedUser,
    Security(get_current_user, scopes=["profile:write"]),
]
WorkspaceReadUser = Annotated[
    AuthenticatedUser,
    Security(get_current_user, scopes=["workspace:read"]),
]
WorkspaceWriteUser = Annotated[
    AuthenticatedUser,
    Security(get_current_user, scopes=["workspace:write"]),
]
