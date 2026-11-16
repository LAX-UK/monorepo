Verdict: FIX FIRST

# Final recheck of PR #1497: Notifications: deliver outbid and win notices within seconds

I reviewed head `2995f36d` (base `618ab329`). The PR branch was not changed.

Since the previous review at `577a24c1` there are four commits:
- `bc1716bf`: the fix (backoff, migration 0403 and the review items).
- `2995f36d`: removes `dump.rdb`.
- `bbde2625` and `618ab329`: a merge of `main`.

The fixer did not add a "Changes after review" section, so I judged the PR from the commits and the code.

The code is now fine to ship. The retry storm is fixed and proven by a test, CI is green, and every earlier non-blocking item was dealt with. One thing still blocks the merge: the PR body describes the old behaviour and leaves out the backoff, the migration and the trade-offs.

## Blocking

1. **The PR body is stale and has no "Changes after review" section.**
   - The body (as of 2026-11-16 11:41 UTC) still says "a wake keeps going while batches come back full … up to 10 batches of 50". That is the behaviour that dead-lettered notices. The code now stops at the first batch with a failed row (`apps/worker/src/jobs/payment-ops-cron.ts:130`).
   - The body does not mention:
     - the per-row retry backoff: 15 s doubling to a 5 min cap, so ten attempts span about 28 min (`packages/persistence/src/lib/notification-outbox-claim.ts:22-28`);
     - the new column `notification_outbox.last_attempt_at`;
     - migration `0403_notification_outbox_retry_backoff` and its rollback;
     - the listener health check, keepAlive and connect timeout;
     - the new metrics and Sentry capture;
     - the worker only starting once `setGlobalConcurrency(1)` succeeds.
   - Its "Test evidence" still lists the old wake-job test ("drains while batches are full"). It also omits the backoff integration test and the 0403 migration tests.
   - Its "Latency" section is still accurate (1.5–1.6 s; I measured 1549 ms). It should also say that the latency test now waits out the connect wake and proves the signal, and that a **failed** critical notice is now retried after 15 s, 30 s, 1 min and so on, rather than on the next minute sweep. That retry change is a real behaviour change reviewers and ops should see.
   - The deploy notes need a line saying that 0403 is an additive migration with a rollback, and that its number is set at ship time.
   - Fix: add a "Changes after review" section that states the above honestly, and correct the out-of-date bullets.

## Non-blocking

- **`dump.rdb` (removed in `2995f36d`, added in `bc1716bf`) is still in the public history. It contains nothing sensitive.** I parsed the file locally and did not reproduce its contents here. It is a Redis 7.0.15 RDB snapshot of about 7.8 KB, left behind by a local run of the new integration test. It holds three kinds of data:
  - BullMQ 5.77.6 queue metadata for `process-notification-outbox`, under random test prefixes `outbox-wake-<8 hex>`: repeat and settle job ids, timestamps, attempts counters and `{}`-style job data.
  - A handful of `notification:dedupe:outbid:lot-<test id>:order-N` keys, built from the test's synthetic ids.
  - Standard RDB aux fields: redis-ver, ctime, used-mem.

  I found no email addresses, user ids or UUIDs, IP addresses or hostnames, passwords, API keys, tokens, JWTs, Stripe keys or private keys. There is no personal data. No history rewrite is needed. Optional: add `dump.rdb` (or `*.rdb`) to `.gitignore` so it is not committed again; it is not ignored today.
- **Per-user ordering on failure is now deliberately weaker.** A failed row waits at least 15 s, while later rows for the same person can be delivered in the meantime. A typical case is a delayed "outbid" arriving after "lot_won". The trade-off is reasonable, because shared failures usually fail every row. It should be stated in the PR body or runbook next to the "rows go out in the order they were staged" claim.
- **No outbox processing until global concurrency is set.** `register-notification-outbox-workers.ts:75,98,110`: the worker uses `autorun: false` and only calls `worker.run()` after `setGlobalConcurrency(1)` succeeds. While Redis refuses that call, the **minute sweep** does not run either; it retries with backoff from 1 s to 30 s. That is acceptable, since nothing on this queue can run without Redis anyway, and the failure is logged as `notification_outbox_global_concurrency_failed` on every retry. It is worth knowing in an incident.
- **App-clock backoff.** The claim compares `last_attempt_at` (set by the app, `drizzle-notification-outbox.repository.ts:174`) against the app's `now` (`:107,119-126`), not Postgres `now()`. That is what makes the backoff test deterministic. Clock skew between replicas is small next to a 15 s step, so this is harmless.
- **`NOTIFICATION_OUTBOX_MAX_ATTEMPTS` is now defined in `notification-outbox-claim.ts:8`.** The repository re-exports it (`drizzle-notification-outbox.repository.ts:23`) for existing importers. That is fine; the duplicate can be dropped later.

## Verified

### 1. Wake drains can no longer burn the retry budget

