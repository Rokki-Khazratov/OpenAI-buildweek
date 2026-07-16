"""Artifact parsing and PostgreSQL lifecycle coverage."""

import os
from collections.abc import AsyncIterator
from dataclasses import dataclass
from io import BytesIO
from typing import cast

import pymupdf
import pytest
from docx import Document
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr
from sqlalchemy import select, text

from app.core.config import Environment, Settings
from app.db.models.artifact import Artifact, ArtifactProcessingJob
from app.db.session import Database
from app.integrations.storage import ObjectMetadata
from app.main import create_app
from app.modules.artifacts.parsing import DocumentValidationError, chunk_document, parse_document
from app.modules.artifacts.processor import process_job


class MemoryStorage:
    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}
        self.last_key: str | None = None

    def presign_put(self, key: str, content_type: str, expires: int) -> str:
        self.last_key = key
        return f"memory://put/{key}?expires={expires}&type={content_type}"

    def presign_get(self, key: str, expires: int) -> str:
        return f"memory://get/{key}?expires={expires}"

    def head(self, key: str) -> ObjectMetadata:
        data, media_type = self.objects[key]
        return ObjectMetadata(
            size_bytes=len(data), content_type=media_type, etag="memory-etag", sha256=None
        )

    def get_bytes(self, key: str) -> bytes:
        return self.objects[key][0]

    def delete(self, key: str) -> None:
        self.objects.pop(key, None)

    def put(self, data: bytes, media_type: str) -> None:
        assert self.last_key is not None
        self.objects[self.last_key] = (data, media_type)


@dataclass(slots=True)
class ArtifactHarness:
    client: AsyncClient
    storage: MemoryStorage
    database: Database
    settings: Settings


@pytest.fixture
async def artifact_harness() -> AsyncIterator[ArtifactHarness]:
    database_url = os.getenv("TEST_DATABASE_URL")
    if database_url is None:
        pytest.skip("TEST_DATABASE_URL is not configured")
    settings = Settings(
        _env_file=None,
        environment=Environment.TEST,
        database_url=database_url,
        jwt_secret=SecretStr("integration-secret-longer-than-32-characters"),
        artifact_dispatch_jobs=False,
    )
    database = Database(database_url)
    storage = MemoryStorage()
    app = create_app(settings=settings, database=database, storage=storage)

    async def truncate() -> None:
        async with database.engine.begin() as connection:
            await connection.execute(
                text(
                    "TRUNCATE audit_events, artifact_chunks, artifact_pages, "
                    "artifact_processing_jobs, artifacts, attempt_responses, attempts, "
                    "mock_questions, mock_exams, class_exams, classes, exams, "
                    "workspace_members, workspaces, refresh_tokens, users "
                    "RESTART IDENTITY CASCADE"
                )
            )

    await truncate()
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            yield ArtifactHarness(client, storage, database, settings)
        await truncate()


async def auth_headers(client: AsyncClient, email: str) -> dict[str, str]:
    created = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "correct horse battery staple",
            "display_name": "Artifact Owner",
        },
    )
    assert created.status_code == 201
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "correct horse battery staple"},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def create_exam(client: AsyncClient, headers: dict[str, str]) -> str:
    subject = await client.post(
        "/api/v1/subjects", headers=headers, json={"title": "Artifact Subject"}
    )
    exam = await client.post(
        f"/api/v1/subjects/{subject.json()['id']}/exams",
        headers=headers,
        json={
            "title": "Artifact Exam",
            "blueprint": [
                {
                    "id": "a",
                    "title": "Part A",
                    "questionType": "Open",
                    "questionCount": 1,
                    "durationMinutes": 10,
                    "points": 10,
                }
            ],
        },
    )
    return cast(str, exam.json()["id"])


@pytest.mark.integration
async def test_artifact_upload_process_summary_isolation_and_delete(
    artifact_harness: ArtifactHarness,
) -> None:
    owner_headers = await auth_headers(artifact_harness.client, "artifact-owner@example.com")
    exam_id = await create_exam(artifact_harness.client, owner_headers)
    content = b"Exam rules and evidence. " * 80
    upload = await artifact_harness.client.post(
        f"/api/v1/exams/{exam_id}/artifacts/uploads",
        headers=owner_headers,
        json={
            "filename": "rules.txt",
            "kind": "notes",
            "media_type": "text/plain",
            "size_bytes": len(content),
        },
    )
    assert upload.status_code == 201, upload.text
    artifact_id = upload.json()["artifact"]["id"]
    artifact_harness.storage.put(content, "text/plain")

    complete = await artifact_harness.client.post(
        f"/api/v1/artifacts/{artifact_id}/complete", headers=owner_headers
    )
    assert complete.status_code == 200, complete.text
    assert complete.json()["processing_status"] == "queued"

    async with artifact_harness.database.session() as session:
        async with session.begin():
            job = await session.scalar(
                select(ArtifactProcessingJob).where(
                    ArtifactProcessingJob.artifact_id == artifact_id
                )
            )
            assert job is not None
            await process_job(
                session,
                artifact_harness.storage,
                artifact_harness.settings,
                job.id,
                worker_id="pytest",
            )

    ready = await artifact_harness.client.get(
        f"/api/v1/artifacts/{artifact_id}", headers=owner_headers
    )
    assert ready.status_code == 200
    assert ready.json()["processing_status"] == "ready"
    assert ready.json()["page_count"] == 1
    assert ready.json()["character_count"] > 100

    summary = await artifact_harness.client.get(
        f"/api/v1/artifacts/{artifact_id}/content-summary", headers=owner_headers
    )
    assert summary.status_code == 200
    assert summary.json()["chunk_count"] >= 2
    assert "Exam rules" in summary.json()["preview"]

    other_headers = await auth_headers(artifact_harness.client, "artifact-other@example.com")
    hidden = await artifact_harness.client.get(
        f"/api/v1/artifacts/{artifact_id}", headers=other_headers
    )
    assert hidden.status_code == 404

    deleted = await artifact_harness.client.delete(
        f"/api/v1/artifacts/{artifact_id}", headers=owner_headers
    )
    assert deleted.status_code == 204
    assert artifact_harness.storage.objects == {}
    async with artifact_harness.database.session() as session:
        assert await session.scalar(select(Artifact).where(Artifact.id == artifact_id)) is None


def test_parsers_and_chunking_are_deterministic() -> None:
    text_document = parse_document(
        b"alpha beta gamma " * 200,
        "text/plain",
        max_pages=10,
        max_characters=10000,
    )
    assert chunk_document(text_document) == chunk_document(text_document)
    assert len(chunk_document(text_document)) >= 3

    pdf = pymupdf.open()  # type: ignore[no-untyped-call]
    page = pdf.new_page()
    page.insert_text((72, 72), "Exam PDF text")
    pdf_bytes = pdf.tobytes()  # type: ignore[no-untyped-call]
    pdf.close()  # type: ignore[no-untyped-call]
    parsed_pdf = parse_document(pdf_bytes, "application/pdf", max_pages=10, max_characters=10000)
    assert parsed_pdf.pages[0].text == "Exam PDF text"

    output = BytesIO()
    docx = Document()
    docx.add_paragraph("Exam DOCX text")
    docx.save(output)
    parsed_docx = parse_document(
        output.getvalue(),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        max_pages=10,
        max_characters=10000,
    )
    assert parsed_docx.pages[0].text == "Exam DOCX text"

    with pytest.raises(DocumentValidationError, match="UTF-8"):
        parse_document(b"\xff\xfe", "text/plain", max_pages=10, max_characters=10000)
