Verdict: SHIP

# Recheck of #1458: storage terms 2/7, data layer

Rechecked head `3a9871ea` ("Address review of the storage terms data layer") against the first review (head `a4e0d486`), the PR body section "Changes after review", and the spec `docs/design/storage-terms.md` (branch `storage-terms-spec`). The four blocking items are fixed. Nothing new is blocking. The migration number `0393` is shared with other open PRs and will be renumbered at ship time; not blocking.

## Blocking items from the first review

1. **Fixed. CI and the migration tests.** CI is green on `3a9871ea`: `test`, `build`, all vitest shards, role contracts and browser gates pass (`art-browser-gates` skipped).
   - `packages/db/src/migration-main-upgrade.integration.test.ts:28-34` now reads the newest `when` from `drizzle/meta/_journal.json`, so it is no longer pinned to 0392 and will not need editing at renumbering.
   - `packages/db/src/migration-0391-consignment-agreement-versions.integration.test.ts:225-232` rolls back 0393 then 0392.
   - Locally, the full `packages/db` suite passes against a migrated Postgres 16 with `MIGRATION_TEST_DATABASE_URL` set: 216 files, 1233 tests, 4 skipped (auth contract cases that need their own URL).

2. **Fixed. `storage_charge_pence` is kept (expand/contract).** `packages/db/drizzle/0393_collection_storage_terms.sql` has no `DROP COLUMN`; the rollback no longer touches the column. The Drizzle schema field is gone, and outside old migrations and tests nothing reads or writes the column. The only remaining reference is the ignored `storageChargePence` in `packages/validators/src/collection-settings.ts:51` (tracked as a follow-up). After migrate, the column is present with its data, so the release still running keeps working. The new `packages/db/src/migration-0393-collection-storage-terms.integration.test.ts:76-84,100-107` pins that the column and its values survive both migrate and rollback.

3. **Fixed. The 30-day extension cap is per lot in total and safe under concurrent grants.** `packages/persistence/src/repositories/drizzle-collection-storage.repository.ts:339-347` sums the lot's extensions after `lotVenue` takes `FOR UPDATE` on the lot row (`:515`), and returns `cap_reached` with `daysRemaining`. Tests: total cap at `drizzle-collection-storage.integration.test.ts:289`, four concurrent 20-day grants at `:303` (exactly one saved, total 20). Mutation check: with `FOR UPDATE` removed, the concurrency test failed in 2 of 3 runs against real Postgres (see item 5).

4. **Fixed. ST9 "start date from tomorrow onward" is enforced.** `scheduleTerms` takes the London `today` and refuses `effectiveFrom <= today` (`drizzle-collection-storage.repository.ts:150`); `editScheduledTerms` does the same (`:186`), with a new `start_not_in_future` outcome (`packages/persistence/src/interfaces/collection-storage.repository.ts:90,99`). The test at `drizzle-collection-storage.integration.test.ts:350` covers today and a past date on both paths and checks nothing was written. Mutation check: removing either line fails the suite.

## New findings

5. **Non-blocking. The concurrency test is probabilistic.** `drizzle-collection-storage.integration.test.ts:303` relies on four `Promise.all` grants actually interleaving. With the lock removed it caught the race in 2 of 3 runs. That is enough to fail CI soon after a regression, but not every time. Optional: force the interleave (for example, hold the lot lock in a second transaction while the grants start, or run more grants) so it fails deterministically.

6. **Non-blocking. `cap_reached` also covers a single grant over 30.** `drizzle-collection-storage.repository.ts:347` checks the cap before the 1-to-30 database check, so `addExtension(lot, 31, ...)` on a fresh lot returns `cap_reached` with `daysRemaining: 30` instead of an error. That is a reasonable answer for the UI, but PR 3 should word it as "up to 30 days" rather than "cap reached". Days of 0 or less still reach the database check and throw, as tested.

7. **Non-blocking. The spec still says this PR drops the weekly charge.** `docs/design/storage-terms.md:71` (branch `storage-terms-spec`): "drop the unused weekly charge". The PR now defers it to a later expand/contract migration. Update the plan line, or note it in #1457, so the follow-up is tracked.

