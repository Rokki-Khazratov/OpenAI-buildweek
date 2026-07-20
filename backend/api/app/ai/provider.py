"""AI provider protocol and shared helpers."""

import hashlib
import json
from typing import Protocol

from pydantic import BaseModel

from app.ai.schemas import (
    BlueprintDraft,
    BlueprintExtractionInput,
    EvaluationBatch,
    EvaluationInput,
    GeneratedMock,
    MockGenerationInput,
)


class AIProvider(Protocol):
    name: str
    model: str

    async def extract_blueprint(self, payload: BlueprintExtractionInput) -> BlueprintDraft: ...

    async def generate_mock(self, payload: MockGenerationInput) -> GeneratedMock: ...

    async def evaluate_open_responses(self, payload: EvaluationInput) -> EvaluationBatch: ...


def input_hash(payload: object) -> str:
    value: object
    if isinstance(payload, BaseModel):
        value = payload.model_dump(mode="json")
    else:
        value = payload
    encoded = json.dumps(value, sort_keys=True, ensure_ascii=False, default=str).encode()
    return hashlib.sha256(encoded).hexdigest()
