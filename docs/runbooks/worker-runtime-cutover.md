# Worker runtime and finance ownership cutover

This runbook complements [async-delivery-phase-two.md](./async-delivery-phase-two.md) and documents background **single-owner** rules after the worker runtime completion program.

## Ownership flags (API + worker must match in the same deploy)

| Flag | Default | Meaning |
|------|---------|---------|
| `FINANCE_CRON_EXECUTION_OWNER` | `api_rollback` | Worker BullMQ schedules jobs; execution goes to API `/internal/jobs/*` |
| `FINANCE_CRON_EXECUTION_OWNER=worker` | — | Worker runs `@auction/finance-cron-app` handlers in-process |
| `FINANCE_CRON_API_ROLLBACK` | `true` | When `worker` owner, must be `false` (startup validation) |
| `LIFECYCLE_EXECUTION_OWNER` | `api` | Timed transitions + delayed lot jobs on API |
| `LIFECYCLE_EXECUTION_OWNER=worker` | — | Worker runs lifecycle tick + BullMQ consumer |
| `ABSENTEE_REPLAY_OWNER` | `api_rollback` | On activation, worker calls API `replay-absentee-for-lot` |
| `ABSENTEE_REPLAY_OWNER=worker` | — | Worker runs `@auction/bidding-runtime` absentee replay in-process (requires worker bid composition) |
| `XERO_PROJECTOR_MODE` | `off` | Outbound Xero delivery ledger on worker |
| `XERO_WEBHOOK_INBOX_MODE` | `legacy` | API processes Xero invoice webhooks inline |
| `XERO_WEBHOOK_INBOX_MODE=inbox` | — | API enqueues `webhook_event`; worker drains via `WEBHOOK_EVENTS_PROCESS=true` |

Startup calls `assertRuntimeOwnership` from `@auction/background-runtime` in both processes.

## worker_app RBAC cutover gate

Before `LIFECYCLE_EXECUTION_OWNER=worker` or worker-local finance cron in production:

1. Apply role grants: `pnpm --filter @auction/db db:roles` (or production migrate job).
2. Run `pnpm --filter @auction/db test` with `DATABASE_URL_WORKER` / `WORKER_ROLE_CONTRACT_REQUIRED=true` (CI job `worker-role-contract`).
3. Run `pnpm --filter @auction/background-runtime build && node scripts/ci/run-runtime-ownership-smoke-gates.mjs`.

## Domain event + Xero go-live gates

Before `XERO_PROJECTOR_MODE=canary|live` or `DOMAIN_EVENT_PUBLISH_VALIDATE=enforce`:

1. Run `DOMAIN_EVENT_SMOKE_GATES` via `node scripts/ci/run-domain-event-smoke-gates.mjs` (suite map in `@auction/background-runtime`).
2. Record staging canary evidence using [worker-runtime-cutover-acceptance-evidence.md](./worker-runtime-cutover-acceptance-evidence.md).
3. Shadow/canary with `DOMAIN_EVENT_PUBLISH_VALIDATE=observe`; fix violations; then enforce.
4. Set `XERO_API_WRITES_DISABLED=true` on API before enabling each live projector operation.
5. API and worker must agree on `XERO_PROJECTOR_MODE`, `XERO_PROJECTOR_LIVE_OPERATIONS`, and `DOMAIN_EVENT_PUBLISH_VALIDATE` in the same deploy.

Worker lifecycle absentee replay uses an explicit adapter: `ABSENTEE_REPLAY_OWNER=api_rollback` (default) posts to API `POST /internal/jobs/replay-absentee-for-lot` (requires `CRON_INTERNAL_SECRET` and `API_INTERNAL_BASE_URL` on worker). Under `ABSENTEE_REPLAY_OWNER=worker`, API returns **409** for that route; reconcile absentee terminal rows against `bid.internal_placement_key` (`absentee:{id}`) after canary.

## Cutover order (one operation at a time)

