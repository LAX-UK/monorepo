# Worker runtime cutover — acceptance evidence

Record **concrete evidence** in staging (or production dry-run) before flipping `LIFECYCLE_EXECUTION_OWNER`, `ABSENTEE_REPLAY_OWNER`, or finance cron ownership. Repository CI proves contracts and defaults; it does **not** replace this checklist.

## Repository commands (before tag / promote)

| Step | Command |
|------|---------|
| Backup dirty tree | `pnpm ci:backup-ref` |
| Classify changes | `pnpm ci:classify-tree` |
| Full monorepo matrix | `pnpm ci:verify` (Postgres + `REDIS_URL` recommended) |
| Cutover smoke bundle | `pnpm ci:release-gates` |
| Clean-tree SHA record | `pnpm ci:record-evidence` |
| Staging checklist header | `pnpm ci:staging-acceptance` |
| Ownership flip order | `pnpm ci:authorize-cutover` |

## Preconditions (automated in CI)

- [x] Repository defaults keep rollback posture (`scripts/ci/verify-cutover-readiness.mjs`: lifecycle `api`, absentee/finance `api_rollback`, finance rollback enabled)
- [ ] `pnpm ci:verify` green on the **release commit** (also `full-verify` job on `main` / `release` push)
- [ ] `pnpm ci:release-gates` green (`REDIS_URL` required)
- [ ] Worker role contract job green (`DATABASE_URL_WORKER`, `db:roles`, snapshot + domain_event + `failed_jobs` probes)
- [ ] `pnpm ci:classify-tree` reviewed; working tree **clean** before tag (`pnpm ci:record-evidence`)
- [ ] Optional: `E2E stabilization` workflow green on release SHA (manual dispatch until stack is stable)

## Repository-only evidence (attach CI run URLs on release commit)

| Area | Evidence |
|------|----------|
| Shared KYC threshold policy | `@auction/bidding-runtime` + worker/API parity tests |
| Absentee API delegation | `absentee-replay-execution-guard.test.ts`, `internal-cron.absentee-delegation.test.ts` |
| Worker RBAC | `packages/db/src/worker-app-role.contract.test.ts` (incl. `failed_jobs`) |
| Lifecycle DLQ | `worker-lifecycle-dlq-behavior.test.ts` + Redis integration |
| Queue ownership metadata | `packages/queues/src/registry.consumer.test.ts` |
| Circular deps freeze | `scripts/ci/check-circular-deps-freeze.mjs` (baseline 47 cycles) |
| Deploy gate | `app-deploy-*.yml` `ci-gate` requires green **CI** on same SHA |

## Staging canary (manual — attach links / timestamps)

| Step | Evidence to capture |
|------|---------------------|
| Lifecycle shadow compare | Side-by-side domain_event + snapshot diff for one sale (API owner) |
| One-sale lifecycle canary | Sale ID, before/after lot statuses, BullMQ job IDs |
| Absentee replay canary | Lot ID, absentee rows replayed, bid placement keys |
| Reconciliation | SQL or admin report showing no duplicate bids / events |
| Retry / DLQ observation | Forced failure on **`lot-lifecycle`** or **`payout-settlement`** → `failed_jobs` + Redis DLQ (not finance proxy / tick queues) |
| Rollback drill | Env restored to `api` / `api_rollback`; API tick 409 when worker owns lifecycle |
| Stability window | 24–72h metrics: queue depth, DLQ rate, lifecycle lag, heartbeat freshness |

Run `pnpm ci:staging-acceptance` for the checklist; fill rows above with links and timestamps.

## Ownership flip authorization

Only after the staging table above is signed off (see `pnpm ci:authorize-cutover` for order):

1. Finance cron → worker (`FINANCE_CRON_EXECUTION_OWNER=worker`), observe settlement parity
2. `LIFECYCLE_EXECUTION_OWNER=worker` (worker + API aligned); observe `worker:heartbeat:lot-lifecycle` 24h
3. `ABSENTEE_REPLAY_OWNER=worker` only after bid/KYC/AML parity sign-off
4. Finance cron details per [worker-runtime-cutover.md](./worker-runtime-cutover.md)

## Sign-off

Production ownership flips require completed staging canary rows plus Engineering/Ops signatures. Repository CI alone is necessary but not sufficient.

| Role | Name | Date | Notes |
|------|------|------|-------|
| Engineering | | | |
| Ops | | | |
