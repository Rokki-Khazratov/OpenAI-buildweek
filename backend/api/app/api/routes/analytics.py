"""Authenticated personal analytics endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.analytics import (
    AnalyticsDataQualityResponse,
    AnalyticsOperationsResponse,
    AnalyticsOverviewResponse,
    AnalyticsRebuildResponse,
    ExamAnalyticsResponse,
)
from app.db.dependencies import get_session
from app.modules.analytics.service import (
    analytics_data_quality,
    analytics_operations,
    analytics_overview,
    exam_analytics,
    rebuild_exam_analytics,
)
from app.modules.auth.dependencies import WorkspaceReadUser
from app.modules.exams.service import ExamNotFoundError

router = APIRouter()
SessionDependency = Annotated[AsyncSession, Depends(get_session)]


@router.get("/exams/{exam_id}/analytics")
async def read_exam_analytics(
    exam_id: UUID,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
) -> ExamAnalyticsResponse:
    try:
        return await exam_analytics(session, current_user.id, exam_id)
    except ExamNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Exam not found") from exc


@router.get("/analytics/overview")
async def read_analytics_overview(
    current_user: WorkspaceReadUser,
    session: SessionDependency,
) -> AnalyticsOverviewResponse:
    return await analytics_overview(session, current_user.id)


@router.get("/analytics/operations")
async def operations(
    current_user: WorkspaceReadUser,
    session: SessionDependency,
) -> AnalyticsOperationsResponse:
    return await analytics_operations(session, current_user.id)


@router.post("/exams/{exam_id}/analytics/rebuild")
async def rebuild(
    exam_id: UUID,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
) -> AnalyticsRebuildResponse:
    try:
        async with session.begin():
            return await rebuild_exam_analytics(session, current_user.id, exam_id)
    except ExamNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Exam not found") from exc


@router.get("/exams/{exam_id}/analytics/data-quality")
async def data_quality(
    exam_id: UUID,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
) -> AnalyticsDataQualityResponse:
    try:
        return await analytics_data_quality(session, current_user.id, exam_id)
    except ExamNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Exam not found") from exc
