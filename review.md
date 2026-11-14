# Review of PR #1377: Zoho Books signed notices and nightly status check (rehearsal)

Branch `bk14-books-notices` at `385e0d7e`, compared with `origin/main` at `3c911293`. This is an independent security and money review. The PR branch was not changed.

## Verdict: FIX FIRST

The signature check, fail-closed behaviour, `no-store`, the DIP route listing and the database grants are sound. The rule that Books never marks anything paid holds: I tested it directly, and mutation checks catch it.

Three things need fixing before merge:

- The migration number collides with other open PRs (F1).
- LAX's own card payment can be reported to finance as a "payment recorded in Books by hand". The runbook then tells finance to record it in LAX again (F2).
- The Books budget share the PR describes is not wired. Notice-driven reads have no cap at all (F3).

## Findings

### F1: High. Migration 0385 collides with open PRs #1375 and #1376

- **Where:** `packages/db/drizzle/0385_accounting_books_status.sql`, `0385_rollback.sql`, `meta/_journal.json` (new entry `idx 377`, `when 1811419200000`).
- **Scenario:** #1375 holds 0385. #1376 also uses 0385. All three PRs add a journal entry with the same `idx` (377) and the same `when` (1811419200000). The PR body says 0385 is "the next free number on main", which is true only until #1375 merges. The rollback deletes its ledger row `WHERE created_at = 1811419200000`. If two migrations shared that timestamp, rolling back one would also delete the other's ledger row. A shared or out-of-order `when` can also make the migrator skip a migration.
- **Fix:** Rebase after #1375 merges. Renumber to the next free number (0386, or 0387 if #1376 lands first), with its own `idx` and a later `when`. Update the rollback's `created_at`, the migration test file name, and the comments that say "index 0385".

### F2: High (money). LAX's own payment can become a "recorded by hand" finance task

- **Where:** `packages/persistence/src/repositories/accounting/drizzle-accounting-books-status.ts:94-114`, where `knownPaymentIds` only counts payment documents with `state = 'issued'` (line 106). Also `packages/accounting-domain/src/books-status.ts:137-145` and `docs/runbooks/monitoring-alerts.md:477`.
- **Scenario:** LAX sends a card payment to Books. Books records it, but LAX's payment document is not `issued` when the check reads the invoice. For example, it is `needs_review` with the Books id already known, or the send outcome is still unknown, so LAX has no Books id yet. The invoice read then shows a payment id LAX does not count as its own. The check opens a `books_payment_recorded_by_hand` task for it and adds the id to the snapshot, so it is never looked at again.
- **Reproduced:** In the Postgres integration fixture, run as `worker_app`, I set the LAX payment document to `needs_review` with its Books id. One notice-driven read opened one finance task for LAX's own payment.
- **Impact:** Nothing is marked paid automatically. But the runbook tells finance to "record the payment in LAX the usual way", so following it records the same money twice.
- **Fix:**
  - Treat a Books payment id as LAX's own whatever state LAX's payment document is in.
  - While the invoice has any LAX payment document that is not settled (`pending`, `sending`, `unknown`, `needs_review`, `failed`), do not open a task and do not add the unmatched ids to the snapshot. Look again on the next run.
  - Also consider matching Books' payment reference against LAX payment references.
  - Add a test for each state.
  - Change the runbook to say: first check that it is not a LAX card payment whose Books document is still unresolved.

### F3: Medium. The budget share is not wired, and notice reads have no cap

- **Where:**
  - `packages/accounting-zoho-books/src/adapter/index.ts:64`: `statuses` is built on the shared `api`, with no `CallBudgetShare`.
  - `CallBudgetShare` is used only in tests.
  - `accounting-status-check.service.ts:147-177`: `recheckFromNotice` reads with no cap.
  - `allowance.keepFree` is never read by the service.
  - `apps/worker/src/container/create-accounting-runtime.ts:71`: one `AccountingStatusCheck` per process.
- **Scenario:** The PR body and the runbook say the check stays within a share of the daily Books budget and keeps calls free for sending. In the code, the only limit is the nightly loop's local count of 300. Each notice causes up to 3 more reads, with no cap. Once the test-organisation client uses `createZohoBooksAdapter`, those reads come out of the sender's budget, and nothing keeps any calls free.
- **Second problem:** `CallBudgetShare` counts per instance ("the check builds one share for each run"). If it were wrapped around the reader the check holds now, which lives as long as the process, the check would stop reading for good after 300 calls.
- **Fix:**
  - Build a share for each run, for example from a factory the check calls in `runNightly`, and pass it to the reader.
  - Give notice reads their own small daily share.
  - Skip a notice-driven read when the document was checked in the last few minutes.
  - Make the status reader require a `CallBudget`, so it cannot be built on the shared budget by mistake.
  - Correct the PR body and runbook until this is done.

