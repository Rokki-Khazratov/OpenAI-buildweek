"""Grounded mock generation and evidence-based attempt evaluation."""

import json
import math
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompts import EVALUATION_PROMPT_VERSION, MOCK_PROMPT_VERSION
from app.ai.provider import input_hash
from app.ai.schemas import (
    EvaluationBatch,
    EvaluationInput,
    EvaluationQuestionInput,
    MockGenerationInput,
    SourceChunkInput,
)
from app.ai.validators import validate_mock
from app.ai.vertex import VertexAIProvider
from app.api.schemas.attempt import ResponseSaveRequest
from app.core.config import Settings, get_settings
from app.db.models.artifact import Artifact, ArtifactChunk
from app.db.models.attempt import (
    Attempt,
    AttemptResponse,
    AttemptStatus,
    MockExam,
    MockQuestion,
    QuestionEvaluation,
)
from app.db.models.blueprint import BlueprintStatus, ExamBlueprint
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


class AIServiceError(RuntimeError):
    pass


def slug(value: str) -> str:
    normalized = "-".join(value.casefold().split())
    return "".join(character for character in normalized if character.isalnum() or character == "-")


def distribute_points(total: int, count: int) -> list[int]:
    base, remainder = divmod(total, count)
    if base < 1:
        raise ValueError("Section points must be at least its question count")
    return [base + (1 if index < remainder else 0) for index in range(count)]


