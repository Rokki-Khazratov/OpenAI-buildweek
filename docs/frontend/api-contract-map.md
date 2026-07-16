# Frontend ↔ backend contract map

Updated after the P1 artifacts Day 1 integration audit (16 July 2026).

## Compatibility status

| Product capability | Backend endpoints | Frontend integration | Status |
|---|---|---|---|
| Authentication | register, login, refresh, logout | auth screens and shared browser client | Integrated |
| Current profile | `GET/PATCH /me` | `features/auth/api.ts` | Integrated |
| Subjects | subject CRUD | `features/subjects/api.ts` + product provider | Integrated |
| Exams | exam CRUD | `features/exams/api.ts` + create/edit/detail flows | Integrated |
| Classes | class CRUD | `features/classes/api.ts` + class flows | Integrated |
| Mock generation | create/get mock | `features/attempts/api.ts` + exam runner | Integrated |
| Attempts | start/get/autosave/submit/history | `features/attempts/api.ts` + resume/result UI | Integrated |
| Exam statistics | `GET /exams/{id}/statistics` | backend contract exists; dashboard UI is deferred | Backend only |
| Artifact ingestion | create/complete/list/detail/summary/retry/delete/download | `features/artifacts/api.ts` + exam Data tab and wizard | Integrated |

The P0/P1 product UI no longer reads raw transport shapes directly. Each implemented domain has a
feature-level API module, while `DemoProvider` remains the single adapter from backend DTOs to the
current frontend domain model.

## Artifact lifecycle covered by the UI

```text
local validation
  -> create upload intent
  -> object-storage upload with progress
  -> complete upload
  -> queued / processing polling
  -> ready detail + content summary + download
     or failed detail + retry
  -> delete
```

Recovery behavior is explicit: interrupted uploads are shown as recoverable failures, processing
continues after reload through polling, one failed file does not cancel other uploads, and only
stuck jobs expose retry. The frontend accepts the backend statuses `pending`, `uploaded`, and
`expired` for upload state and `not_queued`, `queued`, `processing`, `ready`, `failed`, and
`deleting` for processing state.

## Contract boundary

```text
FastAPI schema
  -> typed feature API modules
  -> one DTO-to-domain adapter
  -> product components
```

The current types are manually checked against FastAPI schemas. OpenAPI generation should replace
manual DTO declarations after the hackathon-critical product loop is frozen; it is not required to
complete P0/P1 compatibility.

## Remaining work after Day 1

1. Expose exam statistics in the planned progress/reporting frontend.
2. Add blueprint extraction/version endpoints before replacing the current editable JSON-backed
   blueprint configuration.
3. Add library, memberships, invitations, activity, and leaderboard contracts for the later social
   P1 scope; they are not part of artifact ingestion.
4. Generate TypeScript transport types from checked-in OpenAPI and add a CI drift check.
5. Move refresh-token handling to HTTP-only cookies or a backend-for-frontend session boundary
   before production deployment.

## Shared response requirements

- Stable error envelope with code, message, field errors, and request ID.
- Consistent pagination semantics for every list endpoint.
- ISO timestamps in UTC.
- Durable job statuses with optional progress/message fields.
- Idempotency support for create, generate, and submit actions that can be retried.
- Permission errors that distinguish unauthenticated, forbidden, and not found without leaking
  private data.
