Verdict: FIX FIRST

# Review of PR #1497 — Notifications: deliver outbid and win notices within seconds

Reviewed head `577a24c1` (base `46c9bdac`). Review only; the PR branch was not changed.

The design is sound: `pg_notify` sent inside the staging transaction, a dedicated LISTEN connection per worker, bucketed BullMQ job ids, global concurrency 1, and the minute sweep kept as a safety net. Measured latency is about 1.5 s, down from 0–60 s. Two things block it: the wake path uses up the outbox retry budget in seconds, and CI is red.

## Blocking

1. **Wake drains burn the outbox retry budget almost instantly. A short outage now dead-letters critical notices for good.**
   - `outbox.fail()` puts a failed row straight back to `pending` with `attempts + 1`. There is no backoff or `next_attempt_at` (`packages/persistence/src/repositories/drizzle-notification-outbox.repository.ts:152-155`). The claim then picks it up again right away, because the only guard is `created_at < now-1s` (`:108`).
   - `runProcessNotificationOutboxWakeJob` loops up to `NOTIFICATION_OUTBOX_WAKE_MAX_BATCHES = 10` while `processed + failed >= 50` (`apps/worker/src/jobs/payment-ops-cron.ts:91-96,113-115`). Failures count toward a "full" batch, so the loop claims the same failing rows again and again. The cap of 10 equals `NOTIFICATION_OUTBOX_MAX_ATTEMPTS = 10`.
   - **Reproduced** against real Postgres and Redis with a scratch test (not committed). I staged 60 `outbid` rows and made `notificationWrite.createMany` throw ("transient blip"). Then I ran **one** `runProcessNotificationOutboxWakeJob` in worker-local mode. After 962 ms the rows were `{"failed/10":12,"pending/9":28,"pending/7":8,"pending/6":12}`: 12 notices were permanently failed and the rest were nearly exhausted.
   - Even in API mode (one batch per wake), every wake bucket costs one attempt per failing row. Wakes come in pairs every 250 ms during a live sale, so about 10 wakes (a few seconds) dead-letters every pending row.
   - Before this PR the budget was about 10 minutes, at one sweep per minute. The failure handling meets the brief's "a failing send cannot spin" only in the sense that the loop ends. It still spins through the attempts and loses notices.
   - Fix (any of these):
     - Stop the wake loop when `failed > 0`, only continuing while `processed === batchSize`.
     - Add a per-row retry delay so the claim skips rows that failed recently (for example `claimed_at`/`last_attempt_at < now - backoff(attempts)`).
     - Do both.
   - Add a test that stages failing rows, runs N wakes, and asserts that `attempts` rises by at most one per minute (or per backoff step).

2. **CI is red: `static-checks` fails at `pnpm lint:deps`.** Log for job 133239691229: `apps/worker/src/workers/register-notification-outbox-workers.ts: "pg" - pg is a devDependency but this file ships with the workspace: move it to dependencies`. `pg` sits under devDependencies at `apps/worker/package.json:71`. The worker Dockerfile does a full `pnpm install` (`apps/worker/Dockerfile:15`), so the image would still run today. The gate is correct, though: move `pg` (and keep `@types/pg` in dev) to `dependencies`. `ci-result` is failure as a result. All other checks are green, including api vitest, test, build, worker-role-contract and auth-role-contract.

## Non-blocking

- **The headline latency test does not depend on the signal.** Mutation: I commented out `pg_notify` in the built `packages/persistence/dist/.../drizzle-notification-outbox.repository.js`. The worker resolves `@auction/persistence` from `dist`, so editing `src` alone changes nothing; I tried that first and every test still passed. With the signal removed, "delivers a committed outbid notice within seconds, once" (`notification-outbox-wake.integration.test.ts:105`) **still passed at 1494 ms**. The cause is that the listener wakes once on connect (`notification-outbox-wake-listener.ts:87`), and the test stages within the 1.5 s settle window of that wake. The mutation was still caught by "delivers … in the order they were staged" and "signals once per committing transaction", so 2 tests failed. To make the latency test honest, wait at least 2 s after `notification_outbox_wake_listening` before staging. The "1.5 s" figure in the PR and runbook is otherwise credible: I measured 1568 ms and 1566 ms with the signal on.
- **Listener resilience:**
  - `pg.Client` is created without `keepAlive` or `connectionTimeoutMillis` (`register-notification-outbox-workers.ts`, `createClient`).
  - A half-open TCP connection (failover, NAT idle drop) emits no `error`/`end`, so the listener goes silently deaf until the process restarts. It falls back to the minute sweep with no alert.
  - A black-holed `connect()` hangs with no retry.
  - Suggest `keepAlive: true`, a connect timeout, and optionally a periodic `SELECT 1` on the listen connection.
