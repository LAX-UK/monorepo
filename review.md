Verdict: FIX FIRST

# Independent review of PR #1570: Zoho runtime audit fixes (F5, F6, F7, F9, F10, F11)

Reviewed head `b199cf5c` (branch `fix/zoho-runtime-audit`) against base `origin/main` `33ca431d`. Each fix was checked against what `findings.md` (branch `review-notes-systems-final-audit`) asked for. The PR branch was not changed.

One finding blocks: F9 is only partly fixed. Every stack now gets the same limiter object, but that limiter's spacing does not hold when callers overlap. The combined rate cap that F9 asked for, and that the PR and docs now claim, does not exist in the case F9 is about: several stacks calling Zoho at the same time. The other five fixes are correct.

## Test and typecheck run

Run on a throwaway Postgres 16 on :55432 (after `db:migrate` and `db:roles`) with local Redis, using `vitest run --maxWorkers=2`:

| Package | Result |
|---|---|
| @auction/persistence | 1152 passed, 19 skipped (186 files). This includes the new `drizzle-zoho-listing-lock.integration.test.ts`. |
| @auction/worker | 2292 passed, 467 skipped (299 files) |
| `tsc --noEmit` on worker and persistence | clean |
| The three changed workflows | parse as YAML. actionlint was not available. |

## Blocking

### B1. The shared limiter does not space concurrent calls, so F9's combined cap is not met

- **Where:** `apps/worker/src/integrations/zoho/zoho-crm-gateway-limiter.ts:99-103`. The PR relies on it at `create-zoho-crm-gateway.ts:13-26`, and `docs/integrations/zoho.md:330` makes the claim.
- **The defect:** `guard()` reads `this.lastCallMs`, sleeps, and only then sets `lastCallMs`. Callers that arrive inside the same 100 ms window all compute the same wait from the same old `lastCallMs`, and then all call Zoho together. Nothing reserves a slot before the `await`.
- **Reproduced:** a scratch test outside the PR ran one call, then 5 concurrent calls on one `ZohoCrmGatewayLimiter`. The gaps between the inner calls were `[100, 0, 0, 0, 0]` ms: all five fired in the same millisecond.
- **Why it matters here:** before this PR, each stack mostly ran its own calls one after another, so the per-stack spacing mostly held. F9 is specifically about stacks running in parallel. They do run in parallel in one worker:
  - the projector runner (`main.ts:16`) handles CRM sync, write-back, listing, location and fulfilment deliveries;
  - the separate listing queue (`workers/register-zoho-listing-worker.ts:31`) runs the listing pass and its Status pass;
  - the webhook queue runs the standalone Status nightly and the artwork nightly check.
- **Result:** the PR's "the combined Zoho API rate is now capped" and zoho.md:330 ("share one 100 ms call spacing … their combined rate … is capped together") are not true while the go-live catch-up, the nightly Status pass and the listing overlap.
- **What does work:** the circuit breaker is shared, and its per-call behaviour is unchanged (5 consecutive transient failures open it for at least 60 s; an open circuit throws a retryable 503 before calling). That part of F9 is met.
- **Fix:** reserve the slot synchronously before awaiting, for example:

  ```ts
  const slot = Math.max(now, this.nextSlotMs);
  this.nextSlotMs = slot + MIN_INTERVAL_MS;
  if (slot > now) await sleep(slot - now);
  ```

  Do this after the circuit check. If the circuit opens while a caller waits, re-check after the sleep. Add a test that fires N concurrent calls and asserts each gap is at least 100 ms. The current `create-zoho-crm-gateway.test.ts` only checks that the instance is shared and that the circuit is shared.

## Verified fixed

### F5. Plan and drift-check TF_VARs: fixed

- `terraform-plan.yml:112-127` and `terraform-drift-check.yml:82-97` add a step with `if: matrix.env == 'test'`. It writes the five `TF_VAR_*` values to `$GITHUB_ENV` before any Terraform step.
- Names and fallbacks are identical to `terraform-test-up.yml:193-198` and `terraform-apply-test.yml:160-165`: `dry_run`, `dry_run`, `dry_run`, `off`, and the secret.
- The prod matrix legs get nothing, so prod plans keep infra's defaults. No `*-prod.yml` file is touched.
- The secret comes from `secrets.*`, so it is masked, and no value is hard-coded. The YAML parses.

