"""Authenticated personal analytics endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.analytics import AnalyticsOverviewResponse, ExamAnalyticsResponse
from app.db.dependencies import get_session
from app.modules.analytics.service import analytics_overview, exam_analytics
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