1. Run smoke gates listed in `RUNTIME_OWNERSHIP_SMOKE_GATES` (`packages/background-runtime`); execute suites via `pnpm --filter @auction/background-runtime build && node scripts/ci/run-runtime-ownership-smoke-gates.mjs` (CI: `worker-role-contract` job + smoke step on main test job).
2. **Finance cron** — set `FINANCE_CRON_EXECUTION_OWNER=worker` and `FINANCE_CRON_API_ROLLBACK=false` on API and worker. Worker runs all finance cron handlers locally via `@auction/finance-cron-app` + `@auction/finance-runtime`; API `/internal/jobs/*` finance routes return **409** (`finance_cron_execution_delegated_to_worker`). Set `XERO_API_WRITES_DISABLED=true` on **API only** so worker-local Xero writes remain enabled.
3. **Bulk payout settlement canary** — run `settlement.bulk_payout` parity (`packages/finance-runtime/src/payout/payout-bulk-settlement-parity.test.ts`). Canary one legal entity; reconcile Stripe transfer ids and `payout` rows against the prior API-rollback cycle. Stay on `api_rollback` until one full cycle matches with no duplicate lines on replay. Watch for `bulk_payout_settlement_deferred` / stuck `scheduled` >24h.
4. **Xero projector** — `shadow` → `canary` + `XERO_PROJECTOR_LIVE_OPERATIONS` → `live`. Live commands use worker-local accounting writers (`create-xero-live-executor-ports-local.ts`), not API HTTP rollback.
5. **Xero inbound** — `XERO_WEBHOOK_INBOX_MODE=inbox`, `WEBHOOK_EVENTS_ENQUEUE=true` (API), `WEBHOOK_EVENTS_PROCESS=true` (worker).
6. **Lifecycle** — run `lifecycle.timed_transitions`, `lifecycle.delayed_queue_jobs`, and `lifecycle.absentee_replay` smoke gates; parity under Redis tick lock contention; then `LIFECYCLE_EXECUTION_OWNER=worker` with absentee still on `api_rollback`; reconcile transitions, jobs, notifications, and deferred tick metrics. One-sale canary: flip `ABSENTEE_REPLAY_OWNER=worker` only after worker RBAC probes and bid/absentee parity pass.

## Rollback (lifecycle)

- Stop worker lifecycle first: `LIFECYCLE_EXECUTION_OWNER=api` on API and worker; redeploy together.
- Restore absentee API rollback: `ABSENTEE_REPLAY_OWNER=api_rollback` before re-enabling worker lifecycle tick.
- Keep rollback adapters through a full auction/settlement stability window before removing HTTP absentee replay.

## Rollback

- Finance: `FINANCE_CRON_EXECUTION_OWNER=api_rollback`, `FINANCE_CRON_API_ROLLBACK=true` (restores API bulk settlement + transfers under Redis lock `payout:settlement:lock`).
- Xero projector: `XERO_PROJECTOR_MODE=off` or remove operations from `XERO_PROJECTOR_LIVE_OPERATIONS`.
- Xero webhooks: `XERO_WEBHOOK_INBOX_MODE=legacy`.
- Lifecycle: `LIFECYCLE_EXECUTION_OWNER=api`, then `ABSENTEE_REPLAY_OWNER=api_rollback`.

## Quantitative gates before removing API rollback adapters

- Zero duplicate Xero objects (idempotency keys stable on delivery ledger).
- No growth in `domain_event_delivery` retry depth for consumer `xero`.
- No growth in `webhook_event` failures for source `xero`.
- Lifecycle: no overdue lots/sales regression after worker ownership window.

## Related code

- Registry: `packages/background-runtime/src/registry.ts`
- Worker dispatch: `apps/worker/src/finance/finance-cron-dispatch.ts`
- Shared cron apps: `packages/finance-cron-app`
- Xero live ports (worker-local): `apps/worker/src/integrations/xero/create-xero-live-executor-ports-local.ts`
- Lifecycle ownership matrix: `packages/background-runtime/src/lifecycle-ownership-matrix.ts`
