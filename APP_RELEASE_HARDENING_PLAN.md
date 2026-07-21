# ExamTwin application release hardening plan

## 1. Scope and release rule

This plan covers only the application code and its release proof. Landing-page and video
work are owned separately and are intentionally excluded.

The implementation order is fixed:

```text
R0 freeze and reproduce
→ R1 correct Class entitlements
→ R2 enforce cohort privacy
→ R3 prove the complete normal-mode runtime
→ R4 code-only release audit
→ deploy only after a PASS verdict
```

No deployment or Devpost submission may rely on demo-mode evidence. The release gate is a
fresh `NEXT_PUBLIC_DEMO_MODE=false` run against PostgreSQL, Redis, MinIO, the worker and the
FastAPI service.

## 2. Target access contract

Class membership is an explicit entitlement. It must not be converted into unrestricted
Subject workspace membership.

| Caller | Subject metadata | Exam access | Class visibility | Owner analytics |
|---|---|---|---|---|
| Subject owner | Full | Every Exam | Every owned Class | Yes |
| Subject-scope Class member | Read | Every Exam in that Subject | Only Classes they belong to | No |
| Selected-exams Class member | Read | Union of Exams selected by their Classes | Only Classes they belong to | No |
| Removed member | None unless another Class still grants it | None unless another Class still grants it | Removed Class hidden | No |
| Unrelated user | None | None | None | No |

If one user belongs to multiple Classes in the same Subject, effective access is the union
of those Class grants. Removing one membership must preserve access granted by another.

`WorkspaceMember` remains the direct workspace-membership model. Class membership must be
resolved from `ClassMember`, `Classroom.exam_scope` and `ClassExam`; it must not create or
delete unrelated direct grants.

---

# R0 — Freeze and reproduce

## Goal

Capture a failing regression for every audited defect before changing authorization code.

## Work

1. Create branch `codex/app-release-hardening` from the current `main`.
2. Keep the existing untracked landing/video work untouched.
3. Start PostgreSQL and run all 31 backend tests with `TEST_DATABASE_URL` configured.
4. Add failing integration cases to
   `backend/api/tests/test_m6_library_classes.py`:
   - a selected-exam member cannot list or read an unselected Exam;
   - a selected-exam member can read the selected Exam;
   - a subject-scope member can read every Exam;
   - a member sees only Classes they belong to;
   - removal immediately revokes the removed Class grant;
   - deletion of a Class revokes its grant;
   - another Class in the same Subject preserves its independent grant;
   - an unrelated user receives the same `404` response as a nonexistent resource.
5. Add cohort regression cases:
   - three registered members but one eligible learner stays suppressed;
   - three registered members but two eligible learners stays suppressed;
   - three eligible non-owner learners publishes aggregates;
   - the owner is not counted toward the privacy threshold;
   - per-skill support below three is omitted;
   - suppressed payloads contain no readiness, confidence distribution, attempt total,
     weak skill, recommendation or learner activity signal.

## Gate

The new tests fail for the expected reasons on the old implementation. Existing unrelated
tests remain green.

---

# R1 — Correct Class entitlements

## R1.1 Access predicates

Implement central reusable predicates in
`backend/api/app/modules/workspaces/service.py`:

- `accessible_workspace_filter(user_id)` grants a Subject shell to its owner, a direct
  `WorkspaceMember`, or a user belonging to a Class in that Subject;
- `accessible_exam_filter(user_id)` grants an Exam to its Subject owner, a direct broad
  workspace member, a subject-scope Class member, or a selected-exams Class member whose
  `ClassExam` row matches that Exam;
- predicates use SQL `EXISTS` queries and return no user-specific details.

All Exam read paths must use `accessible_exam_filter`, including:

- global and Subject-scoped Exam lists;
- `get_exam()`;
- mock reads and attempt creation through their existing `get_exam()` boundary;
- personal statistics and analytics reads;
- any frontend API that obtains an Exam by ID.

Owner-only writes continue to use `get_owned_exam()` and are not widened.

## R1.2 Class visibility

Update `backend/api/app/modules/classes/service.py`:

- `list_classes()` returns all Subject Classes to the owner, but only joined Classes to a
  non-owner;
- `get_class()` requires ownership or a matching `ClassMember` row;
- members cannot enumerate sibling Classes through shared Subject access;
- dashboards, membership management and experiment endpoints remain owner-only.