def fallback_rubric(points: int) -> dict[str, Any]:
    return {
        "version": "rubric.v1",
        "dimensions": [
            {
                "id": "accuracy",
                "label": "Accuracy and reasoning",
                "max_points": points,
                "criteria": [
                    {
                        "label": "full",
                        "points": points,
                        "description": "Correct conclusion supported by relevant reasoning.",
                    },
                    {
                        "label": "partial",
                        "points": max(0, points // 2),
                        "description": "Some correct knowledge but incomplete reasoning.",
                    },
                    {
                        "label": "none",
                        "points": 0,
                        "description": "No supported relevant answer.",
                    },
                ],
            }
        ],
    }


async def approved_blueprint(session: AsyncSession, exam_id: UUID) -> ExamBlueprint | None:
    return cast(
        ExamBlueprint | None,
        await session.scalar(
            select(ExamBlueprint)
            .where(
                ExamBlueprint.exam_id == exam_id,
                ExamBlueprint.status == BlueprintStatus.APPROVED,
            )
            .order_by(ExamBlueprint.version.desc())
        ),
    )


async def latest_blueprint(session: AsyncSession, exam_id: UUID) -> ExamBlueprint | None:
    return cast(
        ExamBlueprint | None,
        await session.scalar(
            select(ExamBlueprint)
            .where(ExamBlueprint.exam_id == exam_id)
            .order_by(ExamBlueprint.version.desc())
        ),
    )


async def generate_mock(
    session: AsyncSession, owner_id: UUID, exam_id: UUID, settings: Settings | None = None
) -> tuple[MockExam, list[MockQuestion]]:
    settings = settings or get_settings()
    exam = await get_owned_exam(session, owner_id, exam_id)
    if not exam.blueprint:
        raise ValueError("Complete and approve the exam blueprint before generating a mock")
    blueprint_record = await approved_blueprint(session, exam.id)
    current_blueprint = await latest_blueprint(session, exam.id)
    if current_blueprint is not None and current_blueprint.status != BlueprintStatus.APPROVED:
        raise ValueError("Review and approve the latest blueprint before generating a mock")
    retrieval_query = " ".join(
        [exam.title, exam.description or "", json.dumps(exam.blueprint), json.dumps(exam.rules)]
    )
    chunks = await retrieve_exam_chunks(session, settings, exam.id, retrieval_query)
    if settings.vertex_configured and chunks:
        prior_attempts = await list_exam_attempts(session, owner_id, exam.id)
        weak_topics: list[str] = []
        for prior_attempt in prior_attempts[:5]:
            weak_topics.extend(str(item) for item in prior_attempt.result.get("weak_topics", []))
        source_chunks = [
            SourceChunkInput(
                chunk_id=str(item.id),
                artifact_id=str(item.artifact_id),
                artifact_name=f"Artifact {str(item.artifact_id)[:8]}",
                artifact_kind="context",
                page_number=item.page_number,
                text=item.text,
            )
            for item in chunks
        ]
        generation_input = MockGenerationInput(
            exam_context={
                "title": exam.title,
                "language": exam.language,
                "blueprint": exam.blueprint,
                "rules": exam.rules,
                "scenario": exam.scenario,
                "pasted_context": exam.pasted_context,
                "blueprint_version": blueprint_record.version if blueprint_record else None,
            },
            chunks=source_chunks,
            adaptation_context={
                "target_skills": list(dict.fromkeys(weak_topics)),
                "instruction": "Preserve the approved blueprint while emphasizing targets.",
            },
        )
        await session.commit()
        provider = VertexAIProvider(settings)
        try:
            generated = await provider.generate_mock(generation_input)
            errors = validate_mock(
                generated,
                blueprint_sections=exam.blueprint,
                allowed_chunk_ids={item.chunk_id for item in source_chunks},
            )
            retries = 0
            while errors and retries < settings.ai_validation_retries:
                retries += 1
                generation_input.validation_feedback = errors
                generated = await provider.generate_mock(generation_input)
                errors = validate_mock(
                    generated,
                    blueprint_sections=exam.blueprint,
                    allowed_chunk_ids={item.chunk_id for item in source_chunks},
                )
        except Exception as exc:
            raise AIServiceError(f"Mock generation failed: {str(exc)[:300]}") from exc
        if errors:
            raise AIServiceError("Mock generation failed validation: " + "; ".join(errors[:4]))
        chunk_by_id = {str(item.id): item for item in chunks}
        mock = MockExam(
            exam_id=exam.id,
            blueprint_id=blueprint_record.id if blueprint_record else None,
            generator=f"vertex:{settings.vertex_generation_model}",
            title=generated.title,
            instructions=generated.instructions,
            duration_minutes=int(exam.rules.get("durationMinutes", 60)),
            max_score=int(exam.rules.get("totalPoints", 100)),
            generation_metadata={
                "provider": provider.name,
                "model": provider.model,
                "prompt_version": MOCK_PROMPT_VERSION,
                "schema_version": "generated-mock.v2",
                "input_hash": input_hash(generation_input),
                "retry_count": retries,
                "validation_status": "valid",
                "blueprint_version": blueprint_record.version if blueprint_record else None,
                "target_skills": list(dict.fromkeys(weak_topics)),
            },
        )
        session.add(mock)
        await session.flush()
        questions: list[MockQuestion] = []
        for position, item in enumerate(generated.questions, start=1):
            question = MockQuestion(
                mock_exam_id=mock.id,
                section_id=item.section_id,
                position=position,
                question_type=item.question_type,
                prompt=item.prompt,
                points=item.points,
                answer_key=item.answer_key,
                topic=item.skill_ids[0],
                skill_ids=item.skill_ids,
                difficulty=item.difficulty,
                grading_mode=item.grading_mode,
                rubric=item.rubric.model_dump(mode="json") if item.rubric else {},
                citations=[
                    {
                        "chunk_id": chunk_id,
                        "artifact_id": str(chunk_by_id[chunk_id].artifact_id),
                        "page_number": chunk_by_id[chunk_id].page_number,
                    }
                    for chunk_id in dict.fromkeys(item.citation_chunk_ids)
                ],
            )
            session.add(question)
            questions.append(question)
        await session.commit()
        return mock, questions

    mock = MockExam(
        exam_id=exam.id,
        blueprint_id=blueprint_record.id if blueprint_record else None,
        title=f"{exam.title} · deterministic mock",
        instructions=str(exam.scenario.get("instructions", "")),
        duration_minutes=int(exam.rules.get("durationMinutes", 60)),
        max_score=int(
            exam.rules.get("totalPoints", sum(int(x.get("points", 0)) for x in exam.blueprint))
        ),
        generation_metadata={
            "provider": "deterministic",
            "model": "local-v2",
            "prompt_version": MOCK_PROMPT_VERSION,
            "schema_version": "generated-mock.v2",
            "validation_status": "valid",
            "blueprint_version": blueprint_record.version if blueprint_record else None,
        },
    )
    session.add(mock)
    await session.flush()
    questions = []
    position = 1
    for section in exam.blueprint:
        count = int(section.get("questionCount", 1))
        section_points = int(section.get("points", count))
        points_by_question = distribute_points(section_points, count)
        section_skills = [str(item) for item in section.get("skills", [])] or [
            slug(str(section.get("title", "core-knowledge")))
        ]
        for index in range(count):
            points = points_by_question[index]
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
                answer_key="A complete response states the key concept and relevant reasoning.",
                topic=section_skills[0],
                skill_ids=section_skills,
                rubric=fallback_rubric(points),
                grading_mode="rubric",
            )
            session.add(question)
            questions.append(question)
            position += 1
    await session.commit()
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


