# ExamTwin

> Build a faithful digital twin of a real exam, practise it under realistic conditions, and turn every attempt into a better next mock.

ExamTwin is an adaptive exam-preparation platform created for OpenAI Build Week. It helps students organise university exams, attach the material that defines each exam, describe its structure and rules, run a focused mock session, and retain results for future feedback and adaptation.

The product is deliberately exam-centred:

- a **Subject** is a lightweight category such as Quantum Physics;
- an **Exam** owns its context files, blueprint, scenario, timing, scoring rules, attempts, feedback and statistics;
- a **Class** shares either a whole Subject or selected Exams with a group;
- an **Attempt** is an archived mock run with answers, score, duration and feedback.

## Current status

The repository contains a working, API-backed P0 product, the complete P1 artifact pipeline, and an opt-in P2 grounded-AI loop. Demo mode remains available for visual review, while normal mode persists the complete core flow in PostgreSQL.

| Area | Status |
|---|---|
| Authentication and profile | Implemented in the API and frontend flows |
| Subject CRUD | Implemented |
| Nested Exam CRUD | Implemented |
| Exam data, blueprint, scenario and rules editor | Persisted through the API with optimistic configuration versions |
| Exam Run simulation | Backend-generated mock, durable attempt, autosave, reload/resume and immutable submit |
| Exam statistics | Initial low-confidence overview implemented |
| Class CRUD and exam scoping | Implemented |
| PostgreSQL models and migrations | Implemented for the complete P0 domain, including mocks, questions, attempts and responses |
| Artifact ingestion and retrieval | Implemented: private upload, parsing, chunking, embeddings and owned-exam vector retrieval |
| Vertex AI generation and evaluation | Implemented with `gemini-3.5-flash` when `APP_VERTEX_PROJECT` is configured; deterministic fallback remains available |
| Background worker pipeline | Implemented with durable Dramatiq/Redis jobs and restart-safe retries |

The UI distinguishes the deterministic fallback from Vertex AI generation. AI questions are grounded in retrieved chunks, retain source citations, and use prior weak-topic evidence to adapt later mocks.

## Product preview

All product images below were captured from the running local application in the native browser at a laptop/desktop responsive breakpoint. Each screenshot includes the complete page width; no interface sections are cropped or reconstructed.

### Dashboard

The home view keeps the next preparation action prominent and shows the student’s current exam context.

![ExamTwin dashboard](materials/01-dashboard.jpg)

### Subjects

Subjects are intentionally simple categories. Exam-specific readiness, dates and content live on Exams instead.

![Subjects overview](materials/02-subjects.jpg)

### Subject workspace

Each Subject exposes its nested Exams and Classes without becoming a second exam-detail surface.

![Subject detail with nested exams](materials/03-subject-detail.jpg)

### Exams

The global Exams index provides a cross-subject view and the primary creation entry point.

![Exams overview](materials/04-exams.jpg)

### Exam workspace

Exam Detail is the control centre for data sources, blueprint, scenario, rules and attempt history.

![Exam detail workspace](materials/05-exam-detail.jpg)

### Five-step exam creation

The creation flow separates basics, data, blueprint, generation scenario/rules and final review.

![Exam creation wizard](materials/06-exam-create.jpg)

### Focused Exam Run

The simulation uses a distraction-free shell and prepares a mock from the configured exam structure.

![Exam Run preparation screen](materials/07-exam-run.jpg)

### Exam statistics

Statistics are scoped to an Exam and clearly label the confidence of insights while attempt coverage is still low.

![Exam statistics](materials/08-exam-statistics.jpg)

### Classes

Classes can be scoped to a complete Subject or a selected group of Exams.

![Classes overview](materials/09-classes.jpg)

## Why ExamTwin

Students usually prepare from fragmented notes, syllabi, rubrics, past papers and generic question banks. Conventional generators may cover the same topic, but they rarely reproduce the actual constraints that shape performance: section order, question types, point distribution, allowed materials, time pressure and grading rules.

ExamTwin treats those constraints as first-class data. Its target feedback loop is:

