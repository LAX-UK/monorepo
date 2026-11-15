Verdict: SHIP

Final recheck of PR #1461 after the fixer. Head `196b79c1` (branch `zoho-sold-in-gallery-zo6`), base `origin/main` `70ceb4c4`. Previous review: head `cf14ae4b`, three blocking findings.

All blocking findings are fixed and verified against a real Postgres 16, with mutation checks. CI is fully green. The only open item is the migration renumber, which happens at ship time as agreed (finding 1).

## Findings

1. Non-blocking, at ship time: migration 0393 collides with main, where #1458 merged its own `0393_*`.
   - Renumber these together: the files, the journal entry (`packages/db/drizzle/meta/_journal.json`, `when: 1812196800000`) and the ledger `DELETE ... WHERE created_at = ...` in the rollback.
   - The `packages/db` migration tests read the head and the later rollbacks from the journal (`packages/db/src/migration-main-upgrade.integration.test.ts`, `migration-0391-consignment-agreement-versions.integration.test.ts`), so they should not need editing after the renumber.
   - No other migration problem found. Forward, rollback and roles apply cleanly, and the full `packages/db` suite passes.

2. Non-blocking: the class comment in `apps/worker/src/integrations/zoho/artwork/gallery-sale.ts:53-57` now wraps oddly: a line ends with "...mark it dealt with. The" and the sentence continues on the next line. Cosmetic only.

3. Non-blocking, a note for operations: with the register check in `isPaused`, a lax.art checkout or order for a work sold in the gallery stays held until an Administrator reopens the sale or the session expires. This matches the brief: no money path completes for a work Zoho says Sold. Staff copy and `docs/integrations/zoho.md` now say so.

## Checks on the previous review

- **Blocking 1 (CI `test` red): fixed.**
  - CI `test` and `ci-result` on `196b79c1` are both success.
  - Locally, the full `packages/db` suite with `MIGRATION_TEST_DATABASE_URL` passes: 212 files and 1159 tests passed, 2 files and 68 tests skipped (unrelated, environment-gated).
- **Blocking 2 (0393 shared with other PRs):** deferred to ship time as agreed. See finding 1.
- **Blocking 3 and should-fix 4 (an overridden item, or Dealt with, released the hold): fixed.**
  - (b) `DrizzleSoldAttentionStore.isPaused` (`packages/persistence/src/repositories/artwork-register/drizzle-sold-attention.store.ts:255-282`) returns true for an open item. It also returns true whenever the register entry is `sold` with ref kind `gallery_sale`, whatever state the item is in.
  - Every money path uses this one reader:
    - checkout: `assertCheckoutNotPaused` (`apps/shop-api/src/infrastructure/drizzle-checkout-money-pause.ts`);
    - order resume and late payment: `orderHoldsPausedArtwork` (`apps/shop-api/src/infrastructure/drizzle-payment-event.processor.ts:293-309`, used at `:772` and `:878`);
    - re-offer send and accept: `RegisterMoneyPauseGuard` with `DrizzleSoldAttentionStore` (`apps/api/src/container/create-reoffer-services.ts:60`).
  - `api_app`, `shop_app` and `worker_app` all have SELECT on `artwork_register` on the real DB, so the new query cannot fail in the api re-offer path.
  - (a) Recording a gallery sale from `lax_art` closes an `overridden` item as `replaced` and raises a fresh `open` item in the same transaction (`drizzle-artwork-register.repository.ts:471-473` and `:497-546`). The integration test "an earlier It is not sold does not survive Zoho's Sold: the sale reraises the item and money is paused" passes against Postgres.
  - Mutations, each reverted afterwards:
    - With the register clause in `isPaused` disabled, 5 persistence integration tests fail: Dealt with keeps the hold, a gallery sale with no item, override then Sold, and two concurrency cases.
    - With the reraise call removed, the override-then-Sold test fails.
  - "Dealt with" now calls `requireRecentAuthentication` (`apps/shop-api/src/routes/admin/v1/admin-sold-attention.routes.ts:116`) and is on `SHOP_ADMIN_STEP_UP_PATHS` (`packages/shop-contracts/src/staff-step-up.ts:28`).
- **Should-fix 5 (Reopen had no step-up): fixed.**
  - `requireRecentAuthentication` at `admin-sold-attention.routes.ts:161`.
  - `/admin/v1/artwork-register/:registerId/reopen-sale` is on `SHOP_ADMIN_STEP_UP_PATHS` (`staff-step-up.ts:29`).
  - The route tests and `step-up-paths.guard.test.ts` pass.
- **Test gap 6 (pre-record hold): fixed.**
  - New `GallerySaleRecorder on its own` tests (`apps/worker/src/integrations/zoho/artwork/sold-while-live-sync.test.ts`) cover `apply` and `sweep`.
  - Mutation: changing the condition at `gallery-sale.ts:93` to `if (false)` fails 2 tests. Reverted afterwards.
- **Test gap 7 (purchase vs Sold concurrency): fixed.** Three two-connection tests in `packages/persistence/src/repositories/artwork-register/gallery-sale.integration.test.ts` pass against real Postgres: purchase commits first, notice commits first, and both run at the same moment.
- **Minor 8 (history copy): fixed.** `apps/shop-admin/src/server/domain/zoho-register.vm.ts:505` now reads "Zoho's Status became Sold. lax.art listing to be taken off sale."
- **Minor 9 (duplicated Reopen copy): fixed.** The client string is gone. shop-api sends `reopenWaitReason` from `REOPEN_REFUSAL_MESSAGE.zoho_still_sold` (`artwork-register-review.service.ts:53`), and the client renders it (`reopen-gallery-sale.client.tsx:77`).
- **Minor 10 (previous `published_at` in the audit): fixed.** The runner records it in `beforeJson`, and `gallery-sale-listings.integration.test.ts:119-120` asserts it.
- **Attribution:** none of the six commit messages and none of the PR text contain Co-Authored-By, Claude-Session or generated-by lines.

## Verification run

- Setup at `196b79c1`: `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`. Throwaway Postgres 16 under `/var/tmp` on port 55432, with `db:migrate` and `db:roles` applied.
- Vitest, all on Postgres where the suite needs it:

  | Suite | Result |
  |---|---|
  | `packages/artwork-register-contracts` | 289 passed |
  | `packages/shop-contracts` | 108 passed |
  | `packages/persistence` `src/repositories/artwork-register` (`--no-file-parallelism`) | 101 passed, 1 skipped (an unrelated `api_app` read test) |
  | `apps/worker` `src/integrations/zoho` (`--maxWorkers=2`) | 516 passed, 7 skipped (fulfilment readers that need a `worker_app` URL) |
  | `apps/shop-api`: sold-attention routes, `application/artwork-register`, scheduler, step-up path guard, money-pause and gallery-sale-listings integration | 237 passed |
  | `apps/shop-api`: every test file the PR changes | 65 passed |
  | `apps/shop-admin` `components/from-zoho` and `server/domain` | 719 passed |
  | `packages/db`, full suite with `MIGRATION_TEST_DATABASE_URL` | passed (see above) |

- `tsc --noEmit`: clean for shop-api, shop-admin, worker, persistence, artwork-register-contracts, shop-contracts and db.
- `biome check` on the PR's changed files: clean.
- CI (check-runs on `196b79c1`): every completed check succeeded, including `test`, `static-checks`, `build`, `browser-gates`, `shop-v1-phase-smoke (admin-routes)` and `ci-result`. `art-browser-gates` was skipped.
- The PR branch was not modified. The mutation probes were local and were reverted.