### F4: Medium. A captured notice can be replayed indefinitely

- **Where:** `packages/queues/src/zoho-books-notice.ts:32-40` and `zoho-books-notice-ingress-application.service.ts:101`.
- **Scenario:** The signature covers no timestamp. When a notice has no `event_time`, its dedupe key is the minute it was received. A signed notice copied from a log or a proxy is therefore accepted again every minute, forever. Together with F3, each replay spends Books calls the sender needs. Content is still never trusted, so there is no money impact.
- **Fix:**
  - Require `event_time` in the workflow's body, which is inside the signature.
  - Refuse notices whose `event_time` is older than about 24 hours, or too far in the future.
  - Throttle rechecks per document, as in F3.

### F5: Medium-Low. No rate limit on the notice route, and every refusal goes to Sentry

- **Where:** `apps/api/src/app.ts:205-208`. Xero and Postmark get `createRateLimitMiddleware`; `/webhooks/zoho-books/*` does not. Also `apps/api/src/infrastructure/zoho-books-notice-alerts.ts`.
- **Scenario:** The route is public. Every request without a valid signature, including ordinary internet scanning, raises an error-level Sentry event routed to finance on-call. That means alert fatigue, and an outside party can burn Sentry quota.
- **Fix:**
  - Add the same rate-limit middleware the Xero webhook uses.
  - Log `missing` at warn level.
  - Have the Sentry rule alert on a rate of `invalid` refusals, not on every event.

### F6: Low. The body is read in full before the size check

- **Where:** `apps/api/src/routes/zoho-books-webhook.ts:14`. `c.req.text()` runs with no body limit, and the 16 KiB check happens after the whole body is buffered.
- **Fix:** Put Hono's `bodyLimit` (16 KiB) on the route, or refuse on `Content-Length` before reading.

### F7: Low (money visibility). One Books payment split across two LAX invoices shows only one part

- **Where:** `packages/accounting-domain/src/books-status.ts:173`. The task key is `books:<org>:<payment id>`.
- **Scenario:** Staff record one cheque in Books against two LAX invoices. The first invoice read opens a task for the amount applied to that invoice. The second invoice's task has the same key and is dropped as a duplicate. Finance sees part of the cheque, against one reference.
- **Fix:** Put the invoice reference in the key, or add the amounts to the existing task. Add a test.

### F8: Low. Two checks of one document at once write duplicate history rows

- **Where:** `accounting-status-check.service.ts:179-206`. `previous` is read outside the transaction, and `record()` overwrites whatever is there.
- **Reproduced:** Two `recheckFromNotice` calls on separate `worker_app` pools, both reading before either committed. Result: one finance task and one payment change, which is correct. But two `state_changed` rows (`null->paid` twice) landed in the append-only table, where they can never be removed. Whichever transaction commits last also clears a recheck request that arrived in between.
- **Fix:** Inside the transaction, lock the document (an advisory lock on its id, or `SELECT … FOR UPDATE` on the status row). Read `previous` again there and decide from that.

### F9: Low. Some guards have no test

Two mutations survived the PR's own tests:

- Removing `.onConflictDoNothing()` on the hand-payment change insert (`drizzle-accounting-books-status.ts:165`). Only my concurrent test caught it: one of the two runs failed with a unique violation.
- Removing `!secret` from `verifyZohoBooksSignature` (`zoho-books-notice-signature.ts:41`). The service's own 503 guard still covers it. The library test for "an empty secret" does not use a signature made with the empty secret.

**Fix:** Add a concurrent-check integration test and an empty-secret test with a matching signature.

### F10: Low. The missed-run alert can stay silent for a check that has never run

- **Where:** `create-accounting-runtime.ts:134`, where `expectedSince` is the time the process started.
- **Scenario:** No run has ever finished, and the worker restarts at least once every 26 hours (normal deploys). The 26-hour window keeps restarting, so `accounting_status_check_missed` never fires.
- **Fix:** Base it on a stored time, such as when Books was first aimed at a product or the first row in `accounting_books_status_run`. Otherwise rely on the cron monitor and say so in the runbook.

### F11: Info. Known gaps the PR already lists

