"""Liveness and readiness endpoints."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app import __version__
from app.api.schemas.health import HealthResponse, HealthStatus
from app.db.dependencies import get_database
from app.db.session import DatabaseProtocol

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health")
DatabaseDependency = Annotated[DatabaseProtocol, Depends(get_database)]


@router.get("/live")
async def liveness() -> HealthResponse:
    """Confirm that the API process can serve requests."""
    return HealthResponse(status=HealthStatus.OK, version=__version__)


@router.get(
    "/ready",
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": HealthResponse}},
)
async def readiness(response: Response, database: DatabaseDependency) -> HealthResponse:
    """Confirm that required backend dependencies are reachable."""
    try:
        await database.ping()
    except Exception:
        logger.exception("Database readiness check failed")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(status=HealthStatus.UNAVAILABLE, version=__version__)

    return HealthResponse(status=HealthStatus.OK, version=__version__)
