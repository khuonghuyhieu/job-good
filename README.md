# Good Job

Good Job is a demonstrable P0 internal recognition, reward, and community
platform. It converts informal appreciation into committed Kudos with a
receiver, 10–50 Giving Points, one Core Value, a required description, optional
media, Reward Point credit, community interaction, and auditable redemption.

## Product loop

```text
Login → Give Kudo → monthly budget decreases
      → receiver Reward Balance and ledger increase
      → Kudo appears in Feed
      → colleagues react/comment
      → receiver redeems an active Reward
      → debit and Redemption History remain auditable
```

Giving Points and Reward Points are deliberately separate:

- Every employee receives 200 Giving Points per organization business month.
  Unused Giving Points do not roll over and cannot buy rewards.
- Reward Points are earned from committed Kudos and spent on rewards. The
  account is a transactional projection; the append-only ledger is the audit
  authority.

## Architecture

```text
React/Vite Web
  ├─ REST + authenticated Socket.IO
  └─ direct presigned media upload
          │
NestJS API ── PostgreSQL (business truth)
  │              └─ transactional outbox
  ├─ Redis sessions / PubSub / BullMQ / rate limits
  └─ MinIO/S3 upload orchestration
          │
NestJS Worker
  ├─ bounded ffprobe video validation
  └─ post-commit outbox publication
```

The monorepo contains:

- `apps/web` — React application and component tests.
- `apps/api` — authenticated HTTP/WebSocket modular monolith.
- `apps/worker` — media and outbox background processing.
- `packages/contracts` — shared request, response, and event schemas.
- `packages/database` — Prisma schema, migrations, constraints, and seed.
- `packages/config` — typed server and browser environment parsing.
- `packages/domain` — shared domain primitives.
- `packages/test-utils` — deterministic integration fixtures.
- `infra` — local Docker Compose topology.

## Prerequisites

- Node.js 22
- pnpm 11.17.0
- Docker with Docker Compose 2.20.3 or newer
- `ffprobe` when running the Worker outside Docker

Use one browser hostname consistently. The defaults use `localhost`; opening the
Web at `127.0.0.1` while the configured origin is `localhost` will correctly
fail cookie/CORS/origin checks.

## Clean one-command start

```bash
cp .env.example .env
docker compose up --build
```

Compose starts PostgreSQL, Redis, MinIO, migrations, the repeatable demo seed,
API, Worker, and Web in dependency order.

| Service          | URL                                |
| ---------------- | ---------------------------------- |
| Web              | http://localhost:8080              |
| API liveness     | http://localhost:3000/health/live  |
| API readiness    | http://localhost:3000/health/ready |
| Worker liveness  | http://localhost:3001/health/live  |
| Worker readiness | http://localhost:3001/health/ready |
| MinIO API        | http://localhost:9000              |
| MinIO console    | http://localhost:9001              |

To prove startup from empty local data:

```bash
docker compose down --volumes
docker compose up --build
docker compose ps
```

`down --volumes` permanently removes this project’s local PostgreSQL, Redis,
and MinIO data.

## Demo data

The login page lists active employees from the `amanotes-demo` organization.
The seed also contains an inactive employee for rejection tests, active Core
Values, active/inactive rewards, a current-month Giving Budget, one committed
Kudo, and reconciled Reward Point ledger entries.

The seed is deterministic and repeatable for `SEED_BUSINESS_MONTH`. Run it
twice to verify that it does not duplicate logical demo records:

```bash
pnpm db:seed
pnpm db:seed
```

## Local development

```bash
pnpm install --frozen-lockfile
pnpm db:generate
docker compose up -d postgres redis minio minio-init
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

Root scripts load `.env` and fall back to `.env.example` for safe local
defaults. Compose replaces host-reachable endpoints with internal service DNS
names where required.

`.env.production.example` documents deployment-required values. It contains no
usable secrets; inject generated credentials through the deployment secret
manager. Browser `VITE_*` values are embedded at Web build time, while server
values are read at process startup.

Database commands:

- `pnpm db:migrate` — create/apply development migrations.
- `pnpm db:migrate:deploy` — apply committed migrations only.
- `pnpm db:seed` — apply the repeatable demo seed.
- `pnpm db:reset:test` — recreate the configured development/test schema.

Production deployment runs migrations explicitly. Seed data is never embedded
in a migration.

## Validation

With PostgreSQL, Redis, and MinIO running:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm db:reset:test
pnpm db:seed
pnpm test:integration
pnpm test:e2e
pnpm build
docker compose config --quiet
```