- The Terraform Sentry rules for both alerts are missing, and so is the `accounting-reconcile` monitor slug. Until they land, neither alert reaches anyone, and the cron check-in is skipped when there is no slug.
- The signature format has not been checked against a real Books test-organisation webhook.
- No separate Zoho Books plan rules document exists under `docs/runbooks`. The rules I checked against are the ones in `monitoring-alerts.md`, the PR body, and the code comments.

## Checked and fine

- **Signature:**
  - Base64 HMAC-SHA256 over the parameters, sorted by name and then value, with the raw body string from `c.req.text()` appended.
  - The comparison uses `timingSafeEqual` on equal-length buffers.
  - The header must be well-formed Base64 and at most 128 characters.
  - With no secret, every request gets 503 and nothing is stored.
  - Refusals have no body and say nothing about the reason. The alert carries only `missing` or `invalid`.
- **Dedupe:** the same Books ids with the same `event_time` are stored and queued once. `webhook_event.event_key` is unique, and the prefixed hash avoids clashes with other sources.
- **Content never trusted:** the API stores only the organisation, module, entity id and time. The worker uses only those ids. The organisation must be one of the configured ones, and the document must be an issued Books document in a mode the check serves. The reader believes a read only when the document carries its LAX reference.
- **Never marks paid:** the decision type cannot express "paid". An integration test run as `worker_app` shows the invoice, payment and lot rows unchanged. The finance task is opened in the same transaction as the record, and the recorder takes an advisory lock and has a unique index, so the race produced one task.
- **Cron:** BullMQ worker with concurrency 1, 02:15 Europe/London, 2 attempts with a 1-hour backoff, a Sentry cron monitor and a heartbeat. The run row is closed as `failed` when a run fails.
- **Route:** listed in `check-finance-routes-dip.mjs`, goes through `container.finance`, and every answer, including refusals, sends `Cache-Control: no-store`. The Origin check exempts `/webhooks/`.
- **Grants, probed as the real roles after `db:migrate` and `db:roles`:**
  - `worker_app` can select and insert on all three tables.
  - It can update only the named columns. Updating `started_at` or `document_id` is refused.
  - `DELETE` and `TRUNCATE` are refused.
  - `api_app`, `shop_app` and `auth_app` are refused even `SELECT` on all three tables.
  - The change table's append-only trigger is present.

## Mutation checks

Each mutation was applied to a scratch copy, the affected package was rebuilt, and the relevant tests were run.

| Mutation | Result |
|---|---|
| Plain `equals` instead of `timingSafeEqual` | caught |
| Query parameters left out of the signed text | caught |
| Signing the re-serialised JSON instead of the raw body | caught |
| Ignoring value order for repeated parameters | caught |
| Service fails open with no secret | caught |
| Verification skipped | caught |
| No alert on an invalid signature | caught |
| Size check after verification | caught |
| `no-store` removed | caught |
| Random dedupe key | caught |
| Whole body stored | caught |
| Hand payment treated as LAX's own | caught |
| Per-run cap removed | caught |
| Stop on spent budget removed | caught |
| Task opened outside the transaction | caught |
| LAX payment ids ignored | caught |
| Notice accepted for any organisation | caught |
| Missed-run alert never raised | caught |
| Reference check in the reader removed | caught |
| `CallBudgetShare` `keepFree` removed / cap removed | caught |
| `!secret` removed from the library function | **survived** (F9) |
| Payment-change `onConflictDoNothing` removed | **survived** (F9; caught only by the added concurrent test) |
| `kind = payment` filter dropped from `knownPaymentIds` | survived (harmless on its own) |

## Test runs

Environment: Postgres 16 throwaway cluster on port 55432, `db:migrate` and `db:roles` applied, `--maxWorkers=2`.

- **`packages/accounting-domain`:** 295 passed.
- **`packages/accounting-zoho-books`:** 318 passed.
- **`apps/worker`:** 1822 passed, 477 skipped (integration suites gated on other environment variables). The Books status-check integration test ran as `worker_app` and passed.
- **`apps/api`:** 7435 passed, 1 failed. The failure is `accounting-queue.integration.test.ts`. It passes on its own against a freshly migrated database, so it comes from data earlier suites left in the shared database, not from this branch, which does not touch that code.
- **`packages/db`:** the 0385 migration test, the 0384 test, `migrate-roles` and the `api_app` and `worker_app` contracts passed. The one failure ("cannot delete bid rows") came from my `WORKER_ROLE_CONTRACT_REQUIRED=true` setting on a database with no bids. It is not caused by this PR.
- **Added scratch tests (not pushed):** two concurrent rechecks on separate pools (F8), and a LAX payment in `needs_review` (F2).
