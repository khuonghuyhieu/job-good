# Good Job

Good Job is an internal recognition, reward, and community platform. Phase 1
provides its reproducible monorepo, database, queue, object storage, application
bootstraps, health checks, tests, and CI foundation. Authentication and product
workflows are intentionally not implemented yet.

## Prerequisites

- Node.js 22
- pnpm 11.17.0
- Docker with Docker Compose 2.20.3 or newer (required for Compose `include`)

## One-command start

The Compose configuration supplies safe local defaults. To customize them, copy
the example environment first:

```bash
cp .env.example .env
docker compose up --build
```

Services:

| Service          | URL                                |
| ---------------- | ---------------------------------- |
| Web              | http://localhost:8080              |
| API liveness     | http://localhost:3000/health/live  |
| API readiness    | http://localhost:3000/health/ready |
| Worker liveness  | http://localhost:3001/health/live  |
| Worker readiness | http://localhost:3001/health/ready |
| MinIO API        | http://localhost:9000              |
| MinIO console    | http://localhost:9001              |

Compose applies migrations explicitly, runs the idempotent demo seed, creates the
private MinIO bucket, and then starts the API, Worker, and Web services.

## Local development

Install and validate all workspaces:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Start infrastructure for integration tests:

```bash
docker compose up -d postgres redis minio minio-init
DATABASE_URL=postgresql://good_job:local-development-only@localhost:5432/good_job?schema=public pnpm db:migrate:deploy
DATABASE_URL=postgresql://good_job:local-development-only@localhost:5432/good_job?schema=public ORGANIZATION_TIMEZONE=Asia/Ho_Chi_Minh pnpm db:seed
DATABASE_URL=postgresql://good_job:local-development-only@localhost:5432/good_job?schema=public REDIS_URL=redis://localhost:6379 pnpm test:integration
```

Run the applications locally after building shared packages:

```bash
cp .env.example .env
docker compose up -d postgres redis minio minio-init
pnpm dev
```

Root development and database scripts load `.env` automatically, falling back
to the safe local values in `.env.example` when `.env` does not exist. The
example uses host-reachable `localhost` URLs; Compose replaces those URLs with
its internal service DNS names for containerized processes.

## Database lifecycle

- `pnpm db:migrate` creates or applies development migrations.
- `pnpm db:migrate:deploy` applies committed migrations without creating new ones.
- `pnpm db:seed` runs the deterministic, repeatable demo seed for
  `SEED_BUSINESS_MONTH`.
- `pnpm db:reset:test` removes and recreates the configured development/test schema.

Production deployment must run migrations explicitly. The seed is never part of
the migration itself.

## Teardown

Stop containers while preserving data:

```bash
docker compose down
```

Delete local container data and rebuild from a fresh database:

```bash
docker compose down --volumes
docker compose up --build
```

The volume-removal command deletes local PostgreSQL, Redis, and MinIO development
data. It does not affect source files.
