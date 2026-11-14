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

## Fixes after review

Fixes were committed on `bk14-books-notices` on top of `96903a8c`, with normal pushes. Each guard added was mutation-checked: the guard was reverted, a test was seen to fail, and the guard was restored. Postgres 16 throwaway cluster on port 55432, `db:migrate` and `db:roles` applied, integration tests run as `worker_app`, `--maxWorkers=2`.

| Finding | Fix | Commit | Test | Mutation |
|---|---|---|---|---|
| F1 High: migration 0385 collides | **Not done.** PR #1375 (`bk9-bid-refunds`) is not merged to `origin/main` yet, so the number was left as is. Renumber after #1375 merges. | none | none | none |
| F2 High: LAX's own payment can become a hand-payment task | A Books payment id is LAX's own when any LAX payment document holds it, whatever its state. It is also LAX's own when it carries the reference of a LAX payment on the invoice that has no Books id yet. While any LAX payment applied to the invoice is not settled (pending, sending, unknown, needs review, failed), the invoice's other Books payments open no task and stay out of the snapshot (`heldBack`). The next read looks at them again. The Books reader now reads the payment's `reference_number`. Runbook: "first check that it is not a LAX card payment whose Books document is still unresolved". | `f6f9405b` | Domain: reference match, reference not enough once the Books id is known, held back then reported once settled. Integration as `worker_app`, one case per state (pending, sending, unknown, needs_review with id, needs_review with lookup owed, failed, issued, cancelled). Second Books payment with LAX's reference on an issued payment is reported. | Count only `issued` ids: caught (7 cases). `unresolved` always false: caught (6 cases). No reference match: caught. Held-back id kept in snapshot: caught. Hold-back removed: caught. Every applied reference matched, not only those with no Books id: caught. |
| F3 Medium: budget share not wired; notice reads uncapped | The client takes a per-call `budget` on `get`. `ZohoDocumentStatusReader` requires a `CallBudget` and counts every read against it. `AccountingPorts.statuses` is now `DocumentStatusReaders.withinShare(allowance)`: each reader sits on a fresh `CallBudgetShare` of the budget the client counts against. `createZohoBooksAdapter` requires that `budget`. A read is counted once, against the share and the day. The check builds a share in each `runNightly`, plus one separate daily share for notice reads (`DEFAULT_NOTICE_READ_ALLOWANCE`: 50 calls, 400 kept free). A notice for a document read in the last 10 minutes is not read again; its mark stays. The runbook was updated. The PR body still needs updating (see below). | `411662c0` | Adapter: a reader stops after its share; one read adds exactly one to the day's count; a new share reads again; `keepFree` stops a read with nothing sent; a spent share sends nothing while the client's own budget is untouched. Service: a fresh share per run (second night reads again); the default share; notices share one daily allowance apart from the night's, with a new share the next day; the recent-read skip. | Process-long share: caught. A share per notice: caught. Notice reads on the night's share: caught. Recent-read skip removed: caught. Reader ignores its budget: caught. Client ignores the per-call budget: caught. |
| F4 Medium: a captured notice can be replayed | `event_time` is required in the signed body. A notice is refused with a bare 400 if `event_time` is missing, not a string, unparseable, older than 24 h, or more than 5 min ahead of our clock. The dedupe key now comes only from Books' ids and that time; the received-minute fallback was removed. Reads are throttled per document as in F3. | `ee4fd315` | Refused: missing, not a date, numeric, stale, and future `event_time`. Accepted: just inside both bounds. | Freshness check removed: caught. Age bound removed: caught. Ahead bound removed: caught. String-type check removed: caught. |
| F5 Medium-Low: no rate limit; every refusal to Sentry | The route uses `createRateLimitMiddleware` (per client address, as for Xero and Postmark) before anything is read. `missing` is logged at warn only, with no Sentry event. `invalid` is logged at error and sent to Sentry as a warning with a fixed fingerprint (one issue), so the rule can page on a rate. The worker's alert listing was changed to `warning`. Runbook: the rule should page on a rate (for example more than 10 an hour). | `aa47f9aa` | A route with a denying store returns 429, and the service and alert are never called. Alerts test: `missing` goes to warn with no Sentry event; `invalid` goes to Sentry with a warning level and fingerprint. | Rate limit removed: caught. `missing` sent to Sentry: caught. Fingerprint removed: caught. |
| F6 Low: body read before the size check | Hono `bodyLimit` (16 KiB) on the route returns a bare 413 with `no-store`. It refuses on the declared length, or as the body streams past the limit. | `ee4fd315` | Over 16 KiB with a length: 413, service never called. A streamed body with no length: 413, service never called, and the stream stops early. | Limit raised to 10 MiB: caught (both tests). |
| F7 Low: split payment shows one part | Task key is `books:<org>:<payment id>:<LAX invoice reference>`. The runbook says one task per Books payment and invoice. | `e62c11d3` | Integration: one cheque against two invoices gives two tasks, each with its own reference and amount. | Invoice reference dropped from the key: caught. |
| F8 Low: concurrent checks write duplicate history | `lockForRecord` takes `pg_advisory_xact_lock` on the document inside the transaction and re-reads the snapshot. The decision is made from that snapshot, in the transaction. `record` clears a recheck only if it was asked before the read began. | `7646efe6` | Integration: two `recheckFromNotice` calls on two separate `worker_app` pools, both reading before either records, give one `null→paid` change, one payment change and one task. A notice that arrives during a read keeps its mark. | Lock removed: caught. Decision made from the earlier read: caught. Recheck always cleared: caught. |
| F9 Low: two surviving mutations | Tests added for both. | `7646efe6`, `ee4fd315` | A hand payment recorded twice for one document is held once, and the second record does not fail (integration). An empty secret with a signature made using the empty secret is refused. | `onConflictDoNothing` removed: caught. `!secret` removed: caught. |
| F10 Low: missed-run alert silent across restarts | When no run has ever finished, the window starts at the first run ever started (`firstStartedRunAt`, stored). It falls back to the worker's start only when no run has ever started. The runbook says that case relies on the `accounting-reconcile` cron monitor. | `8ce4f1af` | Watch: runs started but never finished, worker restarted a minute ago, gives an alert after the first run is 26 h old and not before. Integration: `firstStartedRunAt` equals the earliest run row. | First run ignored: caught. Latest run used instead of the first: caught. |
| F11 Info | Not changed: the Terraform Sentry rules (including the rate rule for `invalid`) and the `accounting-reconcile` slug are still missing. | none | none | none |

