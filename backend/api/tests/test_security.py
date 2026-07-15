"""Security primitive tests that do not require external services."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import SecretStr

from app.core.config import Environment, Settings
from app.core.security import (
    InvalidAccessTokenError,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


@pytest.fixture
def security_settings() -> Settings:
    return Settings(
        _env_file=None,
        environment=Environment.TEST,
        jwt_secret=SecretStr("test-secret-that-is-longer-than-32-characters"),
    )


def test_password_hash_round_trip() -> None:
    digest = hash_password("correct horse battery staple")

    assert digest != "correct horse battery staple"
    assert verify_password("correct horse battery staple", digest)
    assert not verify_password("wrong password", digest)


def test_access_token_round_trip(security_settings: Settings) -> None:
    user_id = uuid4()
    token, expires_in = create_access_token(user_id, security_settings)

    claims = decode_access_token(token, security_settings)

    assert claims.user_id == user_id
    assert "workspace:write" in claims.scopes
    assert expires_in == security_settings.access_token_minutes * 60


def test_expired_access_token_is_rejected(security_settings: Settings) -> None:
    token, _ = create_access_token(
        uuid4(),
        security_settings,
        now=datetime.now(UTC) - timedelta(hours=1),
    )

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(token, security_settings)


def test_refresh_token_storage_uses_only_hash() -> None:
    token, digest = create_refresh_token()

    assert token != digest
    assert digest == hash_refresh_token(token)
    assert len(digest) == 64
