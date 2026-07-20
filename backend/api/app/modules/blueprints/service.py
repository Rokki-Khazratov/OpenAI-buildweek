"""Versioned blueprint extraction and human approval lifecycle."""

import hashlib
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompts import BLUEPRINT_PROMPT_VERSION
from app.ai.provider import input_hash
from app.ai.schemas import (
    BlueprintDraft,
    BlueprintExtractionInput,
    BlueprintRulesDraft,
    BlueprintSectionDraft,
    SkillDefinition,
    SourceChunkInput,
)
from app.ai.validators import validate_blueprint
from app.ai.vertex import VertexAIProvider
from app.core.config import Settings
from app.db.models.artifact import Artifact, ArtifactChunk, ProcessingStatus
from app.db.models.blueprint import BlueprintStatus, ExamBlueprint
from app.db.models.exam import ExamStatus
from app.modules.exams.service import get_owned_exam

BLUEPRINT_SCHEMA_VERSION = "blueprint.v2"


class BlueprintNotFoundError(LookupError):
    pass


class BlueprintStateError(ValueError):
    pass


def blueprint_response_content(
    draft: BlueprintDraft, chunks: list[SourceChunkInput]
) -> dict[str, Any]:
    content = draft.model_dump(mode="json")
    used_ids = {source_id for section in draft.sections for source_id in section.source_refs} | set(
        draft.rules.source_refs
    )
    content["evidence"] = [
        {
            "chunk_id": item.chunk_id,
            "artifact_id": item.artifact_id,
            "artifact_name": item.artifact_name,
            "artifact_kind": item.artifact_kind,
            "page_number": item.page_number,
            "excerpt": item.text[:280].strip(),
        }
        for item in chunks
        if item.chunk_id in used_ids
    ]
    return content


async def extraction_chunks(
    session: AsyncSession,
    exam_id: UUID,
    artifact_ids: list[UUID] | None,
) -> tuple[list[SourceChunkInput], list[Artifact], str]:
    statement = (
        select(ArtifactChunk, Artifact)
        .join(Artifact, Artifact.id == ArtifactChunk.artifact_id)
        .where(Artifact.exam_id == exam_id, Artifact.processing_status == ProcessingStatus.READY)
        .order_by(Artifact.kind, Artifact.id, ArtifactChunk.chunk_index)
        .limit(40)
    )
    if artifact_ids:
        statement = statement.where(Artifact.id.in_(artifact_ids))
    rows = (await session.execute(statement)).all()
    if not rows:
        raise BlueprintStateError("Add and process at least one context file before extraction")
    chunks = [
        SourceChunkInput(
            chunk_id=str(chunk.id),
            artifact_id=str(artifact.id),
            artifact_name=artifact.original_name,
            artifact_kind=artifact.kind.value,
            page_number=chunk.attributes.get("page_number"),
            text=chunk.text,
        )
        for chunk, artifact in rows
    ]
    artifacts_by_id = {artifact.id: artifact for _, artifact in rows}
    artifacts = list(artifacts_by_id.values())
    revision_data = "|".join(
        sorted(f"{item.id}:{item.sha256 or ''}:{item.updated_at.isoformat()}" for item in artifacts)
    )
    return chunks, artifacts, hashlib.sha256(revision_data.encode()).hexdigest()


def deterministic_draft(exam: Any, chunks: list[SourceChunkInput]) -> BlueprintDraft:
    source_id = chunks[0].chunk_id
    existing = list(exam.blueprint)
    if existing:
        sections = [
            BlueprintSectionDraft(
                id=str(item.get("id", f"section-{index + 1}")),
                title=str(item.get("title", f"Section {index + 1}")),
                question_type=str(item.get("questionType", "Open response")),
                question_count=int(item.get("questionCount", 1)),
                duration_minutes=int(item.get("durationMinutes", 10)),
                points=int(item.get("points", 10)),
                skills=[f"{item.get('id', f'section-{index + 1}')!s}-core"],
                confidence=0.35,
                source_refs=[source_id],
            )
            for index, item in enumerate(existing)
        ]
    else:
        sections = [
            BlueprintSectionDraft(
                id="core-knowledge",
                title="Core knowledge",
                question_type="Open response",
                question_count=3,
                duration_minutes=30,
                points=30,
                skills=["core-knowledge"],
                confidence=0.2,
                source_refs=[source_id],
            )
        ]
    rules = BlueprintRulesDraft(
        duration_minutes=int(
            exam.rules.get("durationMinutes", sum(x.duration_minutes for x in sections))
        ),
        total_points=int(exam.rules.get("totalPoints", sum(x.points for x in sections))),
        pass_percentage=int(exam.rules.get("passPercentage", 50)),
        penalty=str(exam.rules.get("penalty", "")),
        allowed_materials=str(exam.rules.get("allowedMaterials", "")),
        grading_notes=str(exam.rules.get("gradingNotes", "")),
        source_refs=[source_id],
    )
    return BlueprintDraft(
        sections=sections,
        rules=rules,
        skill_taxonomy=[
            SkillDefinition(id=skill_id, label=section.title)
            for section in sections
            for skill_id in section.skills
        ],
        unresolved_fields=[],
        overall_confidence=0.3,
    )


