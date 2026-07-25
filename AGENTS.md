# AGENTS.md — Good Job Coding Agent Operating Contract

## Mission

Build a complete, demonstrable P0 MVP for an internal recognition, reward and community platform.

The product converts unstructured Slack shout-outs into structured Kudos with:

- receiver,
- 10–50 Giving Points,
- one Core Value,
- mandatory description,
- optional image/video,
- social interaction,
- Reward Point credit,
- reward redemption,
- auditable history.

## Read order

Before changing code, read:

1. `docs/product/01-product-charter.md`
2. `docs/product/02-scope-and-business-rules.md`
3. `docs/architecture/01-system-architecture.md`
4. The discipline guide:
   - FE: `docs/frontend/01-frontend-architecture.md`
   - BE/Worker: `docs/backend/01-backend-architecture.md`
5. `docs/contracts/01-http-api-contract.md`
6. `docs/contracts/02-realtime-event-contract.md`
7. The active phase file.
8. The task definition in `docs/tasks/implementation-backlog.md`.

## Hard invariants

Never violate these:

1. One Kudo has exactly one sender and one receiver.
2. Sender cannot equal receiver.
3. Kudo points are between 10 and 50 inclusive.
4. Each employee has 200 Giving Points per organization business month.
5. Unused Giving Points do not roll over.
6. Giving Points cannot be spent on rewards.
7. Reward Points are credited only from a committed Kudo.
8. Every Reward Point credit/debit has an append-only ledger entry.
9. Committed Kudo sender, receiver, Core Value and points are immutable.
10. Reward Balance can never become negative.
11. One logical redemption produces at most one redemption and one debit.
12. Realtime events are emitted only after transaction commit.
13. A failed video does not roll back an already committed Kudo.
14. A processing video must never be displayed as ready.
15. Tenant/user identity must come from the authenticated session, not trusted request payload.

## Change discipline

Before implementation:

- Identify domain owner.
- Identify affected invariant.
- Identify API/event contract.
- Identify required tests.
- Confirm whether the work is P0, stretch or deferred.

After implementation:

- Run lint, type-check, unit tests, integration tests and relevant concurrency tests.
- Update documentation when behavior or contract changes.
- Do not silently invent requirements; record assumptions in `docs/product/03-decision-log.md`.
- Avoid unrelated refactors in a feature task.

## Definition of done for a task

A task is done only when:

- behavior matches acceptance criteria,
- database constraints and transaction boundaries are correct,
- frontend represents loading/empty/pending/success/error states,
- automated tests cover happy path and critical failure path,
- no secret or unsafe config is committed,
- the repository remains runnable from documented commands.

## Implementation priority

Critical path:

```text
Environment
→ Authentication
→ Monthly Budget
→ Atomic Kudo + Ledger
→ Feed
→ Wallet
→ Reward Redemption
→ Concurrency Tests
→ Media Worker
→ Realtime + Durable Notifications
→ Docker/CI/README
→ Final Demo
```

## Stop conditions

Do not proceed to stretch work when any of these are failing:

- budget can exceed 200,
- duplicate Reward Point credit is possible,
- redemption can double-spend,
- realtime event can be emitted before commit,
- media processing blocks API,
- test suite cannot reproduce concurrency behavior,
- repository cannot start from clean setup.
