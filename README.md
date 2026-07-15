# ExamTwin

> Build a faithful digital twin of a real exam, practise it under realistic conditions, and turn every attempt into a better next mock.

ExamTwin is an adaptive exam-preparation platform created for OpenAI Build Week. It helps students organise university exams, attach the material that defines each exam, describe its structure and rules, run a focused mock session, and retain results for future feedback and adaptation.

The product is deliberately exam-centred:

- a **Subject** is a lightweight category such as Quantum Physics;
- an **Exam** owns its context files, blueprint, scenario, timing, scoring rules, attempts, feedback and statistics;
- a **Class** shares either a whole Subject or selected Exams with a group;
- an **Attempt** is an archived mock run with answers, score, duration and feedback.

## Current status

The repository contains a working Next.js product prototype and a tested FastAPI foundation.

| Area | Status |
|---|---|
| Authentication and profile | Implemented in the API and frontend flows |
| Subject CRUD | Implemented |
| Nested Exam CRUD | Implemented |
| Exam data, blueprint, scenario and rules editor | Implemented as a local-first frontend experience |
| Exam Run simulation | Implemented with timer, navigation, flags, local autosave and archived result |
| Exam statistics | Initial low-confidence overview implemented |
| Class CRUD and exam scoping | Implemented |
| PostgreSQL models and migrations | Implemented for auth, workspaces, subjects, exams and classes |
| Artifact ingestion and retrieval | Planned |
| Real OpenAI generation and evaluation | Planned; current mock generation is an explicit frontend simulation |
| Background worker pipeline | Planned |

The UI never presents its prototype scoring as production AI output. The next integration milestone is connecting the existing exam workspace to durable artifact storage, the FastAPI contracts, background processing and OpenAI-powered generation/evaluation.

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
  ├── Next.js 16 / React 19 frontend
  │     ├── App Router pages
  │     ├── local-first demo provider
  │     ├── auth proxy and API routes
  │     └── focused exam-session layout
  │
  └── FastAPI API
        ├── authentication and JWT lifecycle
        ├── ownership-protected CRUD services
        ├── SQLAlchemy async models
        ├── Alembic migrations
        └── PostgreSQL / pgvector

Planned pipeline:
files → object storage → worker → parsing/chunking → embeddings/retrieval
      → OpenAI blueprint/scenario generation → mock → evaluation → mastery
```

### Technology stack

| Layer | Technology | Responsibility |
|---|---|---|
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS 4 | Product interface and exam session |
| API | FastAPI, Pydantic, SQLAlchemy asyncio | Auth, ownership and domain APIs |
| Database | PostgreSQL 17 with pgvector | Relational records and future vector retrieval |
| Migrations | Alembic | Versioned database schema |
| Cache/jobs | Redis, planned worker | Future artifact and AI job orchestration |
| AI | OpenAI Responses and Embeddings APIs, planned | Extraction, grounded generation and evaluation |
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

### Backend development

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
cp .env.example .env
docker compose up -d postgres redis
alembic upgrade head
uvicorn app.main:app --app-dir api --reload --port 8000
```

Health checks:

```text
GET http://localhost:8000/api/v1/health/live
GET http://localhost:8000/api/v1/health/ready
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
npm run build
```

Backend:

```bash
cd backend
source .venv/bin/activate
ruff check .
ruff format --check .
mypy
pytest
alembic check
```

PostgreSQL integration tests are marked with `integration` and validate authentication, ownership isolation and CRUD behaviour against a real database.

## Privacy and product principles

- **Private by default:** uploaded study materials remain private unless a user explicitly publishes them.
- **Exam fidelity over generic generation:** mocks should follow the reviewed blueprint and rules.
- **Evidence before adaptation:** recommendations should disclose confidence, coverage and recency.
- **Human review for high-stakes feedback:** generated scoring is study guidance, never an official grade.
- **Rights-aware sharing:** users must have permission to publish third-party course materials.
- **Clear prototype boundaries:** simulated or incomplete AI functionality is labelled honestly.

## Roadmap

1. Persist the frontend Exam workspace through the existing FastAPI API.
2. Add artifact metadata, presigned upload and object-storage contracts.
3. Implement parsing, chunking, embeddings and retrieval jobs.
4. Generate editable blueprints and scenarios with OpenAI.
5. Produce grounded mocks constrained by reviewed data and rules.
6. Evaluate attempts with citations to rubrics and transparent uncertainty.
7. Add mastery snapshots and adaptive next-mock generation.
8. Complete library publishing/cloning and class-level progress.
9. Add CI, deployment, seeded judge access and an end-to-end demo script.

## Further documentation

- [Frontend guide](frontend/README.md)
- [Backend guide](backend/api/README.md)
- [Research report](deep-research-report.md)

## License

No open-source license has been selected. Until one is added, all rights are reserved by the repository owner.