### F6. Maintenance workflow fallbacks: fixed

- `zoho-crm-maintenance-test.yml:38` now falls back to `dry_run` for `ZOHO_CRM_SYNC_MODE`, and `:51` to `dry_run` for `ZOHO_FULFILMENT_MIRROR_MODE`.
- `ZOHO_CRM_LEAD_CONVERSION_ENABLED` is removed. Nothing in `apps/worker/src` reads it.
- The consumer input now explains why `zoho_artwork_location` is absent.
- This is a test-only workflow, and the YAML parses.

### F7. Docs for infra-only variables: fixed and accurate

- `docs/integrations/zoho.md:44-56` removes `SHOP_ZOHO_CATALOGUE_SYNC_ENABLED` from the workflow-passed table and adds an infra-repo table.
- Each stated default matches the code:
  - `SHOP_ZOHO_CATALOGUE_SYNC_ENABLED` and `SHOP_ZOHO_FINANCIALS_ENABLED` default to `false` (`env.ts:297-302`);
  - `ZOHO_CAMPAIGNS_SUPPRESSION_SYNC_MODE` defaults to `off` (`env.ts:248`);
  - `ZOHO_CRM_EXPECTED_ORG_TYPE` is optional, and start-up refuses a non-`sandbox` value outside production when any mode is live or canary (`env.ts:568-574`);
  - shop-api's three mirror modes are optional with no default (`apps/shop-api/src/env.ts:146-148`).
- One part of zoho.md is not accurate: the Pacing paragraph at :330 states the combined cap. See B1.

### F9. One limiter per process: wiring correct, spacing not (see B1)

- **Wiring:** `zohoCrmGatewayLimiter` caches one limiter per `WorkerEnv` object in a WeakMap.
  - `createWorkerContainer` parses the env once (`create-worker-container.ts:150`) and passes the same object to every factory: CRM sync (`:173`), artwork sync reads (`:396`, through `createZohoCoqlQuery`), write-back and its Status (`:397`), listing and its Status (`:398`), location (`:399`), fulfilment (`:400`), QC (`:401`) and the standalone Status nightly (`:444`).
  - No factory spreads or copies `env`.
  - Every Zoho CRM stack therefore reaches the one limiter. The token-sharing callers outside the limiter (product pictures, org check, integration-user lookup, Campaigns) are documented.
  - Ops scripts are separate processes with their own limiter, as stated.
- **Single-flight token refresh** (`oauth-token-refresh.ts:44-66`) is correct:
  - concurrent misses share one promise;
  - on failure the observer is called once and the error reaches every waiter;
  - `finally` clears `inflight` only if it is still the same promise, so nothing stays stuck;
  - the next call starts a new refresh;
  - `cached` is set before the promise resolves.
- **Metrics:** `getMetrics` now reports the process-wide `apiCreditsRemaining`, which is an improvement.

### F10. OAuth trio required unless off: fixed and safe for current configs

- `env.ts:599-609` now requires the trio when `ZOHO_ARTWORK_WRITEBACK_MODE` is not `off`.
- Every workflow falls back to `off` for this mode: terraform-test-up, apply-test, apply-test-dispatch, test-down, plan, drift-check, apply-prod and the maintenance workflow.
- The same workflows also pass `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET` and `ZOHO_REFRESH_TOKEN`.
- No compose file or `.env*` example sets `dry_run`.
- So no deployed default changes behaviour. A worker that sets `dry_run` without the trio now fails at start-up, which is what F10 asked for. The env tests cover full, missing and partial credentials.

### F11. Session-level advisory lock on a dedicated connection: fixed

Code at `drizzle-zoho-listing.ts:321-353`.

- **Release:** locks are released in `finally` on both success and a throw from `fn`, in reverse order.
- **Failures:** if a lock or unlock query fails, `release(true)` destroys the connection, which ends the session and drops its locks. A crash drops the socket, and Postgres releases session locks then.
- **Deadlock and exclusion:**
  - keys are de-duplicated and sorted, so there is no deadlock between holders;
  - the key format and `hashtext` are unchanged, and the only holders are this class's three users (listing, Status, location), so exclusion is the same as before;
  - session locks are re-entrant only within one session, and each `withLock` call checks out its own connection, so two calls in one process still exclude each other.
