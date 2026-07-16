# ExamTwin — Day 2 frontend handoff plan

**Date:** 17 July 2026  
**Owner:** frontend contributor  
**Start branch:** `frontend`  
**Starting checkpoint:** Day 1 artifact lifecycle merged through commit `408ba66`  
**Primary goal:** close the remaining implemented backend → frontend gap and leave P0/P1 demo-ready.

## 1. Outcome for the day

By the end of Day 2 a signed-in user can open an Exam statistics page backed by
`GET /api/v1/exams/{exam_id}/statistics`, understand the empty/low-data/populated states, navigate
between attempts and statistics, and use the artifact experience reliably on desktop and mobile.

Do not start Data Science, embeddings, AI evaluation, library, invitations, or leaderboard work.
Do not change backend behavior unless the existing statistics contract cannot represent a required
state or a reproducible defect is found.

## 2. Required reading

1. `README.md` — local stack and commands.
2. `docs/frontend/api-contract-map.md` — current integration boundary.
3. `frontend/src/features/exams/exam-statistics.tsx` — current demo-derived screen.
4. `backend/api/app/api/routes/attempts.py` — statistics endpoint.
5. `frontend/src/features/artifacts/artifact-manager.tsx` — Day 1 lifecycle behavior.

## 3. Work order

### D2.1 — Confirm the statistics contract (45 minutes)

- Capture the exact response shape and error states from the FastAPI schema and route tests.
- Add `ExamStatisticsDto` and `getExamStatistics(examId)` to the relevant feature API module.
- Keep transport field names inside the API/adapter boundary.
- Add a mapper into a small frontend view model; do not put raw DTO calculations in JSX.
- Verify ownership behavior: unauthenticated, foreign Exam, missing Exam, zero attempts.

Acceptance:

- No component imports `apiFetch` directly.
- DTO and UI model are separately typed.
- Empty statistics are a valid state, not an exception.

### D2.2 — Connect the Exam statistics screen (2 hours)

- Replace calculations derived only from `DemoProvider.attempts` in normal mode with the endpoint.
- Preserve the current visual language and demo-mode fallback.
- Implement explicit states:
  - loading skeleton;
  - zero completed attempts;
  - one attempt / low confidence;
  - multiple attempts;
  - permission/not-found failure;
  - recoverable network error with Retry.
- Display only metrics supported by the backend: completed attempts, average/best/latest score,
  average duration, score trend or history if present.
- Do not label deterministic aggregates as mastery, prediction, AI insight, or recommendation.
- Link the latest/history rows to their available result context when the current routes allow it.

Acceptance:

- Reload and re-login preserve the same statistics.
- A newly submitted attempt appears after navigation without a hard refresh.
- Zero-attempt Exams do not render fake charts or fake values.

### D2.3 — Statistics responsive and accessibility pass (60 minutes)

- Verify widths 390, 768, 1024, and 1440 px.
- Ensure cards do not overflow and metric order remains meaningful on mobile.
- Use headings, lists/tables, and accessible names instead of layout-only generic elements where
  appropriate.
- Do not communicate trend or result using color alone.
- Keyboard-check Retry, Run another mock, back navigation, and attempt links.
- Check light-mode contrast and 200% zoom.

Acceptance:

- `scrollWidth === clientWidth` at all target widths.
- No critical axe/accessibility violations in the changed screen.
- All interactive controls have visible focus.

### D2.4 — Artifact UX hardening (90 minutes)

- Add a confirmation step before deleting a source.
- Prevent duplicate delete/retry clicks while a request is running.
- Keep the detail panel synchronized when the selected artifact changes status.
- Make partial-upload feedback name each failed file and keep successful files visible.
- Verify interrupted upload, failed parsing, stuck queued, ready preview, download, and deletion.
- Confirm the Exam list/detail source counters update after ready, failed, retry, and delete.
- Preserve the 20-file and 25 MiB validation rules.

Acceptance:

- Destructive actions cannot be submitted twice.
- A failed action leaves the UI usable and exposes Retry where appropriate.
- No global product loading flash occurs after an artifact mutation.

### D2.5 — Frontend automated coverage (2 hours)

- Add focused tests for statistics mapping and all meaningful states.
- Add artifact tests for validation, partial upload, polling terminal state, retry, and delete.
- Add or extend one browser smoke covering:
  1. login with the seeded account;
  2. open a ready artifact and inspect preview;
  3. open an Exam with attempts;
  4. verify statistics from the API;
  5. run or submit a mock and confirm statistics refresh.
- Mock only at feature API boundaries for component tests; retain at least one real-stack E2E.

Acceptance:

- Tests fail if the backend field mapping drifts.
- Timers/polling are deterministic under fake timers.
- Browser smoke leaves no unexpected console errors.

### D2.6 — Final review and handoff (45 minutes)

- Run the complete quality gate below.
- Review the diff for raw API calls, demo-only data leaking into normal mode, stale labels, and
  unrelated edits.
- Update `docs/frontend/api-contract-map.md` to mark statistics integrated.
- Commit by concern; do not mix documentation, tests, and implementation in one large commit.
- Push to `frontend` and report commit hashes plus any remaining blocker.

## 4. Backend work allowed during Day 2

Backend changes are optional and must stay small:

- correct a demonstrably wrong/missing statistics field;
- make zero-attempt response semantics explicit;
- add an integration test for a contract bug;
- preserve existing auth, ownership, pagination, and error envelopes.

If a desired visualization needs a metric the endpoint does not provide, omit the visualization and
record the proposal. Do not invent the number on the client.

## 5. Quality gate

From `frontend/`:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

From `backend/` if backend files changed:

```bash
.venv/bin/ruff check api worker
.venv/bin/ruff format --check api worker
.venv/bin/mypy
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:55432/openai_buildweek .venv/bin/pytest
.venv/bin/alembic check
```

From repository root with the local stack running:

```bash
node scripts/e2e-smoke.mjs
node scripts/p1-artifact-smoke.mjs
node scripts/seed-local-demo.mjs
```

## 6. Suggested commits

1. `feat(frontend): connect exam statistics API`
2. `fix(frontend): harden artifact interactions`
3. `test(frontend): cover statistics and artifact states`
4. `docs(frontend): record Day 2 compatibility closure`

## 7. Definition of done

- [ ] Statistics endpoint is used in normal mode.
- [ ] Demo mode still works without the backend.
- [ ] Empty, loading, populated, low-data, and error states are intentional.
- [ ] Statistics claims are limited to backend-supported aggregates.
- [ ] Artifact delete/retry is guarded against duplicate actions.
- [ ] Artifact counters and detail state stay synchronized.
- [ ] Desktop, tablet, mobile, keyboard, zoom, and console review pass.
- [ ] Frontend lint, typecheck, build, focused tests, and real-stack smoke pass.
- [ ] API contract map is updated.
- [ ] Changes are committed by concern and pushed to `frontend`.

## 8. Stop conditions

Stop and report instead of guessing if:

- statistics values disagree between API and persisted attempts;
- completing an attempt does not become visible after a clean API refresh;
- authorization differs between attempt history and statistics;
- fixing the issue would require Data Science or a breaking API migration;
- local stack or migrations cannot be restored without destructive data operations.
