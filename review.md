Verdict: FIX FIRST

# Review of #1458: storage terms 2/7, data layer (versioned terms, extensions, waivers, audit)

Reviewed head `a4e0d486` against the approved spec `docs/design/storage-terms.md` (branch `storage-terms-spec`, commit `d325c00f`). Items 1 to 4 are blocking.

## Findings

1. **Blocking. CI is red because two tests still treat 0392 as the latest migration.** The `test` job fails 4 tests:
   - `packages/db/src/migration-main-upgrade.integration.test.ts:26`: `FINAL_FOLDER_MILLIS = 1812110400000` must become `1812196800000`. The 3 upgrade tests fail with "expected 1812196800000 to be 1812110400000".
   - `packages/db/src/migration-0391-consignment-agreement-versions.integration.test.ts:225-226`: `laterRollbacksSql` runs only `0392_rollback.sql`. It must run `0393_rollback.sql` first, otherwise the test fails with "Migration history is missing 1812024000000 before applied timestamp 1812196800000".

   #1438 updated the same two places when it added 0392. Reproduced locally on Postgres 16. The journal itself is in order: idx 385, one day after 0392.

2. **Blocking. Dropping `storage_charge_pence` breaks the release that is still running.** `packages/db/drizzle/0393_collection_storage_terms.sql:151-153` drops the column. Migrations run as a pre-deploy job while the old release keeps serving (`docs/architecture/06-deployment.md:200-204`). The old release reads `collection_place` with Drizzle `select()`, which names every column, including `storage_charge_pence` (for example `drizzle-collection-place.repository.ts:62` and `drizzle-collection-settings.repository.ts:144,211` on main). Every read of a collection place therefore fails from the moment the migration runs until the new containers are live. It keeps failing for good if the deploy is rolled back without the SQL rollback, which is what the Rollout note tells operators to do first.

   Reproduced: main's `DrizzleCollectionPlaceRepository.find` against the migrated database fails with `column "storage_charge_pence" does not exist`.

   Fix: remove the field from the TypeScript schema and code in this PR, but keep the column (optionally drop its check constraint). Drop the column in a later migration once this release is live. That is the expand-then-contract approach this PR already uses for `free_storage_days`.

3. **Blocking. The 30-day extension cap can be bypassed by granting again.** `packages/persistence/src/repositories/drizzle-collection-storage.repository.ts:323-348` and the check `collection_storage_extension_days_check` (`0393…sql:84`) limit each grant to 1 to 30 days, but not the total per lot. The test at `drizzle-collection-storage.integration.test.ts:257` confirms the intent: "as many as staff give". Under ST10, Fulfilment may extend one lot's free storage "up to 30 days", and only Finance waives charges. Repeated 30-day grants give Fulfilment an unlimited free period, which is a waiver in effect.

   Fix: inside the transaction, which already locks the lot with `FOR UPDATE` in `lotVenue` (`:490-502`), sum the existing days and refuse past 30 (for example a new outcome `cap_reached` with the days remaining). If the product owner meant 30 days per grant, record that decision in the spec instead.

4. **Blocking. "Start date from tomorrow onward" (ST9) is not enforced.** `scheduleTerms` (`drizzle-collection-storage.repository.ts:142-173`) takes no `today` and accepts any `effectiveFrom`, including today or a past date. `editScheduledTerms` (`:175-204`) checks that the current version has not started, but accepts a new `effectiveFrom` of today or earlier. Either path makes terms apply to sales that have already closed: `findTermsInForce` would return them for past days, and the History card would show a past start.

   The repository already owns the "not started" rule for edit and cancel, so it should own this rule too. Take `today` in `scheduleTerms`, refuse `effectiveFrom <= today` in both methods with a distinct outcome, and test both.

