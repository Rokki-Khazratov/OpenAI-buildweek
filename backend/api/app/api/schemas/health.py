"""Health endpoint schemas."""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class HealthStatus(StrEnum):
    """Machine-readable service health state."""

    OK = "ok"
    UNAVAILABLE = "unavailable"


class HealthResponse(BaseModel):
    """Health endpoint response."""

    model_config = ConfigDict(frozen=True)

    status: HealthStatus
    version: str
