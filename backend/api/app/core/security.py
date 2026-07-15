"""Password, access-token, and refresh-token primitives."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe
from uuid import UUID, uuid4

import jwt
from pwdlib import PasswordHash

from app.core.config import Settings

password_hasher = PasswordHash.recommended()

DEFAULT_SCOPES = frozenset(
    {
        "profile:read",
        "profile:write",
        "workspace:read",
        "workspace:write",
    }
)


class InvalidAccessTokenError(ValueError):
    """Raised when a bearer token is invalid or has the wrong type."""


@dataclass(frozen=True, slots=True)
class AccessTokenClaims:
    """Validated claims used by authorization dependencies."""

    user_id: UUID
    scopes: frozenset[str]


def hash_password(password: str) -> str:
    """Hash a password with the currently recommended pwdlib algorithm."""
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password without exposing algorithm details to callers."""
    return password_hasher.verify(password, password_hash)


def create_access_token(
    user_id: UUID,
    settings: Settings,
    *,
    scopes: frozenset[str] = DEFAULT_SCOPES,
    now: datetime | None = None,
) -> tuple[str, int]:
    """Create a short-lived JWT access token and return its TTL in seconds."""
    issued_at = now or datetime.now(UTC)
    expires_at = issued_at + timedelta(minutes=settings.access_token_minutes)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "scope": " ".join(sorted(scopes)),
        "iat": issued_at,
        "exp": expires_at,
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "jti": str(uuid4()),
    }
    token = jwt.encode(
        payload,
        settings.jwt_secret.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )
    return token, int((expires_at - issued_at).total_seconds())


def decode_access_token(token: str, settings: Settings) -> AccessTokenClaims:
    """Decode a JWT using an explicit algorithm allow-list and required claims."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["sub", "type", "scope", "iat", "exp", "iss", "aud", "jti"]},
        )
        if payload.get("type") != "access":
            raise InvalidAccessTokenError("Unexpected token type")
        user_id = UUID(payload["sub"])
        scopes = frozenset(str(payload["scope"]).split())
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise InvalidAccessTokenError("Invalid access token") from exc

    return AccessTokenClaims(user_id=user_id, scopes=scopes)


def create_refresh_token() -> tuple[str, str]:
    """Return a high-entropy opaque refresh token and its storage hash."""
    token = token_urlsafe(48)
    return token, hash_refresh_token(token)


def hash_refresh_token(token: str) -> str:
    """Hash a refresh token before persistence or lookup."""
    return sha256(token.encode()).hexdigest()
