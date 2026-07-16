"""Deterministic mock and durable attempt endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.attempt import (
    AttemptDetailResponse,
    AttemptResponseItem,
    AttemptResultResponse,
    AttemptSummaryResponse,
    ExamStatisticsResponse,
    MockExamResponse,
    MockQuestionResponse,
    ResponseSaveRequest,
)
from app.db.dependencies import get_session
from app.db.models.attempt import Attempt, AttemptResponse, MockExam, MockQuestion
from app.modules.auth.dependencies import WorkspaceReadUser, WorkspaceWriteUser
from app.modules.exams.attempt_service import (
    AttemptClosedError,
    AttemptNotFoundError,
    MockNotFoundError,
    ResponseVersionConflictError,
    generate_mock,
    get_attempt,
    get_mock,
    list_exam_attempts,
    save_response,
    start_attempt,
    submit_attempt,
)
from app.modules.exams.service import ExamNotFoundError

router = APIRouter()
SessionDependency = Annotated[AsyncSession, Depends(get_session)]


def mock_response(mock: MockExam, questions: list[MockQuestion]) -> MockExamResponse:
    return MockExamResponse(
        id=mock.id,
        exam_id=mock.exam_id,
        generator=mock.generator,
        title=mock.title,
        instructions=mock.instructions,
        duration_minutes=mock.duration_minutes,
        max_score=mock.max_score,
        questions=[
            MockQuestionResponse(
                id=item.id,
                section_id=item.section_id,
                position=item.position,
                question_type=item.question_type,
                prompt=item.prompt,
                points=item.points,
            )
            for item in questions
        ],
    )


def detail_response(
    attempt: Attempt,
    mock: MockExam,
    questions: list[MockQuestion],
    responses: list[AttemptResponse],
) -> AttemptDetailResponse:
    return AttemptDetailResponse(
        id=attempt.id,
        mock_exam=mock_response(mock, questions),
        status=attempt.status,
        started_at=attempt.started_at,
        last_saved_at=attempt.last_saved_at,
        submitted_at=attempt.submitted_at,
        responses=[
            AttemptResponseItem(
                question_id=item.question_id,
                answer=item.answer,
                flagged=item.flagged,
                version=item.version,
                saved_at=item.saved_at,
            )
            for item in responses
        ],
    )


@router.post("/exams/{exam_id}/mocks", status_code=status.HTTP_201_CREATED)
async def create_mock(
    exam_id: UUID, current_user: WorkspaceWriteUser, session: SessionDependency
) -> MockExamResponse:
    try:
        async with session.begin():
            mock, questions = await generate_mock(session, current_user.id, exam_id)
    except ExamNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Exam not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return mock_response(mock, questions)


@router.get("/mocks/{mock_id}")
async def read_mock(
    mock_id: UUID, current_user: WorkspaceReadUser, session: SessionDependency
) -> MockExamResponse:
    try:
        mock, questions = await get_mock(session, current_user.id, mock_id)
    except (MockNotFoundError, ExamNotFoundError) as exc:
        raise HTTPException(status_code=404, detail="Mock not found") from exc
    return mock_response(mock, questions)


@router.post("/mocks/{mock_id}/attempts", status_code=status.HTTP_201_CREATED)
async def create_attempt(
    mock_id: UUID, current_user: WorkspaceReadUser, session: SessionDependency
) -> AttemptDetailResponse:
    try:
        async with session.begin():
            attempt = await start_attempt(session, current_user.id, mock_id)
        attempt, mock, questions, responses = await get_attempt(
            session, current_user.id, attempt.id
        )
    except (MockNotFoundError, ExamNotFoundError) as exc:
        raise HTTPException(status_code=404, detail="Mock not found") from exc
    return detail_response(attempt, mock, questions, responses)


@router.get("/attempts/{attempt_id}")
async def read_attempt(
    attempt_id: UUID, current_user: WorkspaceReadUser, session: SessionDependency
) -> AttemptDetailResponse:
    try:
        attempt, mock, questions, responses = await get_attempt(
            session, current_user.id, attempt_id
        )
    except (AttemptNotFoundError, MockNotFoundError, ExamNotFoundError) as exc:
        raise HTTPException(status_code=404, detail="Attempt not found") from exc
    return detail_response(attempt, mock, questions, responses)


@router.put("/attempts/{attempt_id}/responses/{question_id}")
async def write_response(
    attempt_id: UUID,
    question_id: UUID,
    payload: ResponseSaveRequest,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
) -> AttemptResponseItem:
    try:
        async with session.begin():
            item = await save_response(session, current_user.id, attempt_id, question_id, payload)
    except (AttemptNotFoundError, MockNotFoundError, ExamNotFoundError) as exc:
        raise HTTPException(status_code=404, detail="Attempt or question not found") from exc
    except AttemptClosedError as exc:
        raise HTTPException(status_code=409, detail="Attempt is already submitted") from exc
    except ResponseVersionConflictError as exc:
        raise HTTPException(
            status_code=409, detail="Response changed. Reload before saving again."
        ) from exc
    return AttemptResponseItem(
        question_id=item.question_id,
        answer=item.answer,
        flagged=item.flagged,
        version=item.version,
        saved_at=item.saved_at,
    )


@router.post("/attempts/{attempt_id}/submit")
async def submit(
    attempt_id: UUID, current_user: WorkspaceReadUser, session: SessionDependency
) -> AttemptResultResponse:
    try:
        async with session.begin():
            attempt = await submit_attempt(session, current_user.id, attempt_id)
    except (AttemptNotFoundError, MockNotFoundError, ExamNotFoundError) as exc:
        raise HTTPException(status_code=404, detail="Attempt not found") from exc
    assert (
        attempt.score is not None
        and attempt.duration_seconds is not None
        and attempt.submitted_at is not None
    )
    percentage = round(attempt.score / max(1, attempt.max_score) * 100)
    return AttemptResultResponse(
        attempt_id=attempt.id,
        exam_id=attempt.exam_id,
        score=attempt.score,
        max_score=attempt.max_score,
        percentage=percentage,
        passed=percentage >= 50,
        duration_seconds=attempt.duration_seconds,
        submitted_at=attempt.submitted_at,
        feedback=str(attempt.result.get("feedback", "")),
    )


def summary_response(attempt: Attempt) -> AttemptSummaryResponse:
    assert attempt.score is not None
    assert attempt.duration_seconds is not None
    assert attempt.submitted_at is not None
    percentage = round(attempt.score / max(1, attempt.max_score) * 100)
    return AttemptSummaryResponse(
        attempt_id=attempt.id,
        exam_id=attempt.exam_id,
        status=attempt.status,
        score=attempt.score,
        max_score=attempt.max_score,
        percentage=percentage,
        passed=percentage >= 50,
        duration_seconds=attempt.duration_seconds,
        submitted_at=attempt.submitted_at,
        feedback=str(attempt.result.get("feedback", "")),
    )


@router.get("/exams/{exam_id}/attempts")
async def exam_attempts(
    exam_id: UUID,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
) -> list[AttemptSummaryResponse]:
    try:
        attempts = await list_exam_attempts(session, current_user.id, exam_id)
    except ExamNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Exam not found") from exc
    return [summary_response(item) for item in attempts]


@router.get("/exams/{exam_id}/statistics")
async def exam_statistics(
    exam_id: UUID,
    current_user: WorkspaceReadUser,
    session: SessionDependency,
) -> ExamStatisticsResponse:
    try:
        attempts = await list_exam_attempts(session, current_user.id, exam_id)
    except ExamNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Exam not found") from exc
    percentages = [
        round(item.score / max(1, item.max_score) * 100)
        for item in attempts
        if item.score is not None
    ]
    durations = [item.duration_seconds for item in attempts if item.duration_seconds is not None]
    return ExamStatisticsResponse(
        exam_id=exam_id,
        attempt_count=len(attempts),
        average_percentage=round(sum(percentages) / len(percentages)) if percentages else None,
        best_percentage=max(percentages) if percentages else None,
        latest_percentage=percentages[0] if percentages else None,
        average_duration_seconds=round(sum(durations) / len(durations)) if durations else None,
        low_confidence=len(attempts) < 5,
    )