1. Create a Subject category.
2. Create an Exam inside that Subject.
3. Add past papers, rubrics, notes, learning targets and other context.
4. Review the extracted or manually entered blueprint.
5. Configure scenario and rules such as timing, points, pass mark and penalties.
6. Generate a grounded mock exam.
7. Complete it in the focused Exam Run interface.
8. Archive answers, result and feedback.
9. Use evidence from previous attempts to produce a more useful next mock.

## Domain model

```text
User
└── Subject (category)
    ├── Exam
    │   ├── Data sources / context files
    │   ├── Blueprint sections
    │   ├── Generation scenario
    │   ├── Rules and grading notes
    │   └── Attempts
    │       ├── Answers
    │       ├── Result
    │       └── Feedback
    └── Class
        └── All subject exams or selected exams
```

This boundary prevents Subject pages from accumulating exam-only responsibilities and allows multiple finals, midterms, oral exams or certification attempts to coexist under one course category.

## Architecture

```text
Browser
  │
  ├── Next.js 16 / React 19 frontend and BFF
  │     ├── App Router pages
  │     ├── API-backed product state (optional local demo mode)
  │     ├── HTTP-only session cookies and authenticated API proxy
  │     └── focused exam-session layout
  │
  └── FastAPI API
        ├── authentication and JWT lifecycle
        ├── ownership-protected CRUD and attempt lifecycle
        ├── SQLAlchemy async models
        ├── Alembic migrations
        └── PostgreSQL / pgvector

files → object storage → worker → parsing/chunking → embeddings/retrieval
      → Vertex AI grounded generation → mock → evaluation → mastery
```

### Technology stack

| Layer | Technology | Responsibility |
|---|---|---|
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS 4 | Product interface and exam session |
| API | FastAPI, Pydantic, SQLAlchemy asyncio | Auth, ownership and domain APIs |
| Database | PostgreSQL 17 with pgvector | Relational records and future vector retrieval |
| Migrations | Alembic | Versioned database schema |
| Cache/jobs | Redis and Dramatiq worker | Durable artifact processing and retries |
| AI | Vertex AI / Google Gen AI SDK | Gemini 3.5 Flash generation, embeddings, evaluation and adaptation |
| Runtime | Docker Compose | Local PostgreSQL, Redis and API services |

## Repository layout

```text
.
├── backend/
│   ├── api/app/                 # FastAPI routes, services, models and configuration
│   ├── api/migrations/          # Alembic migrations
│   ├── api/tests/               # Unit and PostgreSQL integration tests
│   ├── worker/                  # Background-worker boundary
│   ├── compose.yaml
│   └── pyproject.toml
├── frontend/
│   ├── src/app/                 # Next.js App Router routes and layouts
│   ├── src/components/          # Shared UI and product shell
│   ├── src/features/            # Auth, subjects, exams, classes and demo state
│   └── public/
├── materials/                   # Product screenshots and submission assets
└── deep-research-report.md      # Product research and rationale
```

## Run locally

### Prerequisites

- Node.js 20 or newer
- npm
- Python 3.11–3.13
- Docker with Docker Compose

### Fastest path: frontend demo

The frontend can be explored without the API. Demo entities and attempts are stored in browser `localStorage`.

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The example environment enables `NEXT_PUBLIC_DEMO_MODE=true`, so protected product pages are available for local review.