## R1.3 Membership lifecycle

Update Class membership mutations:

- `add_class_member()` creates only `ClassMember` and its audit event;
- `remove_class_member()` deletes only the explicit Class membership;
- `delete_class()` relies on Class membership cascade and therefore removes only that
  Class grant;
- changing `exam_scope` or `exam_ids` takes effect immediately because authorization is
  derived from current Class rows;
- no cached or duplicated entitlement may survive a scope change.

## R1.4 Existing-data cleanup

Add migration `20260721_0010_class_entitlements.py`:

- remove historical non-owner `WorkspaceMember` rows created by the old Class flow;
- retain every owner membership;
- make the downgrade explicit and safe, without recreating ambiguous broad grants;
- document that there has never been a public API for independent non-owner workspace
  membership, making this cleanup valid for the current product dataset.

Before merging, verify the migration against a database containing:

- one Subject owner;
- multiple Classes in one Subject;
- overlapping members;
- selected-exam and subject-scope Classes;
- historical stale `WorkspaceMember` rows.

## R1 acceptance

- Selected-exam scope is enforced at the database-query boundary, not only in the UI.
- Removing or deleting a Class grant revokes access without damaging other Class grants.
- No Class member can infer sibling Class IDs or Exam metadata.
- Owner CRUD behavior remains unchanged.
- Answer keys and private artifacts remain absent from member-facing responses.

---

# R2 — Enforce cohort privacy

## R2.1 Eligible cohort definition

For one explicitly selected compatible Exam, define an eligible cohort member as:

```text
ClassMember.role == member
AND at least one evaluated Attempt exists for the selected Exam
AND analytics.v2 returns a non-null readiness index
AND the observation/taxonomy/model versions pass existing compatibility rules
```

The viewing owner is excluded from the cohort denominator even if the owner has attempts.
This prevents the owner from subtracting their own known value from a small aggregate.

## R2.2 Suppression order

Refactor `class_dashboard()` in this order:

1. Verify owner authorization.
2. Require exactly one Exam scope for comparable analytics.
3. Resolve non-owner Class members.
4. Resolve active and eligible learners.
5. If `eligible_learners < COHORT_PRIVACY_THRESHOLD`, return a suppressed response.
6. Only after that gate calculate median readiness, confidence distribution, weak skills,
   coverage and recommendations.

The suppression reason must say that at least three eligible learners with comparable
evidence are required, rather than only three registered Class members.

## R2.3 Suppressed response contract

While suppressed:

- `suppressed=true`;
- `median_readiness_index=null`;
- `low_evidence_percentage=null`;
- `weak_skills=[]`;
- `recommended_action=null`;
- confidence buckets are all zero;
- `total_attempts=0` and `active_learners=0` so activity cannot identify a learner;
- `member_count` may remain visible because the owner already manages the roster;
- `eligible_learners=0` is returned as a non-disclosing public value, not the hidden exact
  count.

If the exact hidden count is operationally required later, it must be stored in internal
telemetry rather than returned by this endpoint.

## R2.4 Frontend behavior

Update `frontend/src/features/classes/class-dashboard.tsx` only as needed to:

- render the new eligible-evidence suppression reason;
- avoid showing zero values as real cohort measurements;
- show no weak-skill or recommendation UI while suppressed;
- keep the owner-only explanation that raw answers and individual weaknesses are never
  exposed.

Update the existing Class dashboard component tests for both suppressed and publishable
states.

## R2 acceptance

- No aggregate is published with fewer than three eligible non-owner learners.
- No response field allows the owner to infer whether one specific learner attempted the
  Exam below the threshold.
- Every published skill has support of at least three eligible learners.
- Cohort responses never contain raw answers, feedback, email addresses, quotes or
  individual rows.

---

# R3 — Complete normal-mode runtime proof

## R3.1 Reproducible environment

Use the supported runtime versions:

- Node `22.13.1` or newer supported Node 22;
- Python 3.11–3.13;
- Docker Desktop running;
- `NEXT_PUBLIC_DEMO_MODE=false`;
- `API_URL=http://127.0.0.1:8010/api/v1`.

Correct release documentation/configuration in the same branch:

- replace the unused `NEXT_PUBLIC_API_URL` in `frontend/.env.example` with `API_URL`;
- use port `8010` consistently;
- update README Node requirements to match `frontend/package.json`;
- add a single normal-mode command sequence that does not depend on remembered shell
  state.

