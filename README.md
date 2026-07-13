# OpenAI Build Week — Adaptive Exam Prep

> A student-owned platform that reconstructs real exam formats, tracks mastery across repeated simulations, and lets students clone and improve university course spaces together.

## Status

This repository is currently in the **planning and project-setup phase**. The initial structure and product scope are documented, but no application code has been written yet.

## The problem

Students often prepare from disconnected notes, past exams, rubrics, and generic question banks. Existing study tools can generate practice questions, but they rarely reproduce the structure of a specific exam or adapt future simulations to demonstrated skill gaps.

This project treats an exam as a **digital twin**: its sections, question types, timing, scoring rules, penalties, and rubric are extracted from real course artifacts. Each completed mock exam updates skill-level mastery and informs the next adaptive mock.

## Core product loop

1. Create a private course workspace.
2. Upload a past exam, rubric, syllabus, notes, or solutions.
3. Extract and review the exam blueprint.
4. Generate a realistic mock exam.
5. Complete and submit an attempt.
6. Receive rubric-based feedback and skill diagnostics.
7. Generate an adaptive next mock focused on confirmed weaknesses.
8. Publish or clone a study space and view class-level progress.

## MVP scope

The Build Week MVP will focus on one complete, judge-testable vertical flow:

- authentication and private workspaces;
- artifact upload and background processing;
- exam-blueprint extraction and editing;
- mock generation and attempt submission;
- automatic and rubric-based evaluation;
- mastery snapshots with confidence estimates;
- adaptive next-mock generation;
- basic library publish/clone flow;
- basic class dashboard and opt-in leaderboard.

Chat, tutor marketplaces, native mobile apps, advanced proctoring, deep social features, and real-time knowledge-tracing training are intentionally outside the MVP.

## Planned architecture

| Area | Planned technology | Responsibility |
|---|---|---|
| Web | Next.js, React, TypeScript, Tailwind CSS | Student and class experience |
| API | FastAPI, Pydantic, SQLAlchemy | Auth, workspaces, exams, attempts, analytics APIs |
| Data | PostgreSQL, `jsonb`, `pgvector` | Relational domain data, flexible blueprints, retrieval |
| Jobs | Dramatiq and Redis | Parsing, embeddings, generation, evaluation, analytics |
| Files | S3-compatible object storage | Private course artifacts via presigned URLs |
| AI | OpenAI Responses, Embeddings, Moderation APIs | Extraction, generation, retrieval, evaluation, safety |
| Delivery | Docker and GitHub Actions | Reproducible local runtime and CI/CD |

The MVP is planned as one web service, one API service, one worker, PostgreSQL, Redis, and an object-storage bucket. This keeps the demo path small while leaving clear boundaries for future scaling.

## Repository structure

```text
.
├── apps/
│   └── web/              # Planned Next.js frontend
├── services/
│   ├── api/              # Planned FastAPI application
│   └── worker/           # Planned background-job worker
├── packages/
│   └── shared/           # Planned shared contracts and configuration
├── infra/                # Planned containers, deployment, and CI assets
├── docs/                 # Product, architecture, API, and demo documentation
├── tests/                # Planned cross-service and end-to-end tests
└── deep-research-report.md
```

Empty directories contain `.gitkeep` placeholders only. They do not contain implementation code.

## Product principles

- **Private by default:** uploaded student and course materials remain private unless explicitly published.
- **Exam fidelity over generic generation:** mocks should follow the extracted blueprint, not merely cover the same topic.
- **Evidence before adaptation:** recommendations include confidence based on coverage, recency, and consistency.
- **Students own the network:** course spaces can be cloned and improved without requiring institutional setup.
- **Human review for high-stakes feedback:** AI-generated rubric evaluations are guidance, not official academic grades.
- **Rights-aware sharing:** users must confirm they are authorized to publish third-party course materials.

## Build Week demo target

The intended demo is a single short journey: upload an exam and rubric, extract its blueprint, generate and complete a mock, inspect weak skills, create an adaptive follow-up, publish the space, and show another student cloning it into a class.

## Development roadmap

- **M1:** authentication, workspace creation, and artifact upload
- **M2:** parsing, chunking, embedding, and retrieval
- **M3:** blueprint extraction and manual review
- **M4:** mock generation and attempt flow
- **M5:** evaluation, mastery snapshots, and adaptive next mock
- **M6:** library cloning and class dashboard
- **M7:** deployment, judge access, README updates, demo account, and video

## Research and specification

The detailed product research, comparisons, domain model, proposed REST API, analytics design, security considerations, and sprint plan are available in [deep-research-report.md](deep-research-report.md).

## Codex and OpenAI usage

Codex is being used to turn the research brief into the repository structure, documentation, implementation plan, and later the working product. The runtime is planned to use OpenAI models for blueprint extraction, grounded mock generation, rubric-based evaluation, study recommendations, embeddings, and moderation.

The final submission will document the implemented model flows, prompts, safeguards, evaluation approach, and the relevant Codex session feedback ID. These details will be updated as implementation progresses.

## Local development

There is no runnable application yet. Setup and run commands will be added after the initial implementation and must remain reproducible from a clean clone.

## License

No open-source license has been selected yet. Until one is added, all rights are reserved by the repository owner.