async def get_current_blueprint(
    session: AsyncSession, owner_id: UUID, exam_id: UUID
) -> ExamBlueprint:
    await get_owned_exam(session, owner_id, exam_id)
    blueprint = await session.scalar(
        select(ExamBlueprint)
        .where(ExamBlueprint.exam_id == exam_id)
        .order_by(ExamBlueprint.version.desc())
    )
    if blueprint is None:
        raise BlueprintNotFoundError
    return blueprint


async def get_owned_blueprint(
    session: AsyncSession, owner_id: UUID, blueprint_id: UUID
) -> ExamBlueprint:
    blueprint = await session.scalar(select(ExamBlueprint).where(ExamBlueprint.id == blueprint_id))
    if blueprint is None:
        raise BlueprintNotFoundError
    await get_owned_exam(session, owner_id, blueprint.exam_id)
    return blueprint


async def extract_blueprint(
    session: AsyncSession,
    owner_id: UUID,
    exam_id: UUID,
    settings: Settings,
    *,
    artifact_ids: list[UUID] | None,
    idempotency_key: str | None,
) -> ExamBlueprint:
    exam = await get_owned_exam(session, owner_id, exam_id)
    if idempotency_key:
        existing = await session.scalar(
            select(ExamBlueprint).where(
                ExamBlueprint.exam_id == exam_id,
                ExamBlueprint.idempotency_key == idempotency_key,
            )
        )
        if existing is not None:
            return existing
    chunks, artifacts, revision_hash = await extraction_chunks(session, exam_id, artifact_ids)
    version = (
        int(
            await session.scalar(
                select(func.coalesce(func.max(ExamBlueprint.version), 0)).where(
                    ExamBlueprint.exam_id == exam_id
                )
            )
            or 0
        )
        + 1
    )
    payload = BlueprintExtractionInput(
        exam_title=exam.title,
        exam_description=exam.description or "",
        exam_type=exam.exam_type or "",
        language=exam.language,
        pasted_context=exam.pasted_context,
        existing_blueprint=exam.blueprint,
        existing_rules=exam.rules,
        chunks=chunks,
    )
    provider_name = "vertex" if settings.vertex_configured else "deterministic"
    model = settings.vertex_generation_model if settings.vertex_configured else "local-v1"
    record = ExamBlueprint(
        exam_id=exam.id,
        version=version,
        status=BlueprintStatus.EXTRACTING,
        source_artifact_ids=[str(item.id) for item in artifacts],
        source_revision_hash=revision_hash,
        provider=provider_name,
        model=model,
        prompt_version=BLUEPRINT_PROMPT_VERSION,
        schema_version=BLUEPRINT_SCHEMA_VERSION,
        input_hash=input_hash(payload),
        idempotency_key=idempotency_key,
    )
    session.add(record)
    await session.commit()
    record_id = record.id

    try:
        if settings.vertex_configured:
            provider = VertexAIProvider(settings)
            draft = await provider.extract_blueprint(payload)
        else:
            draft = deterministic_draft(exam, chunks)
        errors = validate_blueprint(draft, allowed_chunk_ids={item.chunk_id for item in chunks})
        retries = 0
        while errors and settings.vertex_configured and retries < settings.ai_validation_retries:
            retries += 1
            payload.validation_feedback = [item["message"] for item in errors]
            draft = await provider.extract_blueprint(payload)
            errors = validate_blueprint(draft, allowed_chunk_ids={item.chunk_id for item in chunks})
        final_record = await session.get(ExamBlueprint, record_id)
        assert final_record is not None
        final_record.content = blueprint_response_content(draft, chunks)
        final_record.overall_confidence = draft.overall_confidence
        final_record.validation_errors = errors
        final_record.status = BlueprintStatus.FAILED if errors else BlueprintStatus.DRAFT
        if errors:
            final_record.error_code = "validation_failed"
            final_record.error_message = "AI output did not satisfy the blueprint contract"
    except Exception as exc:
        await session.rollback()
        final_record = await session.get(ExamBlueprint, record_id)
        assert final_record is not None
        final_record.status = BlueprintStatus.FAILED
        final_record.error_code = "provider_error"
        final_record.error_message = str(exc)[:500]
    await session.commit()
    await session.refresh(final_record)
    return final_record