5. **Non-blocking, but must be settled before PR 3. `recordTermsForSale` misses lots paid after the sale closes.** `drizzle-collection-storage.repository.ts:395-413` updates only `lot_fulfilment` rows that already exist. Those rows are created at payment, with `paymentId` (`drizzle-lot-fulfilment.repository.ts:82`). Called at sale close, as its doc comment says, it records nothing for lots paid later, and those lots then count as "won before the first terms" (30 days, never charged). Either set `storage_terms_id` when the fulfilment row is inserted (terms in force on the sale's London close day), or call this method from the payment-cleared path as well. Add a test with a fulfilment row created after the call.

6. **Non-blocking. These rules have no test (mutations survived).** The suite stayed green after each of these deliberate breaks:
   - `findTermsInForce` (`:117-131`) with `cancelled_at IS NULL` removed. A cancelled future version would come into force on its date.
   - `changeScheduled` (`:442`) allowing edits to a cancelled version.
   - `addExtension` (`:337`) writing no audit row.
   - `migrate-roles.ts` with the `API_COLLECTION_STORAGE_AUDIT_TABLES` exception removed. `api_app` then gets UPDATE, DELETE and TRUNCATE on `collection_storage_audit`, and every role contract test still passes.

   Add a test for each, including an `api_app` contract test that pins the audit table to INSERT and SELECT only, like the `worker_app` test this PR adds.

7. **Non-blocking. Some audit rows lack "why", or are missing.** ST10 asks for who, when, before, after and why on every change. Three gaps:
   - `setLotLarge` (`:301-321`) takes no reason and stores `reason: null`.
   - The data move (`0393…sql:142-149`) creates the first version of each place's terms with no audit row and a null `created_by_user_id`. The History table will start empty even though terms are "In force".
   - `setRaiseInvoices` and `setVatTreatment` record a row even when the value does not change.

   Suggest an optional reason on the large flag (or decide it needs none and say so in the spec), a `terms_migrated` audit row in the data move, and skipping no-op writes.

8. **Non-blocking. The data move caps long free periods silently.** A place with `free_storage_days` over 90 (the existing check allows up to 365) gets terms of 90 days, while services keep reading the old value. Verified: a place with 200 days got terms of 90. When reads switch to the terms in PR 3 or later, that place's deadlines get shorter. Report affected places before release (a one-line query in the runbook), or have Finance confirm. Separately, the legacy rule needs one shared definition across both PRs: the spec says 30 days, while today's lots use the place value. See #1457 review item 6.

9. **Non-blocking (fit with #1457).** `StorageTermsRecord.countMode: StorageCountMode` (`packages/persistence/src/interfaces/collection-storage.repository.ts:2,12`) has the same values as the domain's `StorageTerms.dayCount: StorageDayCount`. `@auction/persistence` already depends on `@auction/domain`. After #1457 merges, import `StorageDayCount` and use one field name. The database column can stay `count_mode`. Every other field lines up with the domain type: `freeDays`, `standardDailyPence`, `largeDailyPence | null`, `handlingFeePence`, `effectiveFrom` (`YYYY-MM-DD` string), and the band from `lot.storage_large`.

10. **Non-blocking. The migration's own test only checks the SQL text.** `packages/db/src/migration-0393-collection-storage-terms.test.ts` only matches SQL strings. The up/down/up run described in the PR is not committed. Add a database test like the one for 0391: the data move, the 90-day cap, null left alone, the charging check, rollback, and re-apply. Also, line 23 says "five new tables" but there are four.

11. **Nit.** `packages/validators/src/collection-settings.ts:51` accepts any number for `storageChargePence` and ignores it. That is fine for one release. Track its removal with the column drop in item 2.

12. **Nit.** `worker_app` can already write `lot.storage_large` and `lot_fulfilment.storage_terms_id` through its existing table-level grants (UPDATE on `lot`; INSERT and UPDATE on `lot_fulfilment`). The worker does not need to write either column. Consider pinning these in the worker contract when the sweep is built.

## Checked and correct

- **Up/down/up.** On a throwaway Postgres 16 (initdb under `/var/tmp`, port 55432), `db:migrate` and `db:roles` ran three times with the rollback in between. The ledger row is removed and re-added. `storage_charge_pence` comes back empty and accepts writes after rollback. `free_storage_days` is untouched. The data move copies 21 as 21, caps 200 to 90 and leaves null alone. Re-running the body is idempotent. `db:verify-migration-pair 0393_collection_storage_terms` passes.
- **Constraints.**
  - `collection_place_charging_needs_vat_check` refuses charging on with no VAT treatment, including when the treatment is cleared while charging is on.
  - The VAT treatment check refuses unknown values.
  - The limits on free days (0 to 90), rates, handling fee (up to £500.00), extension days and non-blank reasons are all checked.
  - Dropping the charging check makes the "stopped by the database too" test fail.
- **Grants after `db:roles`.**
  - `api_app` has INSERT and SELECT only on `collection_storage_audit`, and full DML on terms, extensions and waivers.
  - `worker_app` has SELECT on terms, extensions and waivers and nothing on the audit.
  - `shop_app` and `auth_app` have nothing on any of the four tables.
- **Dropped column.** Nothing in the PR tree still reads `storage_charge_pence` (searched TypeScript, TSX, SQL and JSON outside old migrations). The problem is the old release (item 2).
- **Repository.**
  - The repository refuses charging on without a VAT treatment.
  - Edit and cancel are blocked once a version has started.
  - A lot can be waived only once.
  - `recordTermsForSale` does not overwrite a recorded terms id.
  - Writes run under the place or lot lock, with the audit row in the same transaction.
- **Legacy lots.** `storage_terms_id` is null for lots won before the first terms, and nothing is charged. That matches ST9, subject to item 5.

## Verification

- `pnpm install --frozen-lockfile`, then `pnpm -r --filter './packages/**' build`: OK.
- Repository and settings integration tests on Postgres 16: 29 pass.
- `worker_app` and `api_app` role contracts, `migrate-roles`, and the 0393, 0334 and 0347 migration tests pass.
- API: typecheck passes; the collection-settings, mappers and organisation-buying tests pass (238). Worker typecheck passes.
- Web: the collections and admin-collections tests pass (29). The web typecheck reports only the existing `@auction/api/app` build-order error. The validators tests pass. Biome is clean on the 37 changed files.
- Mutation check: 12 repository breaks, 9 caught and 3 survived (item 6). The database charging check was dropped and the test caught it. The audit-grant exception was removed and nothing caught it (item 6).
- Merged with #1457 locally: no conflicts. Packages build, and `persistence`, `api` and `worker` typecheck pass.
- CI: `test` fails (item 1). Everything else has passed or was skipped. Some browser gates were still running at review time.

## Merge order

Merge **#1457 first**. It has no database change and carries the spec this PR links to. Merge this PR after items 1 to 4 are fixed. PR 3 can then join the two (item 9).