### Test runs after the fixes

- **`packages/accounting-domain`:** 298 passed.
- **`packages/accounting-zoho-books`:** 320 passed.
- **`packages/finance-runtime`:** 253 passed.
- **`packages/queues`:** 72 passed.
- **`apps/worker`:** 1842 passed, 477 skipped (integration suites gated on other environment variables). The Books status-check integration suite ran as `worker_app`: 15 tests.
- **`apps/api`:** 7444 passed, 1 skipped. `pnpm lint`, including the finance DIP and route-coverage checks, is clean.
- **`packages/db`:** the 0385 migration test, `migrate-roles`, the `worker_app` contract and the main-upgrade lineage test passed: 105 passed, 23 skipped.
- **`packages/persistence`:** 948 passed, 1 failed. The failure is `atg-public-catalog.sql.integration.test.ts`. It passes on its own against a freshly migrated database, so it comes from data earlier suites left in the shared database. This branch does not touch that code.
- `tsc --noEmit` is clean for `persistence`, `finance-runtime`, `accounting-zoho-books`, `apps/worker` and `apps/api`. Biome is clean.

### PR body changes still needed

I could not change the PR body through git, so these edits are listed here for whoever updates it:

- **Budget:** say that each nightly run reads within its own `CallBudgetShare` (300 reads, 400 calls kept free). Notice-driven reads have a separate daily share (50 reads, 400 kept free). A notice does not read a document that was read in the last 10 minutes. The status reader requires a `CallBudget`, and `createZohoBooksAdapter` requires the client's `budget`.
- **Notice body:** `event_time` is required, not optional. Notices are refused when it is missing, more than 24 h old, or more than 5 min ahead. The body limit is 16 KiB, enforced before reading. The route is rate limited.
- **Alert:** `missing` signatures are logged only. `invalid` goes to Sentry as a grouped warning, and the rule should page on a rate.
- **Hand payments:** a Books payment is LAX's own in any state of LAX's payment document, or by reference when LAX has no Books id. Hand payments wait while a LAX payment on the invoice is unsettled. The task key includes the invoice reference.
- **Concurrency:** each document's record is taken under an advisory transaction lock.
- **Missed-run alert:** it counts from the first run ever started. A cron that never fires relies on the `accounting-reconcile` cron monitor.
- **Migration:** the body says 0385 is "the next free number on main". That holds only until #1375 merges, so it still needs renumbering then (F1).