`pnpm validate` runs the non-destructive full project checks. Concurrency tests
cover monthly-budget overspend, idempotent Kudo retry, duplicate Reward credit,
redemption double-spending, account/ledger consistency, and rollback without
outbox publication.

## Security model

- The demo-user selector is intentionally P0 demo authentication, not a
  production identity provider.
- Employee and organization identity always come from the Redis-backed,
  HttpOnly session.
- Cookies use `SameSite=Lax`; production requires `Secure`.
- Unsafe browser requests with a foreign `Origin` or cross-site Fetch Metadata
  are rejected. This Origin strategy supplements SameSite cookies and exact
  CORS. A future cross-site deployment must use a synchronizer/double-submit
  CSRF token rather than weakening these checks.
- Login and command endpoints use Redis-backed rate limits. Database locks,
  constraints, and idempotency remain authoritative.
- Production configuration rejects documented placeholder secrets and insecure
  Web origins.
- Direct uploads are owner-scoped, size/MIME constrained, and verified against
  object metadata. Images receive signature validation; videos are validated
  asynchronously with bounded Worker concurrency and subprocess timeout.
- Request logs include a bounded correlation ID, method, path, status, and
  duration, but never cookies, request bodies, or presigned query strings.

## Key integrity decisions

- PostgreSQL commit defines business success.
- Create Kudo locks the sender-month budget row before checking the 200-point
  allowance and commits Kudo, budget, receiver account, ledger credit,
  notification, and outbox once.
- Redemption locks the Reward Point account, reloads server-side reward cost
  and latest balance, and commits exactly one redemption and debit.
- Idempotency keys recover stable committed results after client timeouts.
- Ledger rows are append-only and accounts reconcile with their sequence.
- Realtime is at-least-once and only published from committed outbox rows.
- Media readiness is independent from Kudo commitment; failed video processing
  never rolls back recognition.
- Feed and histories use deterministic compound cursors instead of offsets.

## Assumptions and trade-offs

- One seeded organization is sufficient for the P0 demo, while all business
  queries remain tenant-scoped.
- Rewards, employees, teams, and Core Values are seeded because Admin/HR UI is
  deferred.
- Redemption commits immediately; stock, approval, fulfillment, shipping, and
  refund workflows are deferred.
- Fixed supported reactions keep moderation and aggregation bounded.
- Demo authentication favors reviewer accessibility over production identity
  assurance. OIDC/SAML is deferred.
- Redis Pub/Sub is ephemeral by design; durable notifications and reconnect
  refetch provide recovery.
- Notification UI shows the newest page; the API already supports stable cursor
  pagination for future UI expansion.
- Colleague contains-search and application-side reaction aggregation are
  acceptable for seeded P0 scale. Critical Feed, ledger, redemption,
  notification, and outbox access paths are indexed.
- Comment media, AI, gamification, public profiles, Kubernetes, and multi-region
  operation are outside P0.

## Demo script

1. Start from clean volumes and wait until API and Worker are healthy.
2. Open `http://localhost:8080` and login as an active sender.
3. Show current Giving Budget and explain its separation from Reward Balance.
4. Create a 10–50 point Kudo for another active colleague.
5. Verify the updated budget and newest Feed item.
6. React, add a text comment, and open Kudo Focus.
7. Upload an image or short video; show processing independently from committed
   Kudo state.
8. Sign out and login as the receiver.
9. Open Wallet and show exactly one Kudo credit and reconciled balance.
10. Open the durable notification and navigate back to the Kudo.
11. Redeem an affordable active reward.
12. Show one debit and one committed Redemption History entry.
13. Repeat/check the same logical redemption to demonstrate idempotent safety.
14. Point to the concurrency, rollback, media, outbox, and realtime tests and
    the green CI run.

## Known non-blocking limitations

- Demo authentication must be replaced before real employee deployment.
- There is no Admin/HR management UI.
- Video processing validates media and duration but does not generate normalized
  derivatives or thumbnails.
- Comment threads and the notification dropdown do not yet expose unbounded UI
  pagination.
- Local Compose is the supported submission runtime; optional public hosting is
  not required for P0.

## Teardown

Preserve data:

```bash
docker compose down
```

Delete local project data:

```bash
docker compose down --volumes
```
