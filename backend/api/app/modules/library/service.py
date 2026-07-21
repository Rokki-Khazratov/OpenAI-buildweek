"""Safe Exam publication, discovery, and independent private cloning."""

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.ai.schemas import BlueprintDraft
from app.db.models.audit import AuditEvent
from app.db.models.blueprint import BlueprintStatus, ExamBlueprint
from app.db.models.exam import Exam, ExamStatus
from app.db.models.library import LibraryClone, LibraryPublication
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember, WorkspaceRole, WorkspaceVisibility
from app.modules.exams.service import ExamNotFoundError, get_owned_exam


class PublicationNotFoundError(LookupError):
    pass


class PublicationStateError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class PublicationView:
    publication: LibraryPublication
    publisher_name: str


@dataclass(frozen=True, slots=True)
class PublicationPage:
    items: list[PublicationView]
    total: int


@dataclass(frozen=True, slots=True)
class CloneResult:
    publication_id: UUID
    workspace_id: UUID
    exam_id: UUID
    already_cloned: bool


def safe_blueprint(content: dict[str, object]) -> dict[str, object]:
    """Validate the public contract and remove every source locator."""
    draft = BlueprintDraft.model_validate(content)
    payload = draft.model_dump(mode="json")
    for section in payload["sections"]:
        section.pop("source_refs", None)
    payload["rules"].pop("source_refs", None)
    payload["unresolved_fields"] = []
    return payload


async def _approved_blueprint(session: AsyncSession, exam_id: UUID) -> ExamBlueprint:
    record = await session.scalar(
        select(ExamBlueprint)
        .where(ExamBlueprint.exam_id == exam_id, ExamBlueprint.status == BlueprintStatus.APPROVED)
        .order_by(ExamBlueprint.version.desc())
    )
    if record is None:
        raise PublicationStateError("Approve the exam blueprint before publishing")
    return record


async def publish_exam(
    session: AsyncSession, owner_id: UUID, exam_id: UUID, rights_note: str
) -> PublicationView:
    exam = await get_owned_exam(session, owner_id, exam_id)
    workspace = await session.get(Workspace, exam.workspace_id)
    blueprint = await _approved_blueprint(session, exam_id)
    if workspace is None:
        raise ExamNotFoundError
    now = datetime.now(UTC)
    publication = await session.scalar(
        select(LibraryPublication).where(LibraryPublication.source_exam_id == exam_id)
    )
    values = {
        "publisher_id": owner_id,
        "title": exam.title,
        "description": exam.description,
        "subject_title": workspace.title,
        "university": workspace.university,
        "course_code": workspace.course_code,
        "exam_type": exam.exam_type,
        "language": exam.language,
        "blueprint_snapshot": safe_blueprint(blueprint.content),
        "rules_snapshot": dict(exam.rules),
        "scenario_snapshot": dict(exam.scenario),
        "source_configuration_version": exam.configuration_version,
        "blueprint_version": blueprint.version,
        "rights_note": rights_note.strip(),
        "is_published": True,
        "published_at": now,
    }
    if publication is None:
        publication = LibraryPublication(source_exam_id=exam_id, clone_count=0, **values)
        session.add(publication)
    else:
        for key, value in values.items():
            setattr(publication, key, value)
    session.add(
        AuditEvent(
            actor_id=owner_id,
            workspace_id=exam.workspace_id,
            action="library.published",
            details={"exam_id": str(exam_id), "blueprint_version": blueprint.version},
        )
    )
    await session.flush()
    await session.refresh(publication)
    publisher = await session.get(User, owner_id)
    return PublicationView(publication, publisher.display_name if publisher else "ExamTwin author")


async def unpublish_exam(session: AsyncSession, owner_id: UUID, exam_id: UUID) -> None:
    await get_owned_exam(session, owner_id, exam_id)
    publication = await session.scalar(
        select(LibraryPublication).where(LibraryPublication.source_exam_id == exam_id)
    )
    if publication is None:
        raise PublicationNotFoundError
    publication.is_published = False
    session.add(
        AuditEvent(
            actor_id=owner_id,
            workspace_id=None,
            action="library.unpublished",
            details={"exam_id": str(exam_id), "publication_id": str(publication.id)},
        )
    )
    await session.flush()


async def get_exam_publication(
    session: AsyncSession, owner_id: UUID, exam_id: UUID
) -> PublicationView:
    await get_owned_exam(session, owner_id, exam_id)
    row = (
        await session.execute(
            select(LibraryPublication, User.display_name)
            .join(User, User.id == LibraryPublication.publisher_id)
            .where(LibraryPublication.source_exam_id == exam_id)
        )
    ).one_or_none()
    if row is None:
        raise PublicationNotFoundError
    return PublicationView(row[0], row[1])


