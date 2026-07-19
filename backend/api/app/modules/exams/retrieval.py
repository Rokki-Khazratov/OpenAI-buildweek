"""Owned-exam retrieval over ingested artifact chunks."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models.artifact import Artifact, ArtifactChunk, ProcessingStatus
from app.integrations.vertex_ai import create_embeddings


@dataclass(frozen=True)
class RetrievedChunk:
    id: UUID
    artifact_id: UUID
    text: str
    page_number: int | None


async def retrieve_exam_chunks(
    session: AsyncSession,
    settings: Settings,
    exam_id: UUID,
    query: str,
) -> list[RetrievedChunk]:
    statement = (
        select(ArtifactChunk, Artifact)
        .join(Artifact, Artifact.id == ArtifactChunk.artifact_id)
        .where(Artifact.exam_id == exam_id, Artifact.processing_status == ProcessingStatus.READY)
    )
    if settings.vertex_configured:
        query_embedding = (await create_embeddings(settings, [query]))[0]
        statement = statement.where(ArtifactChunk.embedding.is_not(None)).order_by(
            ArtifactChunk.embedding.cosine_distance(query_embedding)
        )
    else:
        statement = statement.order_by(ArtifactChunk.chunk_index)
    rows = (await session.execute(statement.limit(settings.retrieval_chunk_limit))).all()
    return [
        RetrievedChunk(
            id=chunk.id,
            artifact_id=artifact.id,
            text=chunk.text,
            page_number=chunk.attributes.get("page_number"),
        )
        for chunk, artifact in rows
    ]
