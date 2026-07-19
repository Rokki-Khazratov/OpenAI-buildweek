"""Vertex AI boundary for embeddings, grounded mocks, and evaluation."""

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.core.config import Settings


class GeneratedQuestion(BaseModel):
    section_id: str
    question_type: str
    prompt: str
    points: int = Field(ge=1)
    answer_key: str
    topic: str
    citation_chunk_ids: list[str] = Field(min_length=1)


class GeneratedMock(BaseModel):
    title: str
    instructions: str
    questions: list[GeneratedQuestion]


class QuestionEvaluation(BaseModel):
    question_id: str
    awarded_points: int = Field(ge=0)
    feedback: str
    strengths: list[str]
    gaps: list[str]


class AttemptEvaluation(BaseModel):
    evaluations: list[QuestionEvaluation]
    overall_feedback: str


def client_for(settings: Settings) -> genai.Client:
    if settings.vertex_project is None:
        raise RuntimeError("Vertex AI is not configured")
    return genai.Client(
        vertexai=True,
        project=settings.vertex_project,
        location=settings.vertex_location,
    )


async def create_embeddings(settings: Settings, texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    client = client_for(settings)
    response = await client.aio.models.embed_content(
        model=settings.vertex_embedding_model,
        contents=texts,
        config=types.EmbedContentConfig(output_dimensionality=settings.vertex_embedding_dimensions),
    )
    embeddings = response.embeddings or []
    values = [item.values or [] for item in embeddings]
    invalid_dimensions = any(len(item) != settings.vertex_embedding_dimensions for item in values)
    if len(values) != len(texts) or invalid_dimensions:
        raise RuntimeError("Vertex AI returned an invalid embedding batch")
    return values


async def generate_grounded_mock(
    settings: Settings,
    *,
    exam_context: str,
    source_context: str,
    adaptation_context: str,
) -> GeneratedMock:
    client = client_for(settings)
    response = await client.aio.models.generate_content(
        model=settings.vertex_generation_model,
        contents=(
            f"EXAM CONFIGURATION\n{exam_context}\n\n"
            f"ADAPTATION FROM PRIOR ATTEMPTS\n{adaptation_context or 'No prior evidence.'}\n\n"
            f"SOURCE CHUNKS\n{source_context}"
        ),
        config=types.GenerateContentConfig(
            system_instruction=(
                "Create a rigorous university mock exam using only SOURCE CHUNKS. Every "
                "question must cite at least one supplied chunk ID. Each answer key must be "
                "fully supported by those chunks. Follow the blueprint, language, and rules."
            ),
            response_mime_type="application/json",
            response_schema=GeneratedMock,
        ),
    )
    if not response.text:
        raise RuntimeError("Vertex AI returned no structured mock")
    return GeneratedMock.model_validate_json(response.text)


async def evaluate_attempt(
    settings: Settings, *, exam_context: str, question_context: str
) -> AttemptEvaluation:
    client = client_for(settings)
    response = await client.aio.models.generate_content(
        model=settings.vertex_generation_model,
        contents=f"EXAM RULES\n{exam_context}\n\nQUESTIONS AND ANSWERS\n{question_context}",
        config=types.GenerateContentConfig(
            system_instruction=(
                "Grade answers against the answer keys and cited evidence. Never exceed a "
                "question's maximum points. Give concise feedback and actionable knowledge gaps."
            ),
            response_mime_type="application/json",
            response_schema=AttemptEvaluation,
        ),
    )
    if not response.text:
        raise RuntimeError("Vertex AI returned no structured evaluation")
    return AttemptEvaluation.model_validate_json(response.text)
