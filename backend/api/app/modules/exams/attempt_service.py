"""Durable deterministic mock and attempt lifecycle."""

import json
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.attempt import ResponseSaveRequest
from app.core.config import Settings, get_settings
from app.db.models.attempt import Attempt, AttemptResponse, AttemptStatus, MockExam, MockQuestion
from app.integrations.vertex_ai import evaluate_attempt, generate_grounded_mock
from app.modules.exams.retrieval import retrieve_exam_chunks
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
    session: AsyncSession, owner_id: UUID, exam_id: UUID, settings: Settings | None = None
) -> tuple[MockExam, list[MockQuestion]]:
    settings = settings or get_settings()
    exam = await get_owned_exam(session, owner_id, exam_id)
    if not exam.blueprint:
        raise ValueError("Complete the exam blueprint before generating a mock")
    retrieval_query = " ".join(
        [exam.title, exam.description or "", json.dumps(exam.blueprint), json.dumps(exam.rules)]
    )
    chunks = await retrieve_exam_chunks(session, settings, exam.id, retrieval_query)
    if settings.vertex_configured and chunks:
        prior_attempts = await list_exam_attempts(session, owner_id, exam.id)
        weak_topics: list[str] = []
        for attempt in prior_attempts[:5]:
            weak_topics.extend(str(item) for item in attempt.result.get("weak_topics", []))
        source_context = "\n\n".join(
            f"[chunk:{item.id} artifact:{item.artifact_id} page:{item.page_number}]\n{item.text}"
            for item in chunks
        )
        generated = await generate_grounded_mock(
            settings,
            exam_context=json.dumps(
                {
                    "title": exam.title,
                    "language": exam.language,
                    "blueprint": exam.blueprint,
                    "rules": exam.rules,
                    "scenario": exam.scenario,
                    "pasted_context": exam.pasted_context,
                },
                default=str,
            ),
            source_context=source_context,
            adaptation_context=(
                "Emphasize these weak topics while preserving the blueprint: "
                + ", ".join(dict.fromkeys(weak_topics))
                if weak_topics
                else ""
            ),
        )
        allowed_chunk_ids = {str(item.id) for item in chunks}
        chunk_by_id = {str(item.id): item for item in chunks}
        if not generated.questions:
            raise ValueError("Vertex AI did not generate any questions")
        mock = MockExam(
            exam_id=exam.id,
            generator=f"vertex:{settings.vertex_generation_model}",
            title=generated.title,
            instructions=generated.instructions,
            duration_minutes=int(exam.rules.get("durationMinutes", 60)),
            max_score=sum(item.points for item in generated.questions),
        )
        session.add(mock)
        await session.flush()
        ai_questions: list[MockQuestion] = []
        for position, item in enumerate(generated.questions, start=1):
            cited = [
                chunk_id for chunk_id in item.citation_chunk_ids if chunk_id in allowed_chunk_ids
            ]
            if not cited:
                raise ValueError(f"Generated question {position} has no valid source citation")
            question = MockQuestion(
                mock_exam_id=mock.id,
                section_id=item.section_id,
                position=position,
                question_type=item.question_type,
                prompt=item.prompt,
                points=item.points,
                answer_key=item.answer_key,
                topic=item.topic,
                citations=[
                    {
                        "chunk_id": chunk_id,
                        "artifact_id": str(chunk_by_id[chunk_id].artifact_id),
                        "page_number": chunk_by_id[chunk_id].page_number,
                    }
                    for chunk_id in cited
                ],
            )
            session.add(question)
            ai_questions.append(question)
        await session.flush()
        return mock, ai_questions

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


async def submit_attempt(
    session: AsyncSession,
    user_id: UUID,
    attempt_id: UUID,
    settings: Settings | None = None,
) -> Attempt:
    settings = settings or get_settings()
    attempt, _, questions, responses = await get_attempt(session, user_id, attempt_id)
    if attempt.status == AttemptStatus.EVALUATED:
        return attempt
    answer_by_question = {response.question_id: response.answer.strip() for response in responses}
    mock = await session.scalar(select(MockExam).where(MockExam.id == attempt.mock_exam_id))
    if settings.vertex_configured and mock is not None and mock.generator.startswith("vertex:"):
        question_context = "\n\n".join(
            json.dumps(
                {
                    "question_id": str(question.id),
                    "topic": question.topic,
                    "prompt": question.prompt,
                    "answer_key": question.answer_key,
                    "maximum_points": question.points,
                    "student_answer": answer_by_question.get(question.id, ""),
                }
            )
            for question in questions
        )
        evaluation = await evaluate_attempt(
            settings,
            exam_context=json.dumps({"maximum_score": attempt.max_score}),
            question_context=question_context,
        )
        points_by_id = {str(question.id): question.points for question in questions}
        score = sum(
            min(points_by_id.get(item.question_id, 0), item.awarded_points)
            for item in evaluation.evaluations
        )
        weak_topics = [
            question.topic
            for question in questions
            for item in evaluation.evaluations
            if item.question_id == str(question.id)
            and item.awarded_points < question.points * 0.7
            and question.topic
        ]
        result_detail = {
            "feedback": evaluation.overall_feedback,
            "question_feedback": [item.model_dump() for item in evaluation.evaluations],
            "weak_topics": list(dict.fromkeys(weak_topics)),
            "evaluator": f"vertex:{settings.vertex_generation_model}",
        }
    else:
        score = 0
        for question in questions:
            answer = answer_by_question.get(question.id, "")
            if len(answer) >= 20:
                score += question.points
            elif answer:
                score += question.points // 2
        result_detail = {
            "feedback": (
                "Prototype deterministic evaluation: complete, reasoned responses receive "
                "full credit."
            ),
            "weak_topics": [],
            "evaluator": "deterministic_demo",
        }
    now = datetime.now(UTC)
    percentage = round(score / max(1, attempt.max_score) * 100)
    attempt.status = AttemptStatus.EVALUATED
    attempt.submitted_at = now
    attempt.duration_seconds = max(0, int((now - attempt.started_at).total_seconds()))
    attempt.score = score
    attempt.result = {"percentage": percentage, **result_detail}
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