- `queue.setGlobalConcurrency(1)` is fire-and-forget (`register-notification-outbox-workers.ts:41`). If it fails, the only symptom is a log line. Ordering and "never side by side" rely on it. SKIP LOCKED still prevents double claims, so the risk is per-user ordering only. Consider awaiting it before starting the worker. BullMQ 5.77.6 supports it.
- Per-user ordering holds only on the happy path. A row that fails goes back to `pending` and can be delivered after later rows for the same user. This is not new, but the retry storm in blocking item 1 makes it more likely.
- Comment drift: `STUCK_AFTER_MS` (1 s) is the claim guard, but the "Debounce" comment sits on `CLAIMED_STALE_MS` (`drizzle-notification-outbox.repository.ts:15-17`). This predates the PR, but the PR now relies on that guard via `OUTBOX_CLAIM_GUARD_MS`, which is duplicated as a constant in the worker (`notification-outbox-wake-scheduler.ts:7`). Export it from persistence instead.
- Wake jobs do not report to Sentry and only `log.warn` on failure (`register-notification-outbox-workers.ts:61-64`). A metric or counter for wake drain failures would help, given item 1.

## Verified

- **Signal only on commit, only for new critical rows.** `pg_notify` runs inside the caller's `tx`, guarded by `inserted.length > 0 && isCriticalNotificationType` (`drizzle-notification-outbox.repository.ts:71-75`). Integration tests confirm: none in-transaction, one per committing transaction, none on rollback, none on duplicate key, none for routine kinds.
- **All staging paths go through `DrizzleNotificationOutboxRepository.stage`.** That covers bidding (`apps/worker/src/bidding/create-worker-bidding.ts:84`), the API `notification-outbox.service.ts:12`, lifecycle (`worker-lot-lifecycle-notifications.ts`) and reoffer. There are no raw inserts into `notification_outbox`.
- **Kinds.** `CRITICAL_NOTIFICATION_TYPES` covers outbid, bid_refused_limit, lot_won, lot_lost, lot_ended_seller, lot_ending_soon and watchlist_ending_soon (`packages/persistence/src/lib/notification-outbox-wake.ts:14-22`). Non-critical kinds keep the sweep. A wake drain can still deliver routine rows early; that is harmless and documented in the runbook.
- **Minute sweep unchanged.** Same job id `process-notification-outbox-1m` and same 60 s interval (`register-notification-outbox-workers.ts:19-20,69-73`). `NOTIFICATION_OUTBOX_WAKE_ENABLED=false` turns the wake path off (`apps/worker/src/env.ts:299-308`, default true).
- **Idempotency.**
  - The claim uses `FOR UPDATE SKIP LOCKED` and marks rows `claimed` in the same transaction (`drizzle-notification-outbox.repository.ts:101-124`).
  - The worker drain also dedupes on a Redis key (`worker-notification-outbox-drain.ts`).
  - Bucketed job ids collapse replicas and bursts into shared jobs.
  - Global concurrency 1 serialises sweep and wake drains.
  - The integration test confirms a single notification after the follow-up drain.
- **Connection lifecycle.** One client per worker. A dropped client is detached and ended. Reconnect backs off 1 s→30 s; the timer is unref'd and cleared on `stop()`. `stop()` is registered in `closables`. There is a stale-client guard (`this.client !== client`) and no leak on connect failure. Unit tests cover these cases.
- **DB roles.** LISTEN and `pg_notify` need no grants. `pg_notify` is in pg_catalog and executable by PUBLIC, and neither `migrate-roles.ts` nor any migration revokes it. The PR rightly makes no role or migration change. worker-role-contract and auth-role-contract are green in CI.
- **Migration.** None in this PR, so nothing to renumber or roll back.
- **Back-pressure.** Drains are capped at about 2 jobs per 250 ms bucket plus 10 batches per wake, and serialised by concurrency 1. Enqueue failures are reported, not thrown. The follow-up delay (1.5 s) clears the 1 s claim guard for any wake sharing the bucket (scheduler test).

## Commands run (local Postgres 16 + Redis, migrations applied)

| Check | Result |
|---|---|
| `turbo run typecheck` (worker, api, persistence, bidding-runtime and their dependencies; 33 tasks) | pass |
| `apps/worker` vitest | 239 files pass. 1 suite fails: `src/finance/accounting/bid-refunds-books.integration.test.ts` throws `Invalid URL` at load because no database URL was set in that run. The file is not touched by the PR and the failure is environmental. |
| `apps/api` vitest | 727 files / 7557 tests pass |
| `packages/persistence` vitest | 51 files / 268 tests pass |
| `packages/bidding-runtime` vitest | 18 files / 109 tests pass |
| PR's new worker tests, including the integration test with DB and Redis | 22/22 pass. Measured delivery 1568 ms after commit. |
| Mutation: remove `pg_notify` (dist) | 2 of 5 integration tests fail. The headline latency test survives (see Non-blocking). |
| Reproduction: one wake job with failing sends | 60 rows at 6–10 attempts, 12 terminal `failed`, in 962 ms |
| GitHub CI | `static-checks` and `ci-result` fail (lint:deps). Everything else passes or is skipped. |