## Final recheck

Branch `bk14-books-notices` at `8ce4f1af`, the same head the fixes above were written for. The PR branch was not changed. Postgres 16 throwaway cluster on port 55432, `db:migrate` and `db:roles` applied, Books integration tests run as `worker_app`, `--maxWorkers=2`. No `next build`.

### Verdict: FIX FIRST

F3 to F10 are fixed, and every guard listed for them was mutation-checked again: each mutation was caught (table below). F2 is fixed for what it was raised for: LAX's own payment is never reported as a hand payment. But the hold-back added for F2 has no end. A real payment recorded by hand in Books can stay unreported for good, with nothing telling finance it exists. That is a new Medium (F12), and on this last round a Medium blocks.

### F12: Medium (money visibility). A hand payment can be held back for good

- **Where:**
  - `packages/persistence/src/repositories/accounting/drizzle-accounting-books-status.ts`: `SETTLED_PAYMENT_STATES` and `unresolved`.
  - `packages/accounting-domain/src/books-status.ts`: `decideBooksStatus`, the `heldBack` branch.
  - `accounting-status-check.service.ts`: the hold is logged only at info (`accounting_status_payments_held_back`).
- **Scenario:** A LAX payment applied to the invoice is in `needs_review` with `lookup: "clear"` and its Books document known. Books holds it, but its totals differ from LAX's. The life cycle has no way out of that state. `requeue`, `release` and `cancel` all refuse it ("a person must resolve it"), and no action in the code resolves it. While it stays there, `unresolved` is true for the invoice. Any other Books payment on that invoice is held back on every read: no task, no snapshot entry, and no alert.
- **Reproduced:** In a scratch integration test (not pushed), run as `worker_app`, the LAX payment was put in that state and a separate cheque was added to the Books invoice. Thirty notice-driven reads, one per simulated day, opened no task for the cheque. The snapshot never held it, and nothing above info level mentioned it.
- **Why it matters:**
  - The `needs_person` alert does fire for LAX's payment document, but it says nothing about the cheque waiting behind it.
  - The runbook says the hold lasts "until finance resolves it on the accounting attention list". For this state, LAX gives finance no action that resolves it.
  - Nothing is marked paid, so no money moves wrongly. The risk is that money received is never seen by finance.
- **The hold is also wider than it needs to be:**
  - A LAX payment whose Books id LAX already holds is matched by that id. It does not make other payments ambiguous.
  - `failed` means Books refused it outright, so there is nothing in Books to confuse with.
  - A parked or withheld `needs_review` (`lookup: "clear"`, no Books document) was never sent.
  - Only `sending`, `unknown` and `needs_review` with a lookup owed can be in Books without LAX knowing its id. A `pending` that was never sent cannot.
- **Fix (either is enough to unblock; both are better):**
  - Treat a LAX payment as unresolved only while its Books identity really is unknown: `sending`, `unknown`, or `needs_review` with `lookup = 'owed'`. Those settle on their own through the lookup.
  - Bound the hold. Store when a payment was first held, for example `held_since` per Books payment id on the status row. After N days (3 is suggested), raise a warning alert naming the invoice reference, or open the finance task with a "possibly LAX's own, check first" note. Add a test where a payment held past N days is surfaced, and check that the test fails without the bound.
  - Update the runbook to match.

### Recheck of each finding