async def update_blueprint_draft(
    session: AsyncSession,
    owner_id: UUID,
    blueprint_id: UUID,
    draft: BlueprintDraft,
) -> ExamBlueprint:
    record = await get_owned_blueprint(session, owner_id, blueprint_id)
    if record.status not in {BlueprintStatus.DRAFT, BlueprintStatus.STALE, BlueprintStatus.FAILED}:
        raise BlueprintStateError("Only a draft, stale, or failed blueprint can be edited")
    evidence = list(record.content.get("evidence", []))
    allowed = {str(item.get("chunk_id")) for item in evidence}
    errors = validate_blueprint(draft, allowed_chunk_ids=allowed)
    record.content = {**draft.model_dump(mode="json"), "evidence": evidence}
    record.overall_confidence = draft.overall_confidence
    record.validation_errors = errors
    record.error_code = "validation_failed" if errors else None
    record.error_message = "Review the highlighted blueprint fields" if errors else None
    record.status = BlueprintStatus.FAILED if errors else BlueprintStatus.DRAFT
    await session.flush()
    return record


async def approve_blueprint(
    session: AsyncSession, owner_id: UUID, blueprint_id: UUID
) -> ExamBlueprint:
    record = await get_owned_blueprint(session, owner_id, blueprint_id)
    if record.status != BlueprintStatus.DRAFT:
        raise BlueprintStateError("Only a valid draft can be approved")
    draft = BlueprintDraft.model_validate(record.content)
    if draft.unresolved_fields:
        raise BlueprintStateError("Resolve every unresolved field before approval")
    if (
        draft.rules.duration_minutes is None
        or draft.rules.total_points is None
        or draft.rules.pass_percentage is None
    ):
        raise BlueprintStateError("Duration, total points, and pass percentage are required")
    evidence = list(record.content.get("evidence", []))
    errors = validate_blueprint(
        draft, allowed_chunk_ids={str(item.get("chunk_id")) for item in evidence}
    )
    if errors:
        raise BlueprintStateError(errors[0]["message"])
    exam = await get_owned_exam(session, owner_id, record.exam_id)
    await session.execute(
        update(ExamBlueprint)
        .where(
            ExamBlueprint.exam_id == record.exam_id,
            ExamBlueprint.status == BlueprintStatus.APPROVED,
            ExamBlueprint.id != record.id,
        )
        .values(status=BlueprintStatus.STALE)
    )
    exam.blueprint = [
        {
            "id": item.id,
            "title": item.title,
            "questionType": item.question_type,
            "questionCount": item.question_count,
            "durationMinutes": item.duration_minutes,
            "points": item.points,
            "skills": item.skills,
        }
        for item in draft.sections
    ]
    exam.rules = {
        "durationMinutes": draft.rules.duration_minutes,
        "totalPoints": draft.rules.total_points,
        "passPercentage": draft.rules.pass_percentage,
        "penalty": draft.rules.penalty,
        "allowedMaterials": draft.rules.allowed_materials,
        "gradingNotes": draft.rules.grading_notes,
    }
    exam.configuration_version += 1
    exam.status = ExamStatus.READY
    record.status = BlueprintStatus.APPROVED
    record.approved_by = owner_id
    record.approved_at = datetime.now(UTC)
    await session.flush()
    return record


async def mark_exam_blueprints_stale(session: AsyncSession, exam_id: UUID) -> None:
    await session.execute(
        update(ExamBlueprint)
        .where(
            ExamBlueprint.exam_id == exam_id,
            ExamBlueprint.status == BlueprintStatus.APPROVED,
        )
        .values(status=BlueprintStatus.STALE)
    )
