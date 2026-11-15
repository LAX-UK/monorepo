Verdict: FIX FIRST

Final money recheck of PR #1455 after the fixer, head `f3cf3849` (unchanged for 5+ minutes before this review began), against `origin/main` `70ceb4c4` (the branch is up to date with main). First review: head `eeaee18c`, one blocking finding.

The money fix is correct: concurrent courier refunds are now reserved under the group lock and cannot together exceed the courier charge, and this was confirmed against a real Postgres 16 with a mutation check. One new problem blocks merging: the new migration 0393 breaks six existing database migration tests, and the CI `test` job is red (finding 1). Fixing it means updating tests only, not the money path.

## Findings

1. **BLOCKING: CI `test` fails. Existing migration integration tests were not updated for migration 0393.** CI check-runs on `f3cf3849`: `test` and `ci-result` failed, 37 passed, 1 skipped. On `eeaee18c` the same job passed, so this change caused it. Six tests in `packages/db` fail:
   - `packages/db/src/migration-main-upgrade.integration.test.ts:26`: `FINAL_FOLDER_MILLIS` is still `1812110400000` (0392). It needs to be `1812196800000`. Three tests fail on it (`:64` and `:1235`).
   - `packages/db/src/migration-0257-workspace-buying.integration.test.ts:97-98` and `packages/db/src/migration-0261-payment-groups.integration.test.ts:80-81`: these roll back later migrations first (`0325_rollback.sql`) and then drop `delivery_quote` or `payment_group`. The new table has foreign keys to both tables, so the drop fails with "cannot drop table ... because other objects depend on it". `0393_rollback.sql` has to run first in both tests.
   - `packages/db/src/migration-0391-consignment-agreement-versions.integration.test.ts` (rollback test, about `:230-262`): after rolling back 0391, re-applying fails with "Migration history is missing 1812024000000 before applied timestamp 1812196800000", because 0393 is still in the ledger. Roll back 0393 first, or apply only up to 0391.
   - Before re-requesting review, run the `packages/db` integration suite with `MIGRATION_TEST_DATABASE_URL` set. The PR's verification list does not include it.

2. Non-blocking: the integration test's stand-in for Stripe's refund list (`apps/api/src/services/payment-group/payment-group.integration.test.ts:1309`) leaves out `deliveryRefundId`. So the integration test never matches a request through refund metadata. That match is the path that recovers a request whose Stripe refund went through but whose outcome was never written (a crash or DB error after Stripe answered). Unit tests cover that path, but the database path does not. Add the field to the stand-in and add one integration case: a `pending` row with no Stripe id whose refund is listed by metadata must stay held and then be marked `succeeded`, not released.

3. Non-blocking: `recordOutcome` after the Stripe call (`payment-group-delivery-refund.service.ts:354`) runs outside the group lock and overwrites without checking. It can therefore overwrite a newer status that a concurrent request has just reconciled from Stripe's list. I checked the cases. The only states it can write are terminal `failed` statuses (from a terminal Stripe answer, or a 400 refusal where no refund exists) or a status that holds the amount (`pending`/`succeeded`). A late write can therefore only keep an amount held for longer. It cannot free money that has actually gone back, and the next request fixes the held amount from Stripe's list. This is safe, but a short comment saying so would help the next reader.

4. Non-blocking, carried over from the first review (items 4 and 5): the F2 task lifecycle on a full refund of the charge is still untested, and the task shows the running refunded total. Both are now documented in the PR body for finance and the runbook. No code change was expected.

## Checks on the first review

- **Blocking 1 (concurrent refunds over the courier charge): fixed.** In one transaction under the group lock (`payment-group-delivery-refund.service.ts:132`, reserve at `:219-345`), the service works out what is left: max(webhook total, Stripe succeeded and pending refunds plus every request not known to have failed) (`:286`). It then writes a `pending` row and the audit event, and calls Stripe only after the commit (`:138`). A concurrent request waits for the lock and counts the first request's row even when its own Stripe list was read earlier (`:281`). If Stripe lists a request's refund, that request is counted through Stripe's figure, not twice.
  - Real Postgres 16 (`initdb` under `/var/tmp`, port 55432, `db:migrate` and `db:roles` applied): the new test "two staff refunds of different amounts at the same time never refund more than the courier charge" passes, and the DB-backed suite ran rather than being skipped.
  - Mutation: with held requests not counted (`:281`), the test fails with "expected 23000 to be less than or equal to 18000". This was reverted afterwards.