| Finding | Correct | Regression in touched code | Guard tested (mutations re-run) |
|---|---|---|---|
| F1 migration number | Not blocking, as instructed. Nothing at runtime uses the 0385 name or number: no SQL, schema or role code reads it. It appears only in comments and in test files. The migration SQL does not reference its own tag or ledger row. Its object names do not overlap with main's `0385_accounting_credit_note_refunds`. | none | n/a |
| F2 LAX's own payment | Yes. It is LAX's own by Books id in any document state, or by reference when there is no Books id. Other payments are held while a LAX payment is unsettled. A held payment is not snapshotted and is reported once, after the LAX payment settles. All 8 state cases pass as `worker_app`. | The hold has no end: see F12. | Only `issued` ids counted: caught. `unresolved` forced false: caught (12 failures). No reference match: caught. Held-back id snapshotted: caught. Hold removed: caught. Every applied reference matched: caught. |
| F3 budget | Yes. Each night builds a fresh `CallBudgetShare`. Notices get a separate daily share of 50. A notice for a document read in the last 10 minutes is not read again. `ZohoDocumentStatusReader` requires a `CallBudget`, and `createZohoBooksAdapter` requires `budget`. A read counts once, through the share. | none | Process-long night share: caught. Share per notice: caught. Notices on the night's allowance: caught. Recent-read skip removed: caught. Reader ignores budget: caught. Client ignores per-call budget: caught. |
| F4 replay | Yes. `event_time` must be a string inside the signed body and is normalised to ISO. A notice is refused when it is missing, unparseable, older than 24 h or more than 5 min ahead. The dedupe key is built only from organisation, module, entity id and time. Nothing prunes `webhook_event`, so a replay within the 24 h window is deduped. | none | Freshness check removed: caught. Age bound removed: caught. Ahead bound removed: caught. String check removed: caught. Event time dropped from the dedupe key: caught by the API tests (the queues tests alone do not catch it). |
| F5 rate limit and Sentry | Yes. There is a route-level rate limit with the same defaults as Xero and Postmark. `missing` goes to warn only. `invalid` goes to Sentry as a warning with a fixed fingerprint. The API logger does not forward to Sentry. | none | Rate limit removed: caught. `missing` sent to Sentry: caught. Fingerprint removed: caught. |
| F6 body limit | Yes. `bodyLimit` of 16 KiB, with a bare 413 and `no-store`. | none | Raised to 10 MiB: caught. |
| F7 split payment | Yes. The key now includes the invoice reference. | none | Reference dropped from the key: caught. |
| F8 concurrency | Yes. A `pg_advisory_xact_lock` is taken per document inside the transaction, and the snapshot is re-read and decided from under the lock. The recheck mark is cleared only if it was set before the read began. | none | Lock removed: caught. Decided from the earlier read: caught. Recheck always cleared: caught. |
| F9 untested guards | Yes. | none | `onConflictDoNothing` removed: caught. `!secret` removed: caught. |
| F10 missed-run alert | Yes. The window counts from the last finished run, else the first run ever started, else the worker's start. A run that failed still sets the first-started time. | none | First run ignored: caught. Latest run used instead of the first: caught. |

Three mutations first failed to compile because they left a variable unused (`noUnusedLocals`). They were rewritten to keep the variable in use, and all three were caught as listed.

### Persistence `atg-public-catalog.sql.integration` failure

This is not a blocker. It does not reproduce in CI's configuration on either branch:

- **CI's configuration:** a fresh database per job, owner `DATABASE_URL`, `DATABASE_URL_SHOP` as `shop_app`, and no worker or api URLs.
- **`origin/main` at `e5c65039`:** 159 files and 946 tests passed, 11 skipped.
- **This branch:** 158 files and 938 tests passed, 11 skipped.
- **On the shared database after the worker and api suites:** the branch also passed in full this time.

The earlier failure is order- and leftover-dependent. Follow-up: make that test independent of rows other suites leave behind.

### Test runs

- **`packages/accounting-domain`:** 298 passed.
- **`packages/accounting-zoho-books`:** 320 passed.
- **`packages/queues`:** 72 passed.
- **`apps/worker`:** 1842 passed, 477 skipped. The Books status-check integration suite ran 15 tests as `worker_app`.
- **`apps/api` Zoho Books tests:** 25 passed.
- **`packages/persistence`** (CI configuration, fresh database): 938 passed, 11 skipped.

### At merge (F1, not blocking)

Renumber after #1375 (0385, already on main) and #1376 (0386). The renumber touches:

- the SQL and rollback file names;
- the journal entry: a new `idx` (378 or later) and a `when` later than main's 1811419200000;
- the rollback's `DELETE … WHERE created_at = …`;
- `FINAL_FOLDER_MILLIS` in `migration-main-upgrade.integration.test.ts`;
- the migration test's file name and `TAG`;
- the "0385" comments in the schema, `migrate-roles.ts`, the persistence interface and the store.

`migrate-roles.ts` will also need a textual merge with main.

### Follow-ups (not blocking)

- **Notice share is per process:** each worker process keeps its own daily notice share. With N workers, notices can spend N×50 reads a day. `keepFree` (400) still protects sending.
- **`atg-public-catalog` isolation:** make the test independent of leftover rows (see above).
- **F11:** the Terraform Sentry rules, including the rate rule for `invalid`, and the `accounting-reconcile` monitor slug are still missing.
- **PR body:** apply the edits listed under "PR body changes still needed", and add the F12 fix once it is made.
