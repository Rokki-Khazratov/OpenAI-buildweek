# Production deployment guide

This repository now contains a self-hosted production stack in `docker-compose.production.yml`:

- Next.js web app, bound only to `127.0.0.1:3000`;
- FastAPI API and Dramatiq worker;
- PostgreSQL with pgvector, Redis, and private MinIO storage;
- a one-shot migration service that must finish before API/worker start.

Use a reverse proxy such as Caddy or Nginx for public HTTPS. Do **not** expose PostgreSQL, Redis, MinIO, or the API directly to the Internet.

## Server prerequisites

1. Ubuntu 22.04+ (or equivalent), Docker Engine and Docker Compose v2.
2. A DNS record for the web domain, for example `app.example.com`.
3. Optional: a second HTTPS hostname such as `files.example.com` for MinIO uploads/downloads. It must proxy to `http://127.0.0.1:9000`; if you do not expose MinIO publicly, direct browser uploads cannot work.
4. Vertex AI credentials only if `APP_AI_ENABLED=true`.

## First deployment

```bash
git clone https://github.com/Rokki-Khazratov/OpenAI-buildweek.git /opt/examtwin
cd /opt/examtwin
cp .env.production.example .env.production
chmod 600 .env.production
mkdir -p secrets
```

Edit `.env.production`. Generate secrets locally on the server:

```bash
openssl rand -base64 48
```

Set `APP_CORS_ORIGINS` to the exact public web origin and `APP_STORAGE_PUBLIC_ENDPOINT_URL` to the exact MinIO public origin. When AI is enabled, copy the Google Application Default Credentials JSON to the absolute path set in `GOOGLE_APPLICATION_CREDENTIALS_HOST_PATH`; keep it mode `600`.

Validate configuration and start:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
docker compose --env-file .env.production -f docker-compose.production.yml ps
curl -fsS http://127.0.0.1:3000/login > /dev/null
```

Check migration/API logs if a service is not healthy:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100 migrate api worker
```

## Caddy example

Install Caddy using its official package, then configure `/etc/caddy/Caddyfile`:

```caddyfile
app.example.com {
    reverse_proxy 127.0.0.1:3000
}

files.example.com {
    reverse_proxy 127.0.0.1:9000
}
```

Reload Caddy after validating the file. Caddy provisions TLS automatically when DNS points to the server and ports 80/443 are reachable.

## Update / rollback

```bash
cd /opt/examtwin
git fetch origin
git checkout main
git pull --ff-only origin main
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

The migration service runs on every deploy and Alembic applies only pending revisions. Before an irreversible database migration, take a PostgreSQL backup:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup-$(date +%F-%H%M).sql
```

To roll back application code, check out the prior Git SHA and rerun `up -d --build`. Do not downgrade database migrations during the hackathon unless the migration explicitly supports it.

## Post-deploy smoke check

1. Open `https://app.example.com/register` and register a disposable account.
2. Create a subject and exam, create a deterministic mock, save an answer, then submit it.
3. Upload a small text artifact and wait for `ready` status.
4. Confirm API docs are unavailable in production (expected) and no credentials appear in browser network responses.

## Operating commands

```bash
# Status and logs
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs -f api worker

# Stop without deleting persistent data
docker compose --env-file .env.production -f docker-compose.production.yml down
```

Never run `docker compose down -v` on the production server: it deletes the persistent database/object-store volumes.