- **Reservations released on failure, and cannot leak.** A `failed`/`canceled` Stripe answer, a 400 refusal (`StripeInvalidRequestError`; idempotency errors are a different type and stay held) and `charge_already_refunded` mark the row `failed`. A Stripe error with no answer keeps the amount held.
  - If the process crashes between the reserve and the Stripe call, the row is left `pending` with no Stripe id. The next request for that quote releases it once it is older than 15 minutes (`:71`, `:278`), and only when Stripe lists no refund that names it in metadata.
  - If the crash happens after Stripe answered, the refund names the row in `metadata.deliveryRefundId`. The next request reconciles it to `succeeded` or `pending` and never releases it.
  - The longest a single Stripe call can be in flight (3 attempts, client default timeout, `maxNetworkRetries: 0`) is a few minutes, well inside the 15-minute window.
  - Recovery needs no manual step beyond the next request. A stale row only holds money back and never lets extra money out. Nothing frees rows proactively; see finding 2 for the test gap.
- **Idempotency key stable per reservation:** yes. `refund:<charge>:delivery-refund:<request id>` (`stripe-payment-gateway.ts:145`). The amount is no longer in the key. Internal retries reuse the key, and a new request gets a new key. An identical request from the same person within 2 minutes is refused as a repeat.
- **Fix 2 (audit before Stripe):** yes. `payment_group.delivery_refund_requested` is published in the reservation transaction with the request id and staff reason (`:332`). Stripe's answer is kept on the row. The PII allowlist is narrowed to `staffReason`, and the admin label is updated.
- **Fix 3 (retry after a failed or canceled refund):** yes. The row is marked `failed` and the amount is freed. A retry is a new row with a new key, so the failed refund is not replayed. The integration test "a refund Stripe fails frees its amount..." passes.
- **Seller ledger and invoice cap untouched:** yes. `payment-group-charge-events.ts`, the webhook attribution and the invoice paths are not changed between `eeaee18c` and `f3cf3849`. The refund still carries `metadata.deliveryQuoteId` and never `paymentId`.
- **`DELIVERY_IN_PAYMENT_ENABLED` default OFF:** yes, `apps/api/src/env.ts:174` `default(false)`, unchanged.
- **Migration 0393:** additive (one table, two indexes), with `SET LOCAL lock_timeout`. The journal is in order (idx 385 after 0392's 384, `when` increasing), and nothing on main conflicts with it. `0393_rollback.sql` is a matching pair: it refuses to run while rows exist, then drops the table and its ledger row. On the real DB, rollback, then migrate, then roles works cleanly. Grants on the real DB: `api_app=arw` (INSERT, SELECT, UPDATE, no DELETE), and `worker_app` has none (in `WORKER_DENY_TABLES`). The existing older migration tests are not updated; see finding 1.

## Verification run

- Setup at `f3cf3849`: `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`. Throwaway Postgres 16 on port 55432, with `db:migrate` and `db:roles` applied.
- Vitest (`--maxWorkers=2`) with `DATABASE_URL` set:
  - api: payment-group, stripe, payment, admin routes and webhook duplicate delivery, 120 files and 1909 tests, all passing. Includes the delivery-refund service unit tests (15) and the two new DB-backed integration tests.
  - packages: db 881 tests, persistence 993, types 332 and domain 3799, all passing. This includes the 0393 contract and roles tests.
  - web: admin, lib/admin and actions, 3055 tests, all passing.
  - The db migration integration tests that need `MIGRATION_TEST_DATABASE_URL` did not run cleanly locally, because the local DB is missing the auth tables the harness expects. The CI results in finding 1 are the authoritative ones.
- `tsc --noEmit`: passes for api, persistence, db and types. `biome check` on the changed files is clean.
- CI (REST check-runs, `f3cf3849`): 37 succeeded, 1 skipped, and 2 failed (`test`, `ci-result`). See finding 1.
- The PR branch was not modified. The mutation probe was local and was reverted.
