"""Live, database-free Vertex AI grounded-mock sandbox."""

import asyncio
import json

from app.core.config import Settings
from app.integrations.vertex_ai import create_embeddings, generate_grounded_mock

CHUNK_IDS = {
    "11111111-1111-1111-1111-111111111111",
    "22222222-2222-2222-2222-222222222222",
}


async def main() -> None:
    settings = Settings(_env_file="backend/.env")
    source_context = """
[chunk:11111111-1111-1111-1111-111111111111 artifact:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa page:1]
The first law of thermodynamics states that energy is conserved. The change in internal
energy equals heat added to the system minus work done by the system: ΔU = Q - W.

[chunk:22222222-2222-2222-2222-222222222222 artifact:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa page:2]
For an ideal gas, PV = nRT. During a reversible adiabatic process Q = 0, and the state
variables obey PV^gamma = constant.
""".strip()
    exam_context = json.dumps(
        {
            "title": "Thermodynamics grounded mock",
            "language": "en",
            "blueprint": [
                {
                    "id": "thermo",
                    "title": "Thermodynamics",
                    "questionType": "Open response",
                    "questionCount": 2,
                    "points": 20,
                }
            ],
            "rules": {"durationMinutes": 20, "totalPoints": 20},
        }
    )
    embeddings = await create_embeddings(settings, [source_context])
    mock = await generate_grounded_mock(
        settings,
        exam_context=exam_context,
        source_context=source_context,
        adaptation_context="No prior attempts.",
    )
    if len(embeddings[0]) != settings.vertex_embedding_dimensions:
        raise RuntimeError("Embedding dimensionality does not match configuration")
    if len(mock.questions) != 2:
        raise RuntimeError(f"Expected 2 questions, received {len(mock.questions)}")
    for question in mock.questions:
        if not question.prompt.strip() or not question.answer_key.strip():
            raise RuntimeError("Vertex returned an incomplete question")
        citations = set(question.citation_chunk_ids)
        if not citations or not citations <= CHUNK_IDS:
            raise RuntimeError(
                f"Vertex returned invalid citations: {sorted(citations)}"
            )

    print(
        json.dumps(
            {
                "status": "passed",
                "model": settings.vertex_generation_model,
                "embedding_dimensions": len(embeddings[0]),
                "title": mock.title,
                "questions": [
                    {
                        "prompt": question.prompt,
                        "points": question.points,
                        "citations": question.citation_chunk_ids,
                    }
                    for question in mock.questions
                ],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
