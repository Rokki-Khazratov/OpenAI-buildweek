# Frontend

Next.js App Router frontend for ExamTwin, built with React, TypeScript, Tailwind CSS 4, and the
default Next.js tooling. Vite is intentionally not included: Next.js supplies the build and dev
toolchain for this application.

## Current interactive scope

- Subjects are lightweight categories for organizing Exams and Classes.
- Exams own their context data, blueprint, generation scenario, rules, attempt history, and statistics.
- Exam CRUD, the five-step creation flow, focused mock simulation, local autosave, result archive,
  and low-confidence statistics are implemented as a local-first visual prototype.
- Subject, Exam, Class, and Attempt demo data persists in browser storage.
- Real artifact processing, OpenAI generation/evaluation, and analytics remain backend/worker
  integrations; the UI does not claim those prototype results are production AI output.

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