## R3.2 Automated release smoke

Extend `scripts/e2e-smoke.mjs` or add `scripts/release-app-smoke.mjs` so one command proves:

1. register and sign in through the Next.js BFF;
2. create a Subject and two Exams;
3. save an explicit Exam draft and reload it;
4. upload and process an artifact through MinIO and the worker;
5. generate a deterministic mock, autosave, reload, submit and verify idempotency;
6. verify personal analytics and adaptive target metadata;
7. create selected-exam and subject-scope Classes with separate users;
8. verify the complete R1 access matrix before and after removal;
9. verify R2 suppression with one and two eligible learners;
10. verify publication only after three eligible non-owner learners;
11. assert that member/cohort payloads contain no answer key, raw answer, private feedback,
    email or source text.

The script must create its own unique accounts and data, use only public HTTP contracts,
perform no manual SQL, and exit non-zero on the first violated invariant.

## R3.3 Complete verification matrix

Run from a clean checkout/database:

```text
backend: Ruff + format + MyPy + 31+ tests with PostgreSQL
database: alembic upgrade head + alembic check
frontend: ESLint + 26+ tests + tsc + production build
runtime: PostgreSQL + Redis + MinIO + API + worker + frontend healthy
smoke: P0 E2E + P1 artifact + DS golden + new release app smoke
AI: one explicit Vertex smoke, or a documented deterministic fallback decision
browser: normal-mode login → Subject → Exam → Run → result → analytics
```

The frontend browser pass must confirm that the visible provider label matches stored
generation/evaluation metadata. Deterministic output must never be presented as Vertex.

## R3.4 CI gate

Update `.github/workflows/ci.yml` so pull requests enforce:

- the new PostgreSQL Class authorization/privacy integration tests;
- frontend tests affected by suppression behavior;
- the release app smoke in normal mode;
- migration drift check.

Live Vertex remains an opt-in release proof because CI must not require paid credentials.

## R3 acceptance

- Every container is healthy.
- No integration test is skipped.
- Every smoke command exits zero twice from a clean seed.
- Normal-mode browser console contains no application errors.
- Demo mode is not used as release evidence.

---

# R4 — Code-only audit before deployment

After R1–R3 implementation, perform a fresh audit without changing code.

## Audit checklist

### Authorization

- Trace every Subject, Exam, Class, Mock, Attempt, statistics and analytics endpoint back
  to its access predicate.
- Verify 404-style non-disclosure for inaccessible UUIDs.
- Verify owner-only mutation and cohort endpoints.
- Verify overlapping Class grants and revocation.

### Privacy

- Recalculate every cohort denominator from code and fixtures.
- Inspect every response schema for user IDs, emails, answers, feedback, quotes and source
  content.
- Confirm the threshold is applied before any aggregate or activity signal is created.

### Data integrity

- Review migration `0010` upgrade/downgrade and foreign-key cascades.
- Run Alembic drift detection.
- Verify Exam scope changes become effective atomically.
- Verify retry/idempotency behavior for mock generation and attempt submission.

### Quality and release

- Review the complete branch diff and recent commits.
- Run all backend/frontend checks and dependency checks.
- Run the complete normal-mode smoke twice.
- Confirm no secrets or local `.env` files are tracked.
- Confirm the worktree contains only intentional release files.

## Final verdict format

The audit ends with exactly one of:

- **PASS — safe to deploy:** no open P0/P1 code defects, all gates green;
- **CONDITIONAL PASS:** no P0 defects, named P1 items accepted explicitly for the
  hackathon release;
- **FAIL — do not deploy:** any authorization/privacy defect, skipped required test,
  migration drift, unhealthy service or failed normal-mode smoke.

Deployment begins only after a PASS or an explicit owner-approved CONDITIONAL PASS.

---

# Commit sequence

Keep changes reviewable and independently green:

1. `test(classes): lock entitlement and privacy regressions`
2. `feat(authz): derive exam access from class scope`
3. `fix(classes): revoke stale workspace grants`
4. `fix(analytics): suppress cohorts below eligible threshold`
5. `test(frontend): cover privacy-safe class dashboard states`
6. `test(e2e): add normal-mode release authorization smoke`
7. `ci(release): enforce app hardening gates`
8. `docs(runbook): align normal-mode release environment`

Each commit must pass the relevant focused tests. The complete matrix runs before push,
before merge and once again from `main` before deployment.
