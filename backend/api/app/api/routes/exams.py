"""Exam CRUD endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.exam import (
    ExamCreateRequest,
    ExamListResponse,
    ExamResponse,
    ExamUpdateRequest,
)
from app.db.dependencies import get_session
from app.modules.auth.dependencies import WorkspaceReadUser, WorkspaceWriteUser
from app.modules.exams.service import (
    ExamConfigurationConflictError,
    ExamNotFoundError,
    create_exam,
    delete_exam,
    get_exam,
    list_exams,
    update_exam,
)
from app.modules.workspaces.service import WorkspaceNotFoundError

router = APIRouter()
SessionDependency = Annotated[AsyncSession, Depends(get_session)]


def not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")


@router.post("/subjects/{subject_id}/exams", status_code=status.HTTP_201_CREATED)
async def create(
    subject_id: UUID,
    payload: ExamCreateRequest,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
) -> ExamResponse:
    try:
        async with session.begin():
            exam = await create_exam(session, current_user.id, subject_id, payload)
    except WorkspaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Subject not found") from exc
    return ExamResponse.model_validate(exam)


@router.get("/subjects/{subject_id}/exams")
async def list_for_subject(
    subject_id: UUID,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ExamListResponse:
    try:
        page = await list_exams(session, current_user.id, subject_id, limit=limit, offset=offset)
    except WorkspaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Subject not found") from exc
    return ExamListResponse(
        items=[ExamResponse.model_validate(item) for item in page.items],
        total=page.total,
        limit=limit,
        offset=offset,
    )


@router.get("/exams/{exam_id}")
async def read(
    exam_id: UUID,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
) -> ExamResponse:
    try:
        exam = await get_exam(session, current_user.id, exam_id)
    except ExamNotFoundError as exc:
        raise not_found() from exc
    return ExamResponse.model_validate(exam)


@router.patch("/exams/{exam_id}")
async def update(
    exam_id: UUID,
    payload: ExamUpdateRequest,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
) -> ExamResponse:
    if not payload.model_fields_set:
        raise HTTPException(status_code=422, detail="At least one field is required")
    try:
        async with session.begin():
            exam = await update_exam(session, current_user.id, exam_id, payload)
    except ExamNotFoundError as exc:
        raise not_found() from exc
    except ExamConfigurationConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Exam configuration changed. Reload before saving again.",
        ) from exc
    return ExamResponse.model_validate(exam)


@router.delete("/exams/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    exam_id: UUID,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
    response: Response,
) -> None:
    try:
        async with session.begin():
            await delete_exam(session, current_user.id, exam_id)
    except ExamNotFoundError as exc:
        raise not_found() from exc
    response.status_code = status.HTTP_204_NO_CONTENT