def normalized_answer(value: str) -> str:
    return " ".join(value.casefold().split())


def deterministic_objective_score(answer: str, answer_key: str, maximum: int) -> int:
    if not answer.strip():
        return 0
    candidates = [normalized_answer(item) for item in answer_key.split("|")]
    if normalized_answer(answer) in candidates:
        return maximum
    try:
        answer_number = float(answer.strip().replace(",", "."))
        key_number = float(answer_key.strip().replace(",", "."))
        if math.isclose(answer_number, key_number, rel_tol=1e-4, abs_tol=1e-4):
            return maximum
    except ValueError:
        pass
    return 0


async def cited_chunks(
    session: AsyncSession, questions: list[MockQuestion]
) -> dict[str, SourceChunkInput]:
    ids = {
        UUID(str(item["chunk_id"]))
        for question in questions
        for item in question.citations
        if item.get("chunk_id")
    }
    if not ids:
        return {}
    rows = (
        await session.execute(
            select(ArtifactChunk, Artifact)
            .join(Artifact, Artifact.id == ArtifactChunk.artifact_id)
            .where(ArtifactChunk.id.in_(ids))
        )
    ).all()
    return {
        str(chunk.id): SourceChunkInput(
            chunk_id=str(chunk.id),
            artifact_id=str(artifact.id),
            artifact_name=artifact.original_name,
            artifact_kind=artifact.kind.value,
            page_number=chunk.attributes.get("page_number"),
            text=chunk.text,
        )
        for chunk, artifact in rows
    }


def validate_evaluation_batch(
    batch: EvaluationBatch,
    questions: list[MockQuestion],
    answers: dict[UUID, str],
    chunks: dict[str, SourceChunkInput],
) -> list[str]:
    errors: list[str] = []
    expected = {str(item.id): item for item in questions}
    received = [item.question_id for item in batch.evaluations]
    if len(received) != len(set(received)):
        errors.append("Evaluation contains duplicate question IDs")
    if set(received) != set(expected):
        errors.append("Evaluation question IDs do not match the request")
    for item in batch.evaluations:
        question = expected.get(item.question_id)
        if question is None:
            continue
        rubric_dimensions = {
            str(dimension.get("id")): int(dimension.get("max_points", 0))
            for dimension in question.rubric.get("dimensions", [])
        }
        score_sum = 0
        for score in item.dimension_scores:
            maximum = rubric_dimensions.get(score.dimension_id)
            if maximum is None or score.awarded_points > maximum:
                errors.append(f"Invalid rubric score for question {item.question_id}")
            score_sum += score.awarded_points
            answer = answers.get(question.id, "")
            for quote in score.answer_evidence:
                if normalized_answer(quote) not in normalized_answer(answer):
                    errors.append(f"Unverified answer evidence for question {item.question_id}")
        if score_sum != item.suggested_points or score_sum > question.points:
            errors.append(f"Invalid total score for question {item.question_id}")
        for evidence in item.source_evidence:
            chunk = chunks.get(evidence.chunk_id)
            if chunk is None or normalized_answer(evidence.quote) not in normalized_answer(
                chunk.text
            ):
                errors.append(f"Unverified source evidence for question {item.question_id}")
    return errors


def deterministic_rubric_result(question: MockQuestion, answer: str) -> dict[str, Any]:
    if not answer.strip():
        awarded = 0
    elif len(answer.split()) >= 5:
        awarded = question.points
    else:
        awarded = question.points // 2
    return {
        "question_id": str(question.id),
        "awarded_points": awarded,
        "dimension_scores": [
            {
                "dimension_id": str(dimension.get("id", "accuracy")),
                "awarded_points": awarded if index == 0 else 0,
                "max_points": int(dimension.get("max_points", question.points)),
                "reason": "Deterministic fallback based on answer completeness.",
                "answer_evidence": [answer[:160]] if answer else [],
            }
            for index, dimension in enumerate(question.rubric.get("dimensions", []))
        ],
        "feedback": {
            "strength": "The response contains relevant reasoning." if answer else "",
            "improvement": (
                "Add a complete, source-grounded explanation." if awarded < question.points else ""
            ),
            "next_step": "Compare the response with the answer key and rubric.",
        },
        "source_evidence": [],
        "confidence": 0.35,
        "flags": ["deterministic_fallback"],
        "strategy": "deterministic_rubric",
    }


