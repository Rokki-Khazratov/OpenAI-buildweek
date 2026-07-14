# Backend

The backend currently implements Phase 0–2 and the workspace portion of Phase 3: application
startup, structured logging, request IDs, health endpoints, asynchronous PostgreSQL sessions,
initial migrations, authentication, user profile operations, and ownership-protected workspace
CRUD.

Artifact APIs, background workers, and AI features are not implemented yet.

## Implemented API

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET/PATCH /api/v1/me`
- `POST/GET /api/v1/workspaces`
- `GET/PATCH/DELETE /api/v1/workspaces/{workspace_id}`

## Local setup

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
uvicorn app.main:app --reload
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
