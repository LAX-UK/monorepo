Verdict: FIX FIRST

Final recheck of PR #1455 after the second fixer. Head `5449b3ed` (branch `delivery-refund-safety-co4c`), base `origin/main` `70ceb4c4`. Previous review: head `f3cf3849`, one blocking finding.

Every finding from the previous review is fixed, and the money path is unchanged and still correct. One new problem blocks merging: the new integration test does not typecheck, so CI `static-checks` and `ci-result` are red (finding 1). The fix is one line in a test file.

## Findings

1. **BLOCKING: CI `static-checks` fails on an api typecheck error in the new test, so `ci-result` is red.**
   - Where: `apps/api/src/services/payment-group/payment-group.integration.test.ts:1632` (the `ask` helper, `:1631-1640`).
   - `amountPence` is passed as `number | undefined` into `RefundDeliveryInput`. The api builds with `exactOptionalPropertyTypes`, so `tsc` reports TS2379. Reproduced locally with `tsc -p apps/api/tsconfig.json --noEmit`, which shows this single error.
   - Vitest does not typecheck, so the test itself passes and the CI `test` job is green. `static-checks` is the job that fails.
   - Fix: make the helper's parameter required (every call passes a number), or spread it in only when it is set: `...(amountPence === undefined ? {} : { amountPence })`. Then re-run `tsc --noEmit` for apps/api before pushing, and add the api typecheck to the PR's verification list.

2. Non-blocking, for ship time: the `packages/db` migration test edits name 0393 directly.
   - Where:
     - `packages/db/src/migration-main-upgrade.integration.test.ts:26` (`FINAL_FOLDER_MILLIS = 1812196800000`)
     - `packages/db/src/migration-0257-workspace-buying.integration.test.ts:98`
     - `packages/db/src/migration-0261-payment-groups.integration.test.ts:81`
     - `packages/db/src/migration-0391-consignment-agreement-versions.integration.test.ts:229`
   - main already has its own 0393 (#1458), so all four need updating again when this migration is renumbered. #1461 reads the head and the later rollbacks from the journal instead, which survives a renumber. The same approach here would avoid a second round of CI failures at ship time.
   - The renumber itself is expected at ship time and is not a finding: the file names, the journal `when`, and the ledger `DELETE ... WHERE created_at = ...` in `0393_rollback.sql`.

3. Non-blocking, carried over: `recordOutcome` after the Stripe call (`apps/api/src/services/payment-group/payment-group-delivery-refund.service.ts:354`) still has no comment explaining why an unconditional write outside the group lock is safe. The earlier reasoning still holds: it can only keep an amount held for longer, never free money that has gone back.

4. Non-blocking, carried over: the F2 task lifecycle on a full refund of the charge is still untested. It is documented in the PR body for finance and the runbook.

## Checks on the previous review

- **Blocking 1 (CI `test` red from the `packages/db` migration tests): fixed.**
  - The main-upgrade head is now the 0393 folder timestamp.
  - The 0257 and 0261 tests run `0393_rollback.sql` first, with its own `BEGIN/COMMIT` stripped so it stays inside the test's transaction.
  - The 0391 rollback test rolls back 0393, then 0392.
  - CI `test` on `5449b3ed`: success.
  - Locally on a throwaway Postgres 16 (port 55432, `db:migrate` and `db:roles` applied, `MIGRATION_TEST_DATABASE_URL` set), the full `packages/db` suite passes: 213 files and 1163 tests passed, 2 files and 68 tests skipped. The skips need other environment URLs and are unrelated.
- **Finding 2 (Stripe refund-list stand-in without `deliveryRefundId`): fixed.**
  - The stand-in now carries `deliveryRefundId`.
  - The new case at `payment-group.integration.test.ts:1604` ("a request whose Stripe refund went through but whose outcome was never written is reconciled through metadata, not released") passes. It starts from an hour-old `pending` row with no Stripe id, and checks that:
    - the £50 is counted once: £130.01 is refused before Stripe is called, and £130.00 goes through;
    - the row ends `succeeded` with the listed refund id.
  - Mutation: with the metadata match removed (`payment-group-delivery-refund.service.ts:251`), this test fails with the row `failed` instead of `succeeded`. Reverted afterwards.
- **Concurrency cap still holds.**
  - Re-ran "two staff refunds of different amounts at the same time never refund more than the courier charge" against real Postgres: it passes.
  - Mutation: with held requests not counted (`:281`), it fails with "expected 23000 to be less than or equal to 18000". Reverted afterwards.
- **Money path unchanged since the last review:** `git diff f3cf3849 5449b3ed` touches only test files (the payment-group integration test and four `packages/db` migration tests).
- **Attribution:** none of the six commit messages and none of the PR text contain Co-Authored-By, Claude-Session or generated-by lines.

## Verification run

- Setup at `5449b3ed`: `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`. Throwaway Postgres 16 under `/var/tmp` on port 55432, with `db:migrate` and `db:roles` applied.
- `packages/db`, full suite with `MIGRATION_TEST_DATABASE_URL`: passes (see above).
- `apps/api` `src/services/payment-group` (`--maxWorkers=2`, DB-backed): 8 files and 140 tests, all passing. This includes all 39 payment-group integration tests.
- `tsc --noEmit` for apps/api: **fails** with the one error in finding 1.
- `biome check` on the files changed since `f3cf3849`: clean.
- CI (check-runs on `5449b3ed`):
  - `test` passed.
  - `static-checks` and `ci-result` failed (finding 1).
  - The other 36 checks succeeded, and `art-browser-gates` was skipped.
- The PR branch was not modified. The mutation probes were local and were reverted.