async def submit_attempt(
    session: AsyncSession,
    user_id: UUID,
    attempt_id: UUID,
    settings: Settings | None = None,
) -> Attempt:
    settings = settings or get_settings()
    attempt, mock, questions, responses = await get_attempt(session, user_id, attempt_id)
    if attempt.status == AttemptStatus.EVALUATED:
        return attempt
    exam = await get_exam(session, user_id, attempt.exam_id)
    pass_percentage = int(exam.rules.get("passPercentage", 50))
    answers = {response.question_id: response.answer.strip() for response in responses}
    chunks = await cited_chunks(session, questions)
    result_by_id: dict[str, dict[str, Any]] = {}
    open_questions: list[MockQuestion] = []
    for question in questions:
        answer = answers.get(question.id, "")
        if question.grading_mode == "objective":
            awarded = deterministic_objective_score(answer, question.answer_key, question.points)
            result_by_id[str(question.id)] = {
                "question_id": str(question.id),
                "awarded_points": awarded,
                "dimension_scores": [],
                "feedback": {
                    "strength": "The answer matches the key." if awarded else "",
                    "improvement": "Review the expected answer and source." if not awarded else "",
                    "next_step": "Reattempt a similar objective item.",
                },
                "source_evidence": [],
                "confidence": 1.0,
                "flags": [],
                "strategy": "deterministic_objective",
            }
        elif not answer:
            result_by_id[str(question.id)] = deterministic_rubric_result(question, answer)
        else:
            open_questions.append(question)

    evaluation_metadata = {
        "provider": "deterministic",
        "model": "local-v2",
        "prompt_version": EVALUATION_PROMPT_VERSION,
        "schema_version": "evaluation.v2",
        "retry_count": 0,
    }
    overall_feedback = "Review each question against its rubric and cited source."
    if open_questions and settings.vertex_configured and mock.generator.startswith("vertex:"):
        payload = EvaluationInput(
            exam_rules={"maximum_score": attempt.max_score},
            language="en",
            questions=[
                EvaluationQuestionInput(
                    question_id=str(question.id),
                    prompt=question.prompt,
                    student_answer=answers.get(question.id, ""),
                    maximum_points=question.points,
                    answer_key=question.answer_key,
                    rubric=question.rubric,
                    source_chunks=[
                        chunks[str(item["chunk_id"])]
                        for item in question.citations
                        if str(item.get("chunk_id")) in chunks
                    ],
                )
                for question in open_questions
            ],
        )
        await session.commit()
        provider = VertexAIProvider(settings)
        try:
            batch = await provider.evaluate_open_responses(payload)
            errors = validate_evaluation_batch(batch, open_questions, answers, chunks)
            retries = 0
            while errors and retries < settings.ai_validation_retries:
                retries += 1
                payload.validation_feedback = errors
                batch = await provider.evaluate_open_responses(payload)
                errors = validate_evaluation_batch(batch, open_questions, answers, chunks)
        except Exception as exc:
            raise AIServiceError(f"Evaluation failed: {str(exc)[:300]}") from exc
        if errors:
            raise AIServiceError("Evaluation failed validation: " + "; ".join(errors[:4]))
        overall_feedback = batch.overall_feedback
        evaluation_metadata = {
            "provider": provider.name,
            "model": provider.model,
            "prompt_version": EVALUATION_PROMPT_VERSION,
            "schema_version": "evaluation.v2",
            "input_hash": input_hash(payload),
            "retry_count": retries,
        }
        question_by_id = {str(item.id): item for item in open_questions}
        for item in batch.evaluations:
            question = question_by_id[item.question_id]
            max_by_dimension = {
                str(dimension.get("id")): int(dimension.get("max_points", 0))
                for dimension in question.rubric.get("dimensions", [])
            }
            result_by_id[item.question_id] = {
                "question_id": item.question_id,
                "awarded_points": min(question.points, item.suggested_points),
                "dimension_scores": [
                    {
                        **score.model_dump(mode="json"),
                        "max_points": max_by_dimension.get(score.dimension_id, 0),
                    }
                    for score in item.dimension_scores
                ],
                "feedback": item.feedback.model_dump(mode="json"),
                "source_evidence": [
                    entry.model_dump(mode="json") for entry in item.source_evidence
                ],
                "confidence": item.confidence,
                "flags": item.flags,
                "strategy": "vertex_rubric",
            }
    else:
        for question in open_questions:
            result_by_id[str(question.id)] = deterministic_rubric_result(
                question, answers.get(question.id, "")
            )

    await session.rollback()
    attempt, _, questions, _ = await get_attempt(session, user_id, attempt_id)
    if attempt.status == AttemptStatus.EVALUATED:
        return attempt
    score = 0
    section_totals: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    question_results: list[dict[str, Any]] = []
    weak_topics: list[str] = []
    for question in questions:
        evaluation_result = result_by_id[str(question.id)]
        awarded = max(0, min(question.points, int(evaluation_result["awarded_points"])))
        score += awarded
        section_totals[question.section_id][0] += awarded
        section_totals[question.section_id][1] += question.points
        normalized_score = awarded / max(1, question.points)
        if normalized_score < 0.7:
            weak_topics.extend(question.skill_ids)
        evidence = []
        for entry in evaluation_result["source_evidence"]:
            source = chunks.get(str(entry["chunk_id"]))
            evidence.append(
                {
                    **entry,
                    "artifact_name": source.artifact_name if source else None,
                    "page_number": source.page_number if source else None,
                }
            )
        question_result = {
            "question_id": str(question.id),
            "section_id": question.section_id,
            "question_number": question.position,
            "prompt": question.prompt,
            "question_type": question.question_type,
            "skill_ids": question.skill_ids,
            "awarded_points": awarded,
            "max_points": question.points,
            "normalized_score": round(normalized_score, 4),
            "strategy": evaluation_result["strategy"],
            "feedback": evaluation_result["feedback"],
            "dimension_scores": evaluation_result["dimension_scores"],
            "source_evidence": evidence,
            "confidence": evaluation_result["confidence"],
            "flags": evaluation_result["flags"],
        }
        question_results.append(question_result)
        session.add(
            QuestionEvaluation(
                attempt_id=attempt.id,
                question_id=question.id,
                strategy=str(evaluation_result["strategy"]),
                awarded_points=awarded,
                max_points=question.points,
                dimension_scores=evaluation_result["dimension_scores"],
                answer_evidence=[
                    quote
                    for dimension in evaluation_result["dimension_scores"]
                    for quote in dimension.get("answer_evidence", [])
                ],
                source_evidence=evidence,
                feedback=evaluation_result["feedback"],
                confidence=float(evaluation_result["confidence"]),
                flags=evaluation_result["flags"],
                evaluator_metadata=evaluation_metadata,
            )
        )
    section_results = [
        {
            "section_id": section_id,
            "awarded_points": values[0],
            "max_points": values[1],
            "percentage": round(values[0] / max(1, values[1]) * 100),
        }
        for section_id, values in section_totals.items()
    ]
    now = datetime.now(UTC)
    percentage = round(score / max(1, attempt.max_score) * 100)
    attempt.status = AttemptStatus.EVALUATED
    attempt.submitted_at = now
    attempt.duration_seconds = max(0, int((now - attempt.started_at).total_seconds()))
    attempt.score = score
    attempt.result = {
        "percentage": percentage,
        "pass_percentage": pass_percentage,
        "passed": percentage >= pass_percentage,
        "feedback": overall_feedback,
        "weak_topics": list(dict.fromkeys(weak_topics)),
        "evaluator": f"{evaluation_metadata['provider']}:{evaluation_metadata['model']}",
        "evaluator_metadata": evaluation_metadata,
        "question_results": question_results,
        "section_results": section_results,
        "evaluation_facts": [
            {
                "attempt_id": str(attempt.id),
                "question_id": item["question_id"],
                "skill_ids": item["skill_ids"],
                "section_id": item["section_id"],
                "question_type": item["question_type"],
                "awarded_points": item["awarded_points"],
                "max_points": item["max_points"],
                "normalized_score": item["normalized_score"],
                "evaluation_confidence": item["confidence"],
                "observed_at": now.isoformat(),
            }
            for item in question_results
        ],
    }
    await session.commit()
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
