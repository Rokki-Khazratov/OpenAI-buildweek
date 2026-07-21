"""Explicit Exam draft status behavior."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.api.schemas.exam import ExamCreateRequest, ExamUpdateRequest
from app.db.models.exam import Exam, ExamStatus
from app.modules.exams.service import create_exam, update_exam


def blueprint() -> list[dict[str, object]]:
    return [
        {
            "id": "part-a",
            "title": "Part A",
            "questionType": "Open response",
            "questionCount": 1,
            "durationMinutes": 30,
            "points": 20,
        }
    ]


@pytest.mark.asyncio
async def test_create_honors_explicit_draft_with_blueprint() -> None:
    session = MagicMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    payload = ExamCreateRequest(
        title="Work in progress",
        blueprint=blueprint(),
        status=ExamStatus.DRAFT,
    )

    with patch("app.modules.exams.service.get_owned_workspace", new=AsyncMock()):
        exam = await create_exam(session, uuid4(), uuid4(), payload)

    assert exam.status == ExamStatus.DRAFT


@pytest.mark.asyncio
async def test_update_honors_explicit_draft_after_configuration_changes() -> None:
    session = MagicMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    exam = Exam(
        id=uuid4(),
        workspace_id=uuid4(),
        title="Work in progress",
        blueprint=blueprint(),
        status=ExamStatus.READY,
        configuration_version=1,
    )
    payload = ExamUpdateRequest(
        blueprint=blueprint(),
        status=ExamStatus.DRAFT,
        configuration_version=1,
    )

    with patch(
        "app.modules.exams.service.get_owned_exam",
        new=AsyncMock(return_value=exam),
    ):
        updated = await update_exam(session, uuid4(), exam.id, payload)

    assert updated.status == ExamStatus.DRAFT
    assert updated.configuration_version == 2
