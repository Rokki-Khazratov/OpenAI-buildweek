"""Google Vertex AI implementation of the provider-neutral AI contract."""

import asyncio

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.ai.prompts import blueprint_prompts, evaluation_prompts, mock_prompts
from app.ai.schemas import (
    BlueprintDraft,
    BlueprintExtractionInput,
    EvaluationBatch,
    EvaluationInput,
    GeneratedMock,
    MockGenerationInput,
)
from app.core.config import Settings


class _VertexBlueprintSection(BaseModel):
    id: str
    title: str
    question_type: str
    question_count: int
    duration_minutes: int
    points: int
    skills: list[str]
    confidence: float
    source_refs: list[str]


class _VertexBlueprintRules(BaseModel):
    duration_minutes: int
    total_points: int
    pass_percentage: int
    penalty: str
    allowed_materials: str
    grading_notes: str
    source_refs: list[str]


class _VertexSkill(BaseModel):
    id: str
    label: str


class _VertexUnresolved(BaseModel):
    path: str
    reason: str


class _VertexBlueprintDraft(BaseModel):
    sections: list[_VertexBlueprintSection]
    rules: _VertexBlueprintRules
    skill_taxonomy: list[_VertexSkill]
    unresolved_fields: list[_VertexUnresolved]
    overall_confidence: float


class _VertexRubricLevel(BaseModel):
    label: str
    points: int
    description: str


class _VertexRubricDimension(BaseModel):
    id: str
    label: str
    max_points: int
    criteria: list[_VertexRubricLevel]


class _VertexQuestionRubric(BaseModel):
    version: str
    dimensions: list[_VertexRubricDimension]


class _VertexGeneratedQuestion(BaseModel):
    section_id: str
    question_type: str
    prompt: str
    points: int
    answer_key: str
    skill_ids: list[str]
    difficulty: str
    grading_mode: str
    rubric: _VertexQuestionRubric
    citation_chunk_ids: list[str]


class _VertexGeneratedMock(BaseModel):
    title: str
    instructions: str
    questions: list[_VertexGeneratedQuestion]


class VertexAIProvider:
    name = "vertex"

    def __init__(self, settings: Settings) -> None:
        if settings.vertex_project is None:
            raise RuntimeError("Vertex AI is not configured")
        self.settings = settings
        self.model = settings.vertex_generation_model
        self.client = genai.Client(
            vertexai=True,
            project=settings.vertex_project,
            location=settings.vertex_location,
        )

    async def _generate(self, *, system: str, user: str, schema: type[BaseModel]) -> str:
        async with asyncio.timeout(self.settings.ai_request_timeout_seconds):
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=user,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0.15,
                ),
            )
        if not response.text:
            raise RuntimeError("Vertex AI returned no structured output")
        return response.text

    async def extract_blueprint(self, payload: BlueprintExtractionInput) -> BlueprintDraft:
        system, user = blueprint_prompts(payload)
        text = await self._generate(system=system, user=user, schema=_VertexBlueprintDraft)
        raw = _VertexBlueprintDraft.model_validate_json(text).model_dump(mode="json")
        for key in ("duration_minutes", "total_points", "pass_percentage"):
            if int(raw["rules"][key]) <= 0:
                raw["rules"][key] = None
        return BlueprintDraft.model_validate(raw)

    async def generate_mock(self, payload: MockGenerationInput) -> GeneratedMock:
        system, user = mock_prompts(payload)
        text = await self._generate(system=system, user=user, schema=_VertexGeneratedMock)
        raw = _VertexGeneratedMock.model_validate_json(text).model_dump(mode="json")
        for question in raw["questions"]:
            difficulty = str(question["difficulty"]).casefold()
            question["difficulty"] = (
                difficulty if difficulty in {"easy", "matched", "hard"} else "matched"
            )
            grading_mode = str(question["grading_mode"]).casefold()
            question["grading_mode"] = (
                grading_mode if grading_mode in {"objective", "rubric"} else "rubric"
            )
            question["rubric"]["version"] = "rubric.v1"
        return GeneratedMock.model_validate(raw)

    async def evaluate_open_responses(self, payload: EvaluationInput) -> EvaluationBatch:
        system, user = evaluation_prompts(payload)
        text = await self._generate(system=system, user=user, schema=EvaluationBatch)
        return EvaluationBatch.model_validate_json(text)


async def create_embeddings(settings: Settings, texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    provider = VertexAIProvider(settings)
    async with asyncio.timeout(settings.ai_request_timeout_seconds):
        response = await provider.client.aio.models.embed_content(
            model=settings.vertex_embedding_model,
            contents=texts,
            config=types.EmbedContentConfig(
                output_dimensionality=settings.vertex_embedding_dimensions
            ),
        )
    embeddings = response.embeddings or []
    values = [item.values or [] for item in embeddings]
    invalid_dimensions = any(len(item) != settings.vertex_embedding_dimensions for item in values)
    if len(values) != len(texts) or invalid_dimensions:
        raise RuntimeError("Vertex AI returned an invalid embedding batch")
    return values