- **The wake loop stops on any failure.** `payment-ops-cron.ts:130` reads `if (result.failed > 0 || result.processed !== NOTIFICATION_OUTBOX_BATCH_SIZE) break;`. The loop also breaks on an unparseable result, and is still capped at 10 batches (`:89`).
  - Unit tests: "stops at the first batch with a failed row" and "stops when a whole batch failed" (`apps/worker/src/jobs/notification-outbox-wake-job.test.ts`).
  - **Mutation:** I changed the break back to the old "full batch counting failures" rule. Both tests failed (2/8).
- **Per-row backoff in the claim.** `drizzle-notification-outbox.repository.ts:117-127` adds `last_attempt_at IS NULL OR last_attempt_at < now - LEAST(5 min, 15 s * 2^(attempts-1))`. This matches `notificationOutboxRetryDelayMs` (`notification-outbox-claim.ts:22-28`). `fail()` sets `lastAttemptAt` (`:174`).
  - Rows that never failed keep NULL and are claimed exactly as before.
  - The API processor (`apps/api/src/services/notification-outbox.processor.ts:34,52`) goes through the same repository, so the backoff also applies in `api_rollback` mode and to the minute sweep.
  - A stale-claim release (a drain that died) does not count as an attempt; that is unchanged.
- **The budget is at least the old ~10 minutes.** The waits are 15 s, 30 s, 60 s, 120 s, 240 s and then 4 × 300 s, which totals 1,665 s (about 27.75 min) across the 10 attempts. Unit test: `notification-outbox-claim.test.ts:20-27` asserts `>= 10 * 60_000` and `=== 1_665_000`. The runbook's "about 28 minutes" is correct.
- **A test proves it end to end.** `notification-outbox-wake.integration.test.ts:341` ("tries a failing row at most once per backoff step…") runs against real Postgres and Redis. It stages 60 critical rows with a throwing `createMany` and runs more than 500 wake drains over a simulated 10 minutes; only `Date` is faked. It then asserts four things:
  - one wake raises `attempts` by at most one;
  - each retry gap is at least the backoff;
  - no row gets more than 6 attempts in 10 minutes;
  - no row ends `failed`.

  The test passes in 3.2 s.
  - **Mutation:** I made the claim ignore the backoff (`TRUE OR last_attempt_at IS NULL` in the built `persistence/dist`, which the worker resolves). The test failed with `expected 1000 to be greater than or equal to 15000`. The test genuinely depends on the backoff.

### Migration 0403 and rollback

- **The migration is additive and safe to run online.** `packages/db/drizzle/0403_notification_outbox_retry_backoff.sql` has `SET LOCAL lock_timeout = '30s'` followed by `ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamptz`: nullable, with no default, so there is no table rewrite. The running release does not read the column.
  - The journal entry is idx 395, when `1813060800000`, which follows 0402 (idx 394, `1812974400000`) (`packages/db/drizzle/meta/_journal.json:2763-2769`).
  - The schema adds `lastAttemptAt` (`packages/db/src/schema/notification-outbox.ts:24`).
- **The rollback deletes its ledger row by journal `when`.** `0403_rollback.sql:11` runs `DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1813060800000;` inside BEGIN/COMMIT, after `DROP COLUMN IF EXISTS`.
  - The unit test (`packages/db/src/migration-0403-notification-outbox-retry-backoff.test.ts:21`) ties the rollback's `created_at` to the journal entry, so a renumber at ship time keeps them in step.
  - The 0402 test's "last entry" assertion was relaxed to a monotonic-`when` check, so 0402 no longer has to be the last migration. That is correct.
- **Integration test with `laterRollbackSql`.** `migration-0403-…integration.test.ts` migrates through 0402 and stages a pre-existing row with `attempts = 2`, then migrates up and asserts the row has `last_attempt_at` NULL. It then runs `laterRollbackSql(403)` followed by the rollback, and asserts that the column is gone, the row is kept and the ledger row is removed. Finally it migrates up again and asserts the column is back. The test passes, both in the full db suite and on a fresh database.
- **Worker role grants.** `worker_app` gets table-level `INSERT, SELECT, UPDATE` on `notification_outbox` (`packages/db/src/migrate-roles.ts:2024-2025`, through `WORKER_NOTIFICATION_OUTBOX_TABLES`), so the new column is covered with no column grant. The API role already reads and writes the table. No index was added and none is needed: the claim still drives off `notification_outbox_state_created_idx`. `db:roles` applied cleanly on the migrated database. worker-role-contract and auth-role-contract are green in CI.
- I did not block on the migration number, as instructed; it is renumbered at ship time.

### 2. CI green, `pg` in dependencies, lockfile frozen

