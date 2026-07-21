# Backend

The backend implements the P0 product loop plus the P1 artifact-ingestion foundation: application startup, structured logging, request IDs,
health endpoints, asynchronous PostgreSQL sessions, migrations, authentication, user profile
operations, ownership-protected Subject CRUD, multiple Exams per Subject, Classes scoped to an
entire Subject or selected Exams, versioned source-grounded blueprint extraction and approval,
validated mock generation, attempt autosave/submission, rubric evaluation, result history, basic statistics, private direct-to-object-storage
uploads, durable background processing, and deterministic PDF/DOCX/TXT parsing and chunking.

Embeddings, owned-exam vector retrieval, structured blueprint extraction, grounded mock generation,
source citations, and rubric evaluation are implemented with Vertex AI and `gemini-3.5-flash`
behind a provider-neutral AI interface. Authentication uses Google Application Default Credentials.
Without Vertex configuration the deterministic fallback remains active. Personal weak-skill
adaptation is implemented through the versioned `analytics.v1` engine; OCR and advanced cohort
analytics remain deferred.

## Implemented API

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET/PATCH /api/v1/me`
- `POST/GET /api/v1/workspaces`
- `GET/PATCH/DELETE /api/v1/workspaces/{workspace_id}`
- `POST/GET /api/v1/subjects`
- `GET/PATCH/DELETE /api/v1/subjects/{subject_id}`
- `POST/GET /api/v1/subjects/{subject_id}/exams`
- `GET/PATCH/DELETE /api/v1/exams/{exam_id}`
- `POST/GET /api/v1/subjects/{subject_id}/classes`
- `GET/PATCH/DELETE /api/v1/classes/{class_id}`
- `POST /api/v1/exams/{exam_id}/blueprints/extractions`
- `GET /api/v1/exams/{exam_id}/blueprints/current`
- `PATCH /api/v1/blueprints/{blueprint_id}`
- `POST /api/v1/blueprints/{blueprint_id}/approve`
- `POST /api/v1/blueprints/{blueprint_id}/retry`
- `POST /api/v1/exams/{exam_id}/mocks`
- `GET /api/v1/mocks/{mock_id}`
- `POST /api/v1/mocks/{mock_id}/attempts`
- `GET /api/v1/attempts/{attempt_id}`
- `PUT /api/v1/attempts/{attempt_id}/responses/{question_id}`
- `POST /api/v1/attempts/{attempt_id}/submit`
- `GET /api/v1/attempts/{attempt_id}/result`
- `GET /api/v1/exams/{exam_id}/attempts`
- `GET /api/v1/exams/{exam_id}/statistics`
- `GET /api/v1/exams/{exam_id}/analytics`
- `GET /api/v1/analytics/overview`
- `PUT /api/v1/exams/{exam_id}/publication`
- `DELETE /api/v1/exams/{exam_id}/publication`
- `GET /api/v1/library/publications`
- `GET /api/v1/library/publications/{publication_id}`
- `POST /api/v1/library/publications/{publication_id}/clone`
- `POST/GET /api/v1/classes/{class_id}/members`
- `GET /api/v1/classes/{class_id}/dashboard`
- `POST /api/v1/exams/{exam_id}/artifacts/uploads`
- `POST /api/v1/artifacts/{artifact_id}/complete`
- `GET /api/v1/exams/{exam_id}/artifacts`
- `GET/DELETE /api/v1/artifacts/{artifact_id}`
- `GET /api/v1/artifacts/{artifact_id}/download`
- `GET /api/v1/artifacts/{artifact_id}/content-summary`
- `POST /api/v1/artifacts/{artifact_id}/retry`

`/workspaces` remains a compatibility contract. New product surfaces use `/subjects`.

## Local setup

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
cp .env.example .env
docker compose -f compose.yaml up -d postgres redis minio minio-init
alembic upgrade head
uvicorn app.main:app --reload
# In a second terminal:
dramatiq app.modules.artifacts.tasks
```

Health endpoints:

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`

Quality checks:

```bash
ruff check .
ruff format --check .
mypy
pytest
alembic check
```

With the full Compose stack running, the real storage/queue smoke test is:

```bash
node ../scripts/p1-artifact-smoke.mjs
```

The full live Vertex smoke test covers upload, blueprint extraction and approval, mock generation,
attempt submission, and detailed evaluation:

```bash
node ../scripts/vertex-sandbox-smoke.mjs
```

For a rich local frontend workspace, run `node ../scripts/seed-local-demo.mjs`.
It creates the local-only account `alex.morgan@examtwin.app` with password `exam1234`.
