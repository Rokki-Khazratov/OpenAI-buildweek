# Frontend

Next.js App Router frontend for ExamTwin, built with React, TypeScript, Tailwind CSS 4, and the
default Next.js tooling. Vite is intentionally not included: Next.js supplies the build and dev
toolchain for this application.

## Current interactive scope

- Subjects are lightweight categories for organizing Exams and Classes.
- Exams own their context data, blueprint, generation scenario, rules, attempt history, and statistics.
- Exam CRUD, the five-step creation flow, focused mock simulation, autosave, result archive,
  Library, Classes, Statistics, and personal Analytics are implemented.
- Personal analytics displays `analytics.v2` evidence confidence, trends, timing disclosure and
  `adaptive.v2` targets. Class analytics exposes aggregates only, suppresses small groups and never
  renders student-level readiness or weaknesses.
- Demo mode persists Subject, Exam, Class, Attempt, and representative DS evidence in browser storage.
- Normal mode uses the authenticated BFF, FastAPI, PostgreSQL, object storage, worker, and optional
  Vertex generation/evaluation. The UI labels deterministic and Vertex-backed results explicitly.

## Structure

The structure follows the useful parts of the Offerfly layout while adapting them to Next.js:

```text
src/
├── app/           # App Router pages and layouts
├── components/    # Reusable UI and layout components
├── data/          # Static product copy and configuration
├── assets/        # Source assets; public assets live in /public
├── features/      # Auth, workspaces, exams, and analytics slices
├── lib/           # API client and shared utilities
└── types/         # Shared TypeScript types
```

## Local development

```bash
cd frontend
cp .env.example .env.local
npm run dev
```

Quality checks:

```bash
npm run lint
npm run build
```
