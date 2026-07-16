"""Durable deterministic mock and attempt lifecycle."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.attempt import ResponseSaveRequest
from app.db.models.attempt import Attempt, AttemptResponse, AttemptStatus, MockExam, MockQuestion
from app.modules.exams.service import get_exam, get_owned_exam


class MockNotFoundError(LookupError):
    pass


class AttemptNotFoundError(LookupError):
    pass


class AttemptClosedError(ValueError):
    pass


class ResponseVersionConflictError(ValueError):
    pass


async def generate_mock(
    session: AsyncSession, owner_id: UUID, exam_id: UUID
) -> tuple[MockExam, list[MockQuestion]]:
    exam = await get_owned_exam(session, owner_id, exam_id)
    if not exam.blueprint:
        raise ValueError("Complete the exam blueprint before generating a mock")
    mock = MockExam(
        exam_id=exam.id,
        title=f"{exam.title} · deterministic mock",
        instructions=str(exam.scenario.get("instructions", "")),
        duration_minutes=int(exam.rules.get("durationMinutes", 60)),
        max_score=int(exam.rules.get("totalPoints", 100)),
    )
    session.add(mock)
    await session.flush()
    questions: list[MockQuestion] = []
    position = 1
    for section in exam.blueprint:
        count = int(section.get("questionCount", 1))
        section_points = int(section.get("points", count))
        for index in range(count):
            points = max(1, section_points // count)
            question = MockQuestion(
                mock_exam_id=mock.id,
                section_id=str(section.get("id", "section")),
                position=position,
                question_type=str(section.get("questionType", "Open response")),
                prompt=(
                    f"{section.get('title', 'Section')} — question {index + 1}: "
                    "explain the key concept and show your reasoning."
                ),
                points=points,
                answer_key=(
                    "A complete response states the key concept and provides relevant reasoning."
                ),
            )
            session.add(question)
            questions.append(question)
            position += 1
    await session.flush()
    return mock, questions


async def get_mock(
    session: AsyncSession, user_id: UUID, mock_id: UUID
) -> tuple[MockExam, list[MockQuestion]]:
    mock = await session.scalar(select(MockExam).where(MockExam.id == mock_id))
    if mock is None:
        raise MockNotFoundError
    await get_exam(session, user_id, mock.exam_id)
    questions = list(
        (
            await session.scalars(
                select(MockQuestion)
                .where(MockQuestion.mock_exam_id == mock.id)
                .order_by(MockQuestion.position)
            )
        ).all()
    )
    return mock, questions


async def start_attempt(session: AsyncSession, user_id: UUID, mock_id: UUID) -> Attempt:
    mock, _ = await get_mock(session, user_id, mock_id)
    existing = await session.scalar(
        select(Attempt).where(
            Attempt.mock_exam_id == mock.id,
            Attempt.user_id == user_id,
            Attempt.status == AttemptStatus.IN_PROGRESS,
        )
    )
    if existing is not None:
        return existing
    attempt = Attempt(
        mock_exam_id=mock.id, exam_id=mock.exam_id, user_id=user_id, max_score=mock.max_score
    )
    session.add(attempt)
    await session.flush()
    await session.refresh(attempt)
    return attempt


async def get_attempt(
    session: AsyncSession, user_id: UUID, attempt_id: UUID
) -> tuple[Attempt, MockExam, list[MockQuestion], list[AttemptResponse]]:
    attempt = await session.scalar(
        select(Attempt).where(Attempt.id == attempt_id, Attempt.user_id == user_id)
    )
    if attempt is None:
        raise AttemptNotFoundError
    mock, questions = await get_mock(session, user_id, attempt.mock_exam_id)
    responses = list(
        (
            await session.scalars(
                select(AttemptResponse).where(AttemptResponse.attempt_id == attempt.id)
            )
        ).all()
    )
    return attempt, mock, questions, responses


async def save_response(
    session: AsyncSession,
    user_id: UUID,
    attempt_id: UUID,
    question_id: UUID,
    payload: ResponseSaveRequest,
) -> AttemptResponse:
    attempt, _, questions, _ = await get_attempt(session, user_id, attempt_id)
    if attempt.status != AttemptStatus.IN_PROGRESS:
        raise AttemptClosedError
    if question_id not in {question.id for question in questions}:
        raise AttemptNotFoundError
    response = await session.scalar(
        select(AttemptResponse)
        .where(AttemptResponse.attempt_id == attempt.id, AttemptResponse.question_id == question_id)
        .with_for_update()
    )
    if response is None:
        response = AttemptResponse(
            attempt_id=attempt.id,
            question_id=question_id,
            answer=payload.answer,
            flagged=payload.flagged,
        )
        session.add(response)
    else:
        if payload.version is not None and payload.version != response.version:
            raise ResponseVersionConflictError
        response.answer = payload.answer
        response.flagged = payload.flagged
        response.version += 1
    now = datetime.now(UTC)
    response.saved_at = now
    attempt.last_saved_at = now
    await session.flush()
    await session.refresh(response)
    return response


async def submit_attempt(session: AsyncSession, user_id: UUID, attempt_id: UUID) -> Attempt:
    attempt, _, questions, responses = await get_attempt(session, user_id, attempt_id)
    if attempt.status == AttemptStatus.EVALUATED:
        return attempt
    answer_by_question = {response.question_id: response.answer.strip() for response in responses}
    score = 0
    for question in questions:
        answer = answer_by_question.get(question.id, "")
        if len(answer) >= 20:
            score += question.points
        elif answer:
            score += question.points // 2
    now = datetime.now(UTC)
    percentage = round(score / max(1, attempt.max_score) * 100)
    attempt.status = AttemptStatus.EVALUATED
    attempt.submitted_at = now
    attempt.duration_seconds = max(0, int((now - attempt.started_at).total_seconds()))
    attempt.score = score
    attempt.result = {
        "percentage": percentage,
        "feedback": (
            "Prototype deterministic evaluation: complete, reasoned responses receive full credit."
        ),
    }
    await session.flush()
    await session.refresh(attempt)
    return attempt


async def list_exam_attempts(session: AsyncSession, user_id: UUID, exam_id: UUID) -> list[Attempt]:
    await get_exam(session, user_id, exam_id)
    result = await session.scalars(
        select(Attempt)
        .where(
            Attempt.exam_id == exam_id,
            Attempt.user_id == user_id,
            Attempt.status == AttemptStatus.EVALUATED,
        )
        .order_by(Attempt.submitted_at.desc())
    )
    return list(result.all())
