"""Compatibility wrappers around the provider-neutral Vertex implementation."""

import json
import re

from app.ai.schemas import GeneratedMock, MockGenerationInput, SourceChunkInput
from app.ai.vertex import VertexAIProvider, create_embeddings
from app.core.config import Settings


async def generate_grounded_mock(
    settings: Settings,
    *,
    exam_context: str,
    source_context: str,
    adaptation_context: str,
) -> GeneratedMock:
    """Keep the existing smoke script working while business code moves to AIProvider."""

    provider = VertexAIProvider(settings)
    chunks: list[SourceChunkInput] = []
    pattern = re.compile(
        r"\[chunk:(?P<chunk>[^ ]+) artifact:(?P<artifact>[^ ]+) page:(?P<page>\d+)\]\n"
        r"(?P<text>.*?)(?=\n\n\[chunk:|\Z)",
        re.DOTALL,
    )
    for match in pattern.finditer(source_context.strip()):
        chunks.append(
            SourceChunkInput(
                chunk_id=match.group("chunk"),
                artifact_id=match.group("artifact"),
                artifact_name="Smoke source",
                artifact_kind="notes",
                page_number=int(match.group("page")),
                text=match.group("text").strip(),
            )
        )
    if not chunks:
        chunks.append(
            SourceChunkInput(
                chunk_id="legacy-smoke-chunk",
                artifact_id="legacy-smoke-artifact",
                artifact_name="Smoke source",
                artifact_kind="notes",
                page_number=1,
                text=source_context,
            )
        )
    return await provider.generate_mock(
        MockGenerationInput(
            exam_context=json.loads(exam_context),
            chunks=chunks,
            adaptation_context={"legacy_context": adaptation_context},
        )
    )


__all__ = ["create_embeddings", "generate_grounded_mock"]
