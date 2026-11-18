Verdict: SHIP

# Review of PR #1559: Zoho Books shares the rate window, call budget and token-refresh lock across processes

Reviewed head `37cde100` against base `122b816a` (10 files, +629/-27). The PR branch was not changed.

## Was the problem real on main?
Yes. On main the rate window is an array per `OrgGate` (`packages/accounting-zoho-books/src/gate.ts`), the budget defaults to `InMemoryCallBudget` (`src/client.ts`), and refresh single-flight is a per-process `Map` (`src/token-manager.ts:60`). The README on main lists this as a known gap ("Per process, not shared"). The new unit test `shared-limits.test.ts:50` and `:124` reproduces it with the default (main) path: two clients send twice the limit and make two refreshes, and one of them fails.

## What was checked
- **Infrastructure the worker already has.** The worker builds an ioredis client from `REDIS_URL` (`apps/worker/src/container/create-worker-container.ts:184`), and `finance-runtime` already depends on `ioredis`. No new service and no migration.
- **Limits are actually shared.**
  - `RedisCallBudget` runs the check and the increment in one Lua script, so two replicas can never both take the last call.
  - `RedisRateWindow` keeps a sorted-set sliding window, and its script reads Redis `TIME`, so every replica uses the same clock. Each entry is a random UUID, so two requests in the same millisecond cannot overwrite each other. Expiry uses `ZREMRANGEBYSCORE ... now-window`, which matches the in-process `>= WINDOW_MS` rule. Redis 7 (used in CI) replicates script effects, so calling `TIME` before writes is allowed.
  - The concurrency cap (5) is still per process, and the PR body says so.
- **One refresh, no stale token.**
  - `ZohoTokenManager.obtain` (`token-manager.ts:98`) runs load, refresh and save under the shared lock.
  - A process that waited for the lock re-reads the store. It uses the stored token if that token is fresh and is not the one Zoho just refused (`loadOrRefresh`). Otherwise it refreshes.
  - The in-process single-flight still sits in front of the lock, so each process takes the lock at most once at a time.
  - The `ran` flag keeps the error from `work` separate from "could not get the lock". Only the second becomes `refresh_lock_unavailable`.
  - The lock is released with an owner check (Lua compare-and-delete), so an expired lease cannot delete another holder's lock.
- **Fail-safe.**
  - A window read error throws `ZohoRateLimitedError{source:"local", code:"rate_window_unavailable"}`. Local rate-limit errors are not retried (`client.ts:405`).
  - A lock failure throws `ZohoAuthError{refresh_lock_unavailable}`, which is a rejection, not `needsReauth`, so the connection is not marked broken.
  - Budget errors already map to `budget_unavailable`.
  - Every failure happens before anything is sent, so no document can be lost or posted twice by this change. A slot that is taken and then not used (for example because the budget is spent) still counts, which is the conservative direction.
- **Keys and TTLs.**
  - Keys are `zoho_books:{budget|rate|refresh_lock}:<orgId>[:<UTC day>]`, one set per organisation. Zoho's limit is per organisation, so that is the right scope.
  - There is no environment segment, but each environment has its own `REDIS_URL` and existing worker keys (`worker:heartbeat:*`) follow the same convention. This is fine.
  - TTLs: the budget key lives 2 days (it outlives the day it counts), the rate set lives one window, and the lock lease is `requestTimeoutMs + 10s`. All are reasonable.
- **Secrets.** No new logging. Keys and lock values hold only the org id and a random UUID. Token handling and redaction are unchanged.
- **Design.** Two small ports (`RateWindow`, `RefreshLock`) next to the existing `CallBudget`. The Redis adapters live in `finance-runtime`, so the Books package does not depend on Redis. Not passing the new deps leaves behaviour unchanged. The change is small and follows dependency inversion, and `lint:layers` is clean.

## Tests run (on the PR head, in a throwaway worktree)
- `accounting-zoho-books`: `vitest run --maxWorkers=2`: 16 files, **355 passed**. `tsc --noEmit` passes.
- `finance-runtime` with `REDIS_URL` pointing at a throwaway Redis 7.0.15: `vitest run --maxWorkers=2`: 36 files, **263 passed**, including all 4 Redis integration cases (two replicas share the per-minute limit, share one daily budget and make one refresh; nothing is sent when Redis is unreachable). `tsc --noEmit` passes.
- `biome check` on both packages passes. `pnpm lint:layers` passes.
- Postgres was not needed: neither suite has database-backed tests for this change.

## Findings (none block)
1. **Fail-closed becomes a hang with the worker's real Redis connection.** `packages/finance-runtime/src/books/redis-zoho-books-limits.ts:84`, `:120`. The worker's client is built with `maxRetriesPerRequest: null` and the offline queue enabled (`apps/worker/src/container/create-worker-container.ts:184-189`). With that connection, a command sent while Redis is down stays pending forever instead of rejecting. I checked this: a `SET NX PX` against an unreachable host with those options was still pending after 4s. In that case `take`/`withLock`/`consume` never reject, so the `rate_window_unavailable` / `refresh_lock_unavailable` refusals and the gate's `maxQueueWaitMs` deadline never fire. Calls hold their concurrency slots until Redis returns. It is still safe: nothing is sent and the limits hold once Redis is back. The integration test covers "unreachable" only with `enableOfflineQueue:false, maxRetriesPerRequest:0` (`redis-zoho-books-limits.integration.test.ts:118-121`). Before this is wired into the worker, either pass a dedicated connection with a bounded `maxRetriesPerRequest` and `commandTimeout`, or put a timeout around each Redis call in the adapters, and say which in the `redisZohoBooksLimits` doc comment.
2. **The lease can expire during a slow refresh.** `redis-zoho-books-limits.ts:143`. The lease is `requestTimeoutMs + 10s`, but `work` also includes the token store's load and save, which are Postgres calls with no timeout of their own. If those take longer than 10s, the lease expires and a second replica can refresh at the same time. Its compare-and-set save then loses (`connection_changed`). That costs one failed call and the store version guard keeps the data correct, so this is not a correctness problem. A larger margin, or extending the lease while work runs, would make it tighter.
3. **Minor: the budget day comes from the process clock.** `redis-zoho-books-limits.ts:65`. The UTC-day key uses the replica's clock, while the rate window uses Redis `TIME`. Replicas whose clocks disagree around midnight could briefly count into two different day keys. The effect is negligible and it does not need to change.

## Verdict
The problem was real and the fix is correct, atomic and covered by tests that show two clients sharing one limit, one budget and one refresh. It can never exceed Zoho's limits or post a document twice. Finding 1 should be fixed when the client is wired into the worker, which this PR does not do yet. **SHIP.**
