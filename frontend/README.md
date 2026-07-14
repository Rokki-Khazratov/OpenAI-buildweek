# Frontend

Next.js App Router frontend for ExamTwin, built with React, TypeScript, Tailwind CSS 4, and the
default Next.js tooling. Vite is intentionally not included: Next.js supplies the build and dev
toolchain for this application.

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