8. **Non-blocking (checked, no action). Fulfilment insert now reads `collection_storage_terms`.** `packages/persistence/src/repositories/drizzle-lot-fulfilment.repository.ts:86-96` sets `storage_terms_id` from a subquery at insert. Both callers are covered by grants: `api_app` has full access, and `worker_app` (`LotFulfilmentPaymentSync`, wired in `apps/worker/src/finance/create-worker-lot-invoice-initiation.ts:114`) has SELECT on `lot`, `sale` and `collection_storage_terms` and INSERT on `lot_fulfilment.storage_terms_id` (checked after `db:roles`; the subquery plans as `worker_app`). The rule matches `recordTermsForSale` (sale venue, not cancelled, start on or before the London close day). The test at `drizzle-collection-storage.integration.test.ts:416` fails if the subquery is removed. This closes first-review item 5.

## Carried over (non-blocking, deferred in the PR body)

9. First-review item 9: use `StorageDayCount` from `@auction/domain` once #1457 merges.
10. First-review item 12: worker table-level writes on `lot.storage_large` and `lot_fulfilment.storage_terms_id`; pin in the sweep PR.
11. First-review item 8: a runbook query listing places whose free period was capped at 90. The new `terms_migrated` audit row keeps the original value (`before.freeStorageDays`), so this is now easy to report.
12. Follow-up migration: drop `storage_charge_pence` and remove `storageChargePence` from `packages/validators/src/collection-settings.ts:51` once this release is live.

## Also closed from the first review

- Item 6: tests now cover cancelled versions in `findTermsInForce` and edit/cancel of a cancelled version, the `extension_granted` audit row, and an `api_app` contract pinning `collection_storage_audit` to INSERT and SELECT (`packages/db/src/api-app-role.contract.test.ts:923`).
- Item 7: optional reason on the large flag; no-op switch, VAT and large writes record nothing (test at `drizzle-collection-storage.integration.test.ts:405`); the data move writes a `terms_migrated` audit row per place.
- Item 10: a real database test for 0393 (data move, 90-day cap, null left alone, charging check, rollback, re-apply). The "five tables" text is corrected.

## Verification

- `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`: OK.
- Throwaway Postgres 16 (initdb under `/var/tmp`, port 55432): `db:migrate` and `db:roles`, then rollback and migrate again, twice. The ledger goes 385 → 384 → 385 each time, the four tables go and come back, and `storage_charge_pence` stays throughout. `db:verify-migration-pair 0393_collection_storage_terms` passes.
- Grants after `db:roles`: `api_app` has INSERT and SELECT only on `collection_storage_audit` and full DML on terms, extensions and waivers. `worker_app` has SELECT on terms, extensions and waivers and nothing on the audit. `shop_app` and `auth_app` have nothing on the four tables.
- `packages/db` suite with `MIGRATION_TEST_DATABASE_URL`, `DATABASE_URL_API` and `DATABASE_URL_WORKER` set: 1233 passed, including the 0393 database test, the 0391 rollback, the main upgrade, and the `api_app` (26) and `worker_app` (44) role contracts.
- Persistence: collection storage integration (21) and lot fulfilment integration tests pass.
- Mutation checks: removing the lot lock, the schedule date rule, the edit date rule, or the fulfilment terms subquery each fails a test (the lock check in 2 of 3 runs).
- API collection-settings, mappers, organisation-buying and lot-fulfilment tests: 255 passed. Validators: 679 passed. Finance runtime: 255 passed.
- Typecheck: `db`, `persistence`, `validators`, `api` and `worker` are clean. `web` reports only the existing `@auction/api/app` build-order error.
- Biome: clean on the 42 changed TypeScript and JSON files.
- Commit messages on the PR (`a4e0d486`, `3a9871ea`): no co-author or generated-by trailers.
- CI on `3a9871ea`: every check passed except `art-browser-gates`, which was skipped.
