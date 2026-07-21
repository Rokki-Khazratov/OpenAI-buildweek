"""Exam Library HTTP endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.library import (
    LibraryCloneResponse,
    LibraryPublicationListResponse,
    LibraryPublicationResponse,
    PublicationUpsertRequest,
)
from app.db.dependencies import get_session
from app.modules.auth.dependencies import WorkspaceReadUser, WorkspaceWriteUser
from app.modules.exams.service import ExamNotFoundError
from app.modules.library.service import (
    PublicationNotFoundError,
    PublicationStateError,
    PublicationView,
    clone_publication,
    get_exam_publication,
    get_publication,
    list_publications,
    publish_exam,
    unpublish_exam,
)

router = APIRouter()
SessionDependency = Annotated[AsyncSession, Depends(get_session)]


def response_model(view: PublicationView, *, owner: bool = False) -> LibraryPublicationResponse:
    item = view.publication
    return LibraryPublicationResponse(
        id=item.id,
        source_exam_id=item.source_exam_id if owner else None,
        title=item.title,
        description=item.description,
        subject_title=item.subject_title,
        university=item.university,
        course_code=item.course_code,
        exam_type=item.exam_type,
        language=item.language,
        blueprint=item.blueprint_snapshot,
        rules=item.rules_snapshot,
        scenario=item.scenario_snapshot,
        source_configuration_version=item.source_configuration_version,
        blueprint_version=item.blueprint_version,
        rights_note=item.rights_note,
        publisher_name=view.publisher_name,
        clone_count=item.clone_count,
        is_published=item.is_published,
        published_at=item.published_at,
    )


@router.put("/exams/{exam_id}/publication")
async def publish(
    exam_id: UUID,
    payload: PublicationUpsertRequest,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
) -> LibraryPublicationResponse:
    try:
        async with session.begin():
            view = await publish_exam(session, current_user.id, exam_id, payload.rights_note)
    except ExamNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Exam not found") from exc
    except PublicationStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return response_model(view, owner=True)


@router.get("/exams/{exam_id}/publication")
async def exam_publication(
    exam_id: UUID, current_user: WorkspaceWriteUser, session: SessionDependency
) -> LibraryPublicationResponse:
    try:
        return response_model(
            await get_exam_publication(session, current_user.id, exam_id), owner=True
        )
    except (ExamNotFoundError, PublicationNotFoundError) as exc:
        raise HTTPException(status_code=404, detail="Publication not found") from exc


@router.delete("/exams/{exam_id}/publication", status_code=status.HTTP_204_NO_CONTENT)
async def unpublish(
    exam_id: UUID,
    current_user: WorkspaceWriteUser,
    session: SessionDependency,
    response: Response,
) -> None:
    try:
        async with session.begin():
            await unpublish_exam(session, current_user.id, exam_id)
    except (ExamNotFoundError, PublicationNotFoundError) as exc:
        raise HTTPException(status_code=404, detail="Publication not found") from exc
    response.status_code = status.HTTP_204_NO_CONTENT


@router.get("/library/publications")
async def discover(
    current_user: WorkspaceReadUser,
    session: SessionDependency,
    query: str | None = None,
    language: str | None = None,
    exam_type: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 24,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> LibraryPublicationListResponse:
    page = await list_publications(
        session,
        query=query,
        language=language,
        exam_type=exam_type,
        limit=limit,
        offset=offset,
    )
    return LibraryPublicationListResponse(
        items=[response_model(item) for item in page.items],
        total=page.total,
        limit=limit,
        offset=offset,
    )


@router.get("/library/publications/{publication_id}")
async def preview(
    publication_id: UUID, current_user: WorkspaceReadUser, session: SessionDependency
) -> LibraryPublicationResponse:
    try:
        return response_model(await get_publication(session, publication_id))
    except PublicationNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Publication not found") from exc


@router.post("/library/publications/{publication_id}/clone")
async def clone(
    publication_id: UUID, current_user: WorkspaceWriteUser, session: SessionDependency
) -> LibraryCloneResponse:
    try:
        async with session.begin():
            result = await clone_publication(session, current_user.id, publication_id)
    except PublicationNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Publication not found") from exc
    return LibraryCloneResponse(
        publication_id=result.publication_id,
        subject_id=result.workspace_id,
        exam_id=result.exam_id,
        already_cloned=result.already_cloned,
    )