### Full P0 product

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
cp .env.example .env
docker compose -f compose.yaml up -d postgres redis
alembic upgrade head
uvicorn app.main:app --app-dir api --reload --port 8010
```

In a second terminal:

```bash
cd frontend
npm install
NEXT_PUBLIC_DEMO_MODE=false API_URL=http://127.0.0.1:8010/api/v1 npm run dev
```

Open [http://localhost:3000/register](http://localhost:3000/register). Product data is stored in PostgreSQL; the browser only keeps HTTP-only session cookies and an active-attempt recovery pointer.

To enable grounded AI, set `APP_VERTEX_PROJECT` and `APP_VERTEX_LOCATION` in `backend/.env` and authenticate with Google Application Default Credentials (`gcloud auth application-default login`). Without Vertex configuration, the same endpoints deliberately use the deterministic generator/evaluator, making local development and CI reproducible.

Health checks:

```text
GET http://localhost:8010/api/v1/health/live
GET http://localhost:8010/api/v1/health/ready
```

The complete containerised backend can also be started from `backend/`:

```bash
docker compose up --build
```

By default Compose exposes the API on port `8010`, PostgreSQL on `55432`, and Redis on `6379`.

## Implemented API

All endpoints are prefixed with `/api/v1`.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/auth/register` | Create an account |
| `POST` | `/auth/login` | Start an authenticated session |
| `POST` | `/auth/refresh` | Rotate access credentials |
| `POST` | `/auth/logout` | End a session |
| `GET`, `PATCH` | `/me` | Read or update current user |
| `POST`, `GET` | `/subjects` | Create or list owned subjects |
| `GET`, `PATCH`, `DELETE` | `/subjects/{subject_id}` | Manage one subject |
| `POST`, `GET` | `/subjects/{subject_id}/exams` | Create or list nested exams |
| `GET`, `PATCH`, `DELETE` | `/exams/{exam_id}` | Manage one exam |
| `POST`, `GET` | `/subjects/{subject_id}/classes` | Create or list classes |
| `GET`, `PATCH`, `DELETE` | `/classes/{class_id}` | Manage one class |
| `POST` | `/exams/{exam_id}/mocks` | Generate a deterministic mock |
| `GET` | `/mocks/{mock_id}` | Read a mock without exposing answer keys |
| `POST` | `/mocks/{mock_id}/attempts` | Start or resume an active attempt |
| `GET` | `/attempts/{attempt_id}` | Reload an attempt and saved responses |
| `PUT` | `/attempts/{attempt_id}/responses/{question_id}` | Autosave one response |
| `POST` | `/attempts/{attempt_id}/submit` | Submit and evaluate idempotently |
| `GET` | `/exams/{exam_id}/attempts` | List result history |
| `GET` | `/exams/{exam_id}/statistics` | Read basic exam statistics |

The legacy `/workspaces` contract remains available for compatibility while new product surfaces use Subjects and Exams.

## Frontend routes

| Route | Experience |
|---|---|
| `/home` | Student dashboard |
| `/subjects` | Subject categories |
| `/subjects/[subjectId]` | Nested exams and classes |
| `/exams` | Global exam index |
| `/exams/new` | Five-step exam creation |
| `/exams/[examId]` | Exam workspace |
| `/exams/[examId]/edit` | Edit exam configuration |
| `/exams/[examId]/run` | Focused mock simulation |
| `/exams/[examId]/statistics` | Exam performance overview |
| `/classes` | Class management |

## Quality checks

Frontend:

```bash
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

Backend:

```bash
cd backend
source .venv/bin/activate
ruff check api
ruff format --check api
mypy
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:55432/openai_buildweek pytest
alembic check
```

PostgreSQL integration tests validate authentication, ownership isolation, CRUD, durable Exam configuration, mock generation, autosave, immutable submission and statistics. The same gates run in `.github/workflows/ci.yml`.

## Privacy and product principles

- **Private by default:** uploaded study materials remain private unless a user explicitly publishes them.
- **Exam fidelity over generic generation:** mocks should follow the reviewed blueprint and rules.
- **Evidence before adaptation:** recommendations should disclose confidence, coverage and recency.
- **Human review for high-stakes feedback:** generated scoring is study guidance, never an official grade.
- **Rights-aware sharing:** users must have permission to publish third-party course materials.
- **Clear prototype boundaries:** simulated or incomplete AI functionality is labelled honestly.

## Roadmap

1. Add artifact metadata, presigned upload and object-storage contracts.
2. Implement parsing, chunking, embeddings and retrieval jobs.
3. Generate editable blueprints and scenarios with OpenAI.
4. Produce grounded mocks constrained by reviewed source data and rules.
5. Evaluate attempts with citations to rubrics and transparent uncertainty.
6. Add mastery snapshots and adaptive next-mock generation.
7. Complete library publishing/cloning and class-level progress.
8. Add deployment and seeded judge access.

## Further documentation

- [Frontend guide](frontend/README.md)
- [Backend guide](backend/api/README.md)
- [Research report](deep-research-report.md)

## License

No open-source license has been selected. Until one is added, all rights are reserved by the repository owner.