- I checked all 41 check runs on `2995f36d`. They are success, except `art-browser-gates`, which was skipped by path filter. The green runs include `static-checks` (the previous `lint:deps` failure is gone), `ci-result`, `test`, `build`, both `api vitest` shards, `worker-role-contract` and `auth-role-contract`.
- `pg` moved to `dependencies` (`apps/worker/package.json:58`), and `@types/pg` stays in devDependencies. `pnpm-lock.yaml` moves the importer entry to match. `pnpm install --frozen-lockfile` succeeds locally.

### 3. The earlier non-blocking items are all addressed

- **The latency test now depends on the signal.** It waits `CONNECT_WAKE_QUIET_MS = 2_500` after the listener is up (`notification-outbox-wake.integration.test.ts:37`). It also asserts that no minute-sweep job ran between the commit and the delivery (`:162`).
  - **Mutation:** I replaced `pg_notify(...)` with a harmless `SELECT length(...)` in the built `persistence/dist`, so the SQL stays valid and only the signal is gone. "delivers a committed outbid notice within seconds, once, through the signal" now **fails**, with 3/6 tests failing. Last time it survived.
  - With the signal in place, I measured 1549 ms.
- **Listener resilience:**
  - The `pg.Client` uses `keepAlive: true`, a 10 s keepalive initial delay and `connectionTimeoutMillis: 10_000` (`register-notification-outbox-workers.ts:148-150`).
  - A `SELECT 1` health query runs every 30 s with a 10 s timeout, and a failure or timeout drops the connection and reconnects (`notification-outbox-wake-listener.ts:28,110-136`). The health timer is unref'd and cleared on drop and `stop()`, with an in-flight guard and a stale-client guard.
  - Unit tests cover a healthy connection, a hung query (half-open connection) and a failing query.
- **Global concurrency is awaited.** `setGlobalConcurrency(1)` is awaited, with retry and backoff, before `worker.run()` (`register-notification-outbox-workers.ts:95-111`). The retry timer is cleared on close.
- **Exported guard constant.** `NOTIFICATION_OUTBOX_CLAIM_GUARD_MS` is exported from `@auction/persistence/lib` (`notification-outbox-claim.ts:5`, `lib/index.ts`). It is used by the repository (`:107`) and the scheduler (`notification-outbox-wake-scheduler.ts:15`). The duplicate worker constant is gone.
- **Comment drift is fixed.** The "Debounce" comment now sits on the claim guard (`drizzle-notification-outbox.repository.ts:106`), and `CLAIMED_STALE_MS` has its own accurate comment (`:21`).
- **Failure metric.** Two counters are registered on the worker metrics registry (`apps/worker/src/lib/notification-outbox-wake-metrics.ts`, `health-server.ts`):
  - `auction_worker_notification_outbox_wake_total{outcome=drained|rows_failed|drain_failed}`;
  - `auction_worker_notification_outbox_wake_failed_rows_total`.

  A thrown wake drain is also sent to Sentry at level warning with tag `job:notification_outbox_wake` (`register-notification-outbox-workers.ts:83`). The runbook documents both (`docs/runbooks/bid-checkout-go-live-notes.md`).

### Unchanged since the last review and still correct

These still hold:
- signal on commit only, for new critical rows only;
- every staging path goes through `stage`;
- the minute sweep keeps its id and interval;
- the `NOTIFICATION_OUTBOX_WAKE_ENABLED` kill switch;
- idempotency: SKIP LOCKED, the Redis dedupe key and bucketed job ids;
- the settle delay is still greater than the claim guard (scheduler test).

## Commands run

I ran these locally against Postgres 16 and Redis 7, with every migration including 0403 applied and `db:roles` applied.

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | pass |
| `turbo run typecheck` (worker, api, persistence, bidding-runtime, db and their dependencies; 60 tasks) | pass |
| `packages/db` vitest, with DB | 230 files pass. 2 files (`migration-0257…`, `migration-0261…`) failed **only** in the shared, reused database: the 0383 rollback guard tripped on rows other tests had left there. Both pass on a fresh migrated database, as does the 0403 integration test, and CI `test` is green. The failure is environmental. |
| `packages/persistence` vitest, with DB | 176 files / 1076 tests pass |
| `packages/bidding-runtime` vitest | 18 files / 109 tests pass |
| `apps/worker` vitest, with DB and Redis | 265 files / 2175 tests pass (16 files skipped by env gates), including the previous `Invalid URL` suite now that a DB URL is set |
| `apps/api` vitest, with DB and Redis | 778 files / 7880 tests pass |
| PR's worker wake tests (unit and integration) | 28/28 pass. Delivery 1549 ms after commit. Backoff test 3.2 s. |
| Mutation: claim ignores the backoff | backoff integration test fails |
| Mutation: wake loop keeps going after failures | 2 wake-job unit tests fail |
| Mutation: `pg_notify` removed (SQL still valid) | 3/6 integration tests fail, **including the latency test** |
| `dump.rdb` at `bc1716bf` | parsed locally; test-only BullMQ and dedupe data, nothing sensitive |
| GitHub CI on `2995f36d` | all green (41 runs; 1 skipped by path filter) |