- **No open transaction:** none is open while `fn` runs. The integration test checks `xact_start IS NULL`, that an overlapping holder waits, and that locks are released on a throw.
- **Pool use:** one connection per batch, the same as before. The extra connection a waiter holds is also unchanged.
- **Failure before locking:** if `pool.connect()` fails, it fails before the `try`, so nothing leaks.

## Non-blocking notes

1. **The token fetch has no timeout** (`oauth-token-refresh.ts:70`). With single-flight, one hung refresh now stalls every Zoho caller in the process until undici's 300 s header timeout fires. Before, each caller hung separately. Consider `signal: AbortSignal.timeout(15_000)`.
2. **A dropped held connection can crash the process.** The checked-out lock connection has no `'error'` listener: pg-pool removes its idle listener on checkout (`pg-pool/index.js:344`). If the server drops that connection while `fn` runs, `pg.Client` emits an unhandled `'error'` and the process can crash. The locks are still released. This was the same with the old `db.transaction` approach, so it is not a regression. Attaching a no-op listener for the hold, and destroying the connection on release, would harden it.
3. **The shared circuit breaker counts across all stacks.** A success on one stack resets the consecutive-failure count for the others. This follows from "one circuit breaker" as F9 asked; it is noted only so it is a known behaviour.

## Fixes after review

Pushed to `fix/zoho-runtime-audit` as `630268e9` (B1) and `1937641c` (notes 1 and 2).

- **B1, limiter spacing (fixed).** `apps/worker/src/integrations/zoho/zoho-crm-gateway-limiter.ts:103-112`: after the circuit check, `guard()` reserves its slot synchronously (`slot = max(now, nextSlotMs)`, `nextSlotMs = slot + 100`) before awaiting, then re-checks the circuit after the sleep (`:111`). The circuit check is `throwIfCircuitOpen` (`:89`), the same retryable 503.
  - Tests in `zoho-crm-gateway-limiter.test.ts`: `:90` fires 6 concurrent calls on one limiter and asserts every gap is at least 100 ms; `:112` asserts an open circuit throws the retryable 503 without calling Zoho; `:133` queues a sixth call behind five failures and asserts it gets the 503 without calling Zoho, because the circuit opened while it waited. The `:90` and `:133` tests fail against the old limiter.
  - `docs/integrations/zoho.md:330` still states the combined cap, which is now true. It also says each call reserves its slot before waiting, that a queued caller gets the 503 if the circuit opened meanwhile, and that one success on any stack resets the shared failure count (note 3).
- **Note 1, token fetch timeout (applied).** `apps/worker/src/integrations/zoho/oauth-token-refresh.ts:75` aborts the refresh after 15 s (`AbortSignal.timeout`). This is reported as `zoho_token_refresh_unreachable`. Test `oauth-token-refresh.test.ts:71`. Documented at zoho.md:330.
- **Note 2, dropped lock connection (applied).** `packages/persistence/src/repositories/artwork-register/drizzle-zoho-listing.ts:339` attaches an `'error'` listener for the hold. The listener marks the connection to be destroyed, and the listener is removed before `release`. Integration test `drizzle-zoho-listing-lock.integration.test.ts:106` terminates the holding backend while `fn` runs. Without the listener the run reports an unhandled `57P01` error. With it, `fn` completes, the locks are gone and the next `withLock` succeeds.
- **Note 3:** no code change. It is now a line in zoho.md:330, as above.

Re-run on Postgres 16 :55432 with Redis, `vitest run --maxWorkers=2`:

| Package | Result |
|---|---|
| @auction/worker | 2406 passed, 508 skipped (299 files) |
| @auction/persistence | 1160 passed, 11 skipped. One failure, `consignor-agreement.integration.test.ts` "lets one of two replaces of the same version win", is a race test in an untouched file. It passed on 2 of 2 reruns. |
| `tsc --noEmit` (worker, persistence) and biome on the changed files | clean |
