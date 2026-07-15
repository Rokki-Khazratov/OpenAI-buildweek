"""Authentication application service."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from anyio import to_thread
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.auth import RegisterRequest
from app.core.config import Settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.db.models.auth import RefreshToken
from app.db.models.user import User


class EmailAlreadyRegisteredError(ValueError):
    """Raised when an email is already associated with an account."""


class InvalidCredentialsError(ValueError):
    """Raised when login credentials cannot be authenticated."""


class InvalidRefreshTokenError(ValueError):
    """Raised when a refresh token is unknown, revoked, or expired."""


@dataclass(frozen=True, slots=True)
class IssuedTokens:
    """Credentials produced inside an authentication transaction."""

    access_token: str
    refresh_token: str
    expires_in: int


def normalize_email(email: str) -> str:
    """Use one canonical representation for account lookup and uniqueness."""
    return email.strip().casefold()


async def register_user(session: AsyncSession, payload: RegisterRequest) -> User:
    """Create an inactive-independent user record inside the caller's transaction."""
    email = normalize_email(str(payload.email))
    existing_id = await session.scalar(select(User.id).where(User.email == email))
    if existing_id is not None:
        raise EmailAlreadyRegisteredError

    password_digest = await to_thread.run_sync(hash_password, payload.password)
    user = User(
        email=email,
        password_hash=password_digest,
        display_name=payload.display_name.strip(),
    )
    session.add(user)
    await session.flush()
    return user


async def authenticate_user(session: AsyncSession, email: str, password: str) -> User:
    """Validate credentials while returning the same external error for all failures."""
    candidate_password = password if 8 <= len(password) <= 128 else "invalid-password"
    user = await session.scalar(select(User).where(User.email == normalize_email(email)))
    if user is None:
        await to_thread.run_sync(hash_password, candidate_password)
        raise InvalidCredentialsError

    password_valid = await to_thread.run_sync(
        verify_password,
        candidate_password,
        user.password_hash,
    )
    if not password_valid or not user.is_active:
        raise InvalidCredentialsError
    return user


async def issue_tokens(
    session: AsyncSession,
    user: User,
    settings: Settings,
    *,
    now: datetime | None = None,
) -> IssuedTokens:
    """Create access credentials and persist only the refresh-token hash."""
    issued_at = now or datetime.now(UTC)
    access_token, expires_in = create_access_token(user.id, settings, now=issued_at)
    refresh_token, token_hash = create_refresh_token()
    session.add(
        RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=issued_at + timedelta(days=settings.refresh_token_days),
        )
    )
    await session.flush()
    return IssuedTokens(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


async def rotate_refresh_token(
    session: AsyncSession,
    raw_token: str,
    settings: Settings,
    *,
    now: datetime | None = None,
) -> IssuedTokens:
    """Atomically revoke one refresh token and replace it with a new token pair."""
    rotated_at = now or datetime.now(UTC)
    token_hash = hash_refresh_token(raw_token)
    statement = (
        select(RefreshToken, User)
        .join(User, User.id == RefreshToken.user_id)
        .where(RefreshToken.token_hash == token_hash)
        .with_for_update()
    )
    row = (await session.execute(statement)).one_or_none()
    if row is None:
        raise InvalidRefreshTokenError

    current_token, user = row._tuple()
    if current_token.revoked_at is not None or current_token.expires_at <= rotated_at:
        raise InvalidRefreshTokenError
    if not user.is_active:
        raise InvalidRefreshTokenError

    issued = await issue_tokens(session, user, settings, now=rotated_at)
    replacement_hash = hash_refresh_token(issued.refresh_token)
    replacement_id = await session.scalar(
        select(RefreshToken.id).where(RefreshToken.token_hash == replacement_hash)
    )
    current_token.revoked_at = rotated_at
    current_token.replaced_by_id = replacement_id
    await session.flush()
    return issued


async def revoke_refresh_token(
    session: AsyncSession,
    raw_token: str,
    *,
    now: datetime | None = None,
) -> None:
    """Idempotently revoke an existing refresh token."""
    token = await session.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_refresh_token(raw_token))
        .with_for_update()
    )
    if token is not None and token.revoked_at is None:
        token.revoked_at = now or datetime.now(UTC)
        await session.flush()
