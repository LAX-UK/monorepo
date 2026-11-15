Verdict: FIX FIRST

# Review of PR #1461: Zoho Sold marks the artwork sold in the gallery (ZO6, migration 0393)

Reviewed head `cf14ae4b` (branch `zoho-sold-in-gallery-zo6`) against `origin/main` `70ceb4c4`. The PR branch was not changed.

## Findings

1. **BLOCKING: CI `test` job is red, because `packages/db` migration tests were not moved to the new head.**
   - `packages/db/src/migration-main-upgrade.integration.test.ts:26`: `FINAL_FOLDER_MILLIS` is still `1812110400000` (0392). CI fails 3 tests with `expected 1812196800000 to be 1812110400000`.
   - `packages/db/src/migration-0391-consignment-agreement-versions.integration.test.ts:224-226` rolls back only 0392 before testing 0391's rollback. With 0393 applied, it fails with `Migration history is missing 1812024000000 before applied timestamp 1812196800000`. Add `0393_rollback.sql` (newest first) to that chain.
   - Fix: update both files the way the other 0393 PRs do (for example #1460 updates `migration-main-upgrade`).

2. **BLOCKING: migration number and timestamp collide with three other open PRs.**
   - #1455, #1458 and #1460 each add a `0393_*.sql`, a `0393_rollback.sql` and a journal entry `when: 1812196800000` (`packages/db/drizzle/meta/_journal.json:2694-2697`).
   - Whichever PR merges second conflicts on `0393_rollback.sql`. Its rollback also deletes the ledger row by the same `created_at`, so it would remove the other migration's ledger row.
   - Fix: agree the merge order and renumber before merge. If this PR goes later, use 0394 with a later `when`, a matching `DELETE ... WHERE created_at = <new>`, and the test updates in finding 1.

3. **BLOCKING: an artwork whose "Zoho says Sold" item was overridden is recorded as sold with no payment hold.**
   - Where: `packages/artwork-register-contracts/src/sold-while-live.ts:212,221`, `apps/worker/src/integrations/zoho/artwork/gallery-sale.ts:91-93` and `packages/persistence/src/repositories/artwork-register/drizzle-sold-attention.store.ts:246-257`.
   - If staff earlier pressed "It is not sold" (item `overridden`) and Zoho still says Sold:
     - `decideSoldWhileLive` returns `none`, so the pre-raise in `GallerySaleRecorder.record` raises nothing.
     - `planGallerySale` still returns `record` (checked against the built contracts: before = `none`, plan = `record from lax_art`, after = `none`), so the register moves to `sold` / `gallery_sale`.
     - The item stays `overridden`, and `isPaused` only looks for `open` items.
   - Result: `assertCheckoutNotPaused`, `assertOrderNotPaused` (resume of a pending order) and `orderHoldsPausedArtwork` (`apps/shop-api/src/infrastructure/drizzle-payment-event.processor.ts:293-309,772`) all pass. An open lax.art checkout can still be paid and applied for a work the register shows as sold in the gallery.
   - The original-sale invoice path is safe here, because `recordSold` hits `sold_is_terminal` and the payment goes to unapplied money. But the checkout/order path relies only on the item.
   - Fix (either works):
     - (a) When a gallery sale is recorded from `lax_art`, replace an overridden item with a fresh `open` one in the same transaction. Zoho wins over the earlier override, and staff then use Dealt with.
     - (b) Make the money pause also true when the register entry is `sold` with ref `gallery_sale`. This also covers finding 4.
   - Add an integration test for override, then Sold, then record, then `isPaused === true`.

4. **Should fix: "Dealt with" ends every hold even though Zoho still says Sold.**
   - Where: `packages/persistence/src/repositories/artwork-register/drizzle-sold-attention.store.ts:168-206` and `apps/shop-api/src/routes/admin/v1/admin-sold-attention.routes.ts:112`.
   - Once the item is `staff_resolved`, any checkout session or pending order staff missed can be paid and applied normally (same item-only check as finding 3).
   - The brief requires that no money path completes for a work Zoho says Sold. Option (b) in finding 3, a register-state check alongside the item, would make that hold permanently and not depend on staff diligence.
   - "Dealt with" ends a payment hold and needs only `artwork_register.review`, which Catalogue editor has, with no step-up. Comparable money-releasing actions (`refund.write`, `original_sale.write`) use `requireRecentAuthentication`.

5. **Should fix: Reopen has no step-up.**
   - Where: `apps/shop-api/src/routes/admin/v1/admin-sold-attention.routes.ts:156`.
   - The other sensitive Administrator-only action with a route here, `lead.erase` (`admin-guests.routes.ts:119-120`), and the sale/refund actions call `requireRecentAuthentication`, and their paths are on `SHOP_ADMIN_STEP_UP_PATHS`.
   - Fix: add step-up to `POST /artwork-register/:registerId/reopen-sale` and to the shared step-up path list. The client already renders `action.stepUpDialog`.
   - The capability itself is correct: Administrator only (`staff-action-rules.ts`, `staff-capabilities.ts`), with a role test for every other role, and refusals for "Zoho still says Sold" and for LAX sales.

6. **Test gap (mutation survived): the hold raised before recording is not tested on its own.**
   - Where: `apps/worker/src/integrations/zoho/artwork/gallery-sale.ts:91-93`.
   - Replacing the condition with `if (false)` left all 333 worker tests green. The notice and nightly per-Product paths already raise the item in `checkSoldWhileLive`, so no test exercises `GallerySaleRecorder.apply`/`sweep` alone recording a `lax_art` artwork.
   - Fix: add a recorder-level test asserting the item is open before `recordGallerySale` commits.
   - The other mutations were caught:
     - Removing `if (input.soldInGallery) return { action: "none" }` (`sold-while-live.ts:212`) fails 1 contract test and 2 worker tests.
     - Removing the `zoho_still_sold` or `not_a_gallery_sale` guard in `reopenGallerySale` fails 1 contract test and 1 persistence integration test each.

7. **Test gap: no concurrency test for the race between a lax.art purchase and the Sold notice.**
   - By reading the code the race is safe:
     - `recordGallerySale` re-plans under `SELECT ... FOR UPDATE` with a version check.
     - The original-sale writer's `recordSold` runs in the Shop transaction against the same register row, so whichever commits first wins.
     - The losing original-sale payment is recorded as unapplied money.
   - Please add a two-connection test, as other register tests do, so this is pinned.

8. **Minor: the history line says "Taken off lax.art" before it has happened.**
   - Where: `apps/shop-admin/src/server/domain/zoho-register.vm.ts:504`.
   - The `gallery_sale_recorded` event is written at record time, but unpublishing happens later, on the next shop-api scheduler tick.
   - Suggest "Zoho's Status became Sold. lax.art listing to be taken off sale." or read the audit row.

9. **Minor: the Reopen wait copy is duplicated.**
   - Where: `apps/shop-admin/src/components/from-zoho/reopen-gallery-sale.client.tsx:19`.
   - `REOPEN_WAIT_FOR_ZOHO` repeats `REOPEN_REFUSAL_MESSAGE.zoho_still_sold` from `@auction/artwork-register-contracts`. Import the contract string so the two cannot drift.
   - The other staff copy uses staff-ui components (`Notice`, `StaffButton`, `ConfirmActionDialog`, `Permitted`) with no hard-coded colours or widths. From the code, light/dark and 375px are inherited from the kit.

10. **Minor: the unpublish audit records no previous `published_at`.**
    - Where: `apps/shop-api/src/infrastructure/scheduler/gallery-sale-listings.runner.ts:57`.
    - Unpublishing is reversible (only `published_at` is cleared; `archived_at` is untouched, and the integration test checks this). After a Reopen, staff republish through the normal flow, and `assertCanPublish` allows it once the register is `held`.
    - Recording the old `published_at` in `beforeJson` would let staff restore the original date.

## Verified as correct

- **Idempotency.**
  - Inbound sync and nightly passes re-plan under the row lock, so a repeat gives `unchanged`, with no second event, outbox row or item (`findLive`).
  - `listGallerySaleCandidates` excludes `sold`.
  - The unpublish runner selects only `published_at IS NOT NULL` with `SKIP LOCKED`, so there is one audit row per listing.
- **Bid lot / private sale.** The plan is `wait_for_staff`, so nothing is recorded, and the existing item pauses re-offer.
  - Pre-existing and outside this PR: the hold covers re-offer send/accept only (`apps/api/src/services/reoffer/*`), not a Bid invoice payment for a lot still in `bid_sale`.
- **Zoho writes.** The PR adds no Zoho writes. The outbound Status write-back skips (`gallery_sale_owned_by_zoho`) instead of writing Sold over a Status staff changed. No new env vars. Tests use fakes, so nothing reaches live Zoho. The mode needs both sync and listing `live`, otherwise dry run.
- **Migration 0393.**
  - Forward and rollback applied cleanly on a throwaway Postgres 16.
  - `db:verify-migration-pair 0393_zoho_gallery_sale` passed.
  - A real rollback, then re-migrate, removed and re-added the ledger row.
  - The rollback relabels `staff_resolved` before restoring the CHECK.
  - Note for the verify script (repo-wide): rollbacks contain their own `BEGIN/COMMIT`, which commits the script's outer transaction.
- **Grants (`db:roles`).**
  - `shop_app`: column UPDATE on `artwork_register_sold_attention` (status, resolution, resolved_*, override_reason), table UPDATE on `artwork_register`, INSERT on `artwork_register_event`, `domain_events` and `shop_admin_audit`.
  - `worker_app`: INSERT/UPDATE as needed.
  - Integration tests ran as `shop_app` for Dealt with and Reopen, and passed.
- **Route JS.** Budget files are unchanged, and shop-admin is not in `scripts/route-js-budgets.json`.

## Commands run

- Setup: `corepack enable; pnpm install --frozen-lockfile; pnpm -r --filter './packages/**' build`, all OK. Postgres 16 under `/var/tmp`, port 55432, then `db:migrate` and `db:roles`.
- `packages/artwork-register-contracts` vitest: 289 passed.
- `packages/persistence` `src/repositories/artwork-register` (`--no-file-parallelism`, since files share one database): 94 passed, 1 skipped.
- `apps/worker` `src/integrations/zoho/artwork` (`--maxWorkers=2`): 333 passed.
- `apps/shop-api` artwork-register service, sold-attention routes, scheduler and gallery-sale-listings integration (as `shop_app`): all passed.
- `apps/shop-admin` `components/from-zoho` (`--maxWorkers=2`): 122 passed.
- `packages/shop-domain` staff-capabilities: passed.
- `tsc --noEmit` in shop-api, worker, shop-admin, persistence, artwork-register-contracts, shop-contracts, shop-domain and db: clean.
- `biome check` on changed files, `lint:client-copy`, `lint:admin-capability-drift`, `lint:layers`: clean.
- PR checks for #1461 when read: `test` **failed** (finding 1). `build`, `browser-gates` and `shop-v1-phase-smoke (admin-routes)` were still running. All other completed checks were green.