async def list_publications(
    session: AsyncSession,
    *,
    query: str | None,
    language: str | None,
    exam_type: str | None,
    limit: int,
    offset: int,
) -> PublicationPage:
    predicates: list[ColumnElement[bool]] = [LibraryPublication.is_published.is_(True)]
    if query and query.strip():
        pattern = f"%{query.strip()}%"
        predicates.append(
            or_(
                LibraryPublication.title.ilike(pattern),
                LibraryPublication.subject_title.ilike(pattern),
                LibraryPublication.university.ilike(pattern),
                LibraryPublication.course_code.ilike(pattern),
            )
        )
    if language:
        predicates.append(func.lower(LibraryPublication.language) == language.strip().lower())
    if exam_type:
        predicates.append(func.lower(LibraryPublication.exam_type) == exam_type.strip().lower())
    total = await session.scalar(
        select(func.count()).select_from(LibraryPublication).where(*predicates)
    )
    rows = (
        await session.execute(
            select(LibraryPublication, User.display_name)
            .join(User, User.id == LibraryPublication.publisher_id)
            .where(*predicates)
            .order_by(LibraryPublication.published_at.desc(), LibraryPublication.id)
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return PublicationPage([PublicationView(row[0], row[1]) for row in rows], total or 0)


async def get_publication(session: AsyncSession, publication_id: UUID) -> PublicationView:
    row = (
        await session.execute(
            select(LibraryPublication, User.display_name)
            .join(User, User.id == LibraryPublication.publisher_id)
            .where(
                LibraryPublication.id == publication_id,
                LibraryPublication.is_published.is_(True),
            )
        )
    ).one_or_none()
    if row is None:
        raise PublicationNotFoundError
    return PublicationView(row[0], row[1])


def _legacy_sections(snapshot: dict[str, object]) -> list[dict[str, object]]:
    sections = snapshot.get("sections", [])
    if not isinstance(sections, list):
        return []
    return [
        {
            "id": item["id"],
            "title": item["title"],
            "questionType": item["question_type"],
            "questionCount": item["question_count"],
            "durationMinutes": item["duration_minutes"],
            "points": item["points"],
            "skills": item.get("skills", []),
        }
        for item in sections
        if isinstance(item, dict)
    ]


async def clone_publication(
    session: AsyncSession, user_id: UUID, publication_id: UUID
) -> CloneResult:
    publication = (await get_publication(session, publication_id)).publication
    existing = await session.scalar(
        select(LibraryClone).where(
            LibraryClone.publication_id == publication_id, LibraryClone.user_id == user_id
        )
    )
    if existing is not None:
        return CloneResult(publication_id, existing.workspace_id, existing.exam_id, True)

    workspace = Workspace(
        owner_id=user_id,
        title=f"{publication.subject_title} · Library copy",
        university=publication.university,
        course_code=publication.course_code,
        subject=None,
        visibility=WorkspaceVisibility.PRIVATE,
        target_exam_date=None,
    )
    session.add(workspace)
    await session.flush()
    session.add(
        WorkspaceMember(workspace_id=workspace.id, user_id=user_id, role=WorkspaceRole.OWNER)
    )
    exam = Exam(
        workspace_id=workspace.id,
        title=publication.title,
        description=publication.description,
        exam_type=publication.exam_type,
        language=publication.language,
        pasted_context="",
        sources=[],
        blueprint=_legacy_sections(publication.blueprint_snapshot),
        rules=dict(publication.rules_snapshot),
        scenario=dict(publication.scenario_snapshot),
        configuration_version=publication.source_configuration_version,
        status=ExamStatus.READY,
    )
    session.add(exam)
    await session.flush()
    encoded = json.dumps(publication.blueprint_snapshot, sort_keys=True).encode()
    digest = hashlib.sha256(encoded).hexdigest()
    session.add(
        ExamBlueprint(
            exam_id=exam.id,
            version=publication.blueprint_version,
            status=BlueprintStatus.APPROVED,
            content=dict(publication.blueprint_snapshot),
            source_artifact_ids=[],
            source_revision_hash=digest,
            provider="library_clone",
            model="snapshot",
            prompt_version="library.v1",
            schema_version="blueprint.v1",
            input_hash=digest,
            idempotency_key=f"library:{publication.id}",
            overall_confidence=float(publication.blueprint_snapshot.get("overall_confidence", 1)),
            validation_errors=[],
            approved_by=user_id,
            approved_at=datetime.now(UTC),
        )
    )
    provenance = LibraryClone(
        publication_id=publication.id,
        user_id=user_id,
        workspace_id=workspace.id,
        exam_id=exam.id,
    )
    session.add(provenance)
    publication.clone_count += 1
    session.add(
        AuditEvent(
            actor_id=user_id,
            workspace_id=workspace.id,
            action="library.cloned",
            details={
                "publication_id": str(publication.id),
                "source_exam_id": str(publication.source_exam_id),
            },
        )
    )
    await session.flush()
    return CloneResult(publication.id, workspace.id, exam.id, False)
