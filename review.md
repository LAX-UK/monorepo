Verdict: SHIP

# Final recheck (round 3) of #1478: storage terms 4/7, buyer surfaces

Reviewed head `ad89b096` ("Merge main into storage-terms-buyer-surfaces", parents `75313d54` and main `2575d495`). Main is an ancestor of the head.

Judged against:
- the previous recheck on this branch (verdict FIX FIRST on `d7b2b84d`)
- the PR body section "Changes after merge review"
- `docs/design/storage-terms.md`

All six findings of the previous recheck are fixed. The first review's findings 2 to 11 still hold after the merge. Every required CI check is green. There are no blocking findings.

## Findings

None blocking. Three notes:

1. **Non-blocking: legacy terms are skipped at a place with no opening calendar.** A pre-terms lot at such a place falls back to `collectByPolicyFor(storage.freeStorageDays)`, not ST9's 30 days (`apps/api/src/services/organisation-buying/purchase-storage.ts:57`, `apps/api/src/services/organisation-buying/purchase-view.ts:170-176`).
   - This is stated in "Buyer copy" (`docs/design/storage-terms.md:84`).
   - The reader only builds a storage row for a place with online booking (`packages/persistence/src/repositories/drizzle-workspace-buying.readers.ts:395`), so in practice such places have hours.
   - Worth closing before PR 6 so every lot goes through one rule.
2. **Non-blocking: the catch in `purchaseStorageOf` is mostly defence in depth** (`purchase-storage.ts:86-92`).
   - A bad `count_mode` cannot be stored, because the column has a CHECK constraint (`packages/db/drizzle/0393_collection_storage_terms.sql:37`). I confirmed against Postgres 16 that the insert is refused.
   - The catch still covers other `assertStorageTerms` failures, such as negative pence, without failing the list. Keep it.
3. **Nit: route JS has 0.1 KB build noise on untouched routes.** Measured locally with `next build` on main `2575d495` and on this head, same environment:
   - Nine routes this PR does not touch are 0.1 KB larger (for example `/(marketing)/about/page` 344.9 to 345.0).
   - 34 routes are smaller, and the net change over the 114 routes is -2.6 KB.
   - The CI build of this same head measures the lot page at 467.4 KB, where my local build of the same tree measured 467.5 KB, so 0.1 KB is within build-to-build variation.
   - The routes this PR touches did not grow (see the table under finding 5 below).

## Previous recheck findings 1 to 6

1. **`dayCount`: fixed.** `git grep dayCount` over the whole tree at `ad89b096` returns nothing. `countMode` is used throughout. The two hand-written mappers (`storageTermsOfRecord`, `termsOf`) are gone. There is one copier, the domain `storageTermsOf` (`packages/domain/src/storage-terms.ts:84`), used by:
   - the persistence read of a lot's sold-under terms (`packages/persistence/src/lib/purchase-storage-pricing.ts:73`)
   - the lot and shipping text (`apps/api/src/lib/public-storage-terms.ts:26`)
   - the staff view (`apps/api/src/services/collection-storage/collection-storage.service.ts:67`)

   `SoldUnderTerms` is now the domain `StorageTerms` type (`purchase-storage-pricing.ts:11`).
2. **A purchase whose lot has terms reads correctly: fixed.**
   - Tests: API `purchase-storage.test.ts` ("counts working days when the terms say so", "is absent, and logged, for stored terms the rules cannot price") and `purchase-view-collect-by.test.ts:311` pass.
   - Persistence integration on Postgres 16: `drizzle-workspace-buying.collect-by.integration.test.ts`, 8 of 8, including "reads the terms a lot was sold under in the shape the storage rules accept".
   - API path against Postgres 16: I ran a scratch test (not committed). It seeds a place, terms and a won lot, reads the lot with `DrizzleAccountPurchaseFactsReader`, then runs the real `purchaseView`. With working-day terms (10 working days, £3 a day, £5 handling fee) and charging on, cleared Sat 1 Mar 2031, as of 16 Mar:
     - collect-by day: `2031-03-14`
     - storage state: `charging`, 1100 pence
     - notice: "£11.00 so far (2 days at £3 a day, and a £5 handling fee), plus VAT where it applies."
     - badge: "Collect by Fri 14 Mar · Storage £11.00 so far"
3. **Legacy terms: fixed.**
   - Code: `purchaseStorageOf` uses main's `storageTermsForLot` (`purchase-storage.ts:59`), so a lot with no recorded terms is priced under `LEGACY_STORAGE_TERMS`. There is no second legacy constant or helper.
   - DB-backed check, a place with 14 free days:
     - As of 20 Mar: collect by `2031-03-31` (30 days), "Storage is free until then."
     - As of 30 Apr: state `overdue`, `amountPence` 0, "That day has passed. Book a time to collect your work from Facts gallery, or email us if you need longer."
   - Tests: the same case is covered at `purchase-storage.test.ts:51`, `purchase-view-collect-by.test.ts:343` and the persistence integration test.
   - Design doc: recorded in "Buyer copy" (`docs/design/storage-terms.md:83-85`).
4. **CI: fixed.** I polled REST check-runs on `ad89b096` until every run finished:
   - Success: `ci-result`, `static-checks`, `build` (route-JS budgets all ok), `test`, `api vitest` 1/2 and 2/2, `web vitest` 1/8 to 8/8, `shop-api vitest` 1/4 to 4/4, `identity boundary conformance`, `browser-gates`, `account-browser-gates`, `build-packages`, `ui-chromium`, the docker images, the role contracts and the identity jobs.
   - Skipped by path filters: `art-browser-gates` and `shop-v1-phase-smoke`.
5. **Route JS: no growth on the touched routes.** Local `next build` of main `2575d495` against this head, with the placeholder Sentry DSN as in CI, measured with `scripts/check-route-js-budget.mjs --all`. Figures are gzip start-up JS in KB.

   | Route | main | this PR |
   |---|---|---|
   | `/(marketing)/lot/[slug]/[id]/page` | 467.5 | 467.5 |
   | `/(marketing)/shipping/page` | 341.9 | 341.9 |
   | `/(client)/purchases/(list)/page` | 483.4 | 483.4 |
   | `/(client)/purchases/[lotId]/page` | 487.1 | 487.1 |
   | `/(client)/purchases/collect/page` | 471.7 | 471.7 |
   | `/(marketing)/(home)/page` | 394.5 | 394.5 |

   No budget or baseline file is changed. For the other routes, see note 3.
6. **Screenshots: current.** The `lot` and `shipping` shots were retaken in `21d6b6ff`.
   - `light-375-lot.png` has no cookie banner, and the "Storage policy" link is clear.
   - `light-1440-shipping.png` and `dark-375-shipping.png` show the concrete terms with no "Where lots remain uncollected for an extended period…" sentence. This matches the code: `apps/web/src/app/(marketing)/shipping/page.tsx:228` shows that sentence only when no place has terms.
   - Text is readable in both themes, and nothing scrolls sideways at 375 px.

## First-review findings 2 to 11: still hold after the merge

- **2. Total cut off at 375 px:** still fixed. The status cell wraps and is bounded (`apps/web/src/components/dashboard/purchases/purchase-row.tsx:109`).
- **3. BST test:** "uses the London day, not the UTC day, in summer time" (`purchase-storage.test.ts:186`) passes.
- **4. Extension and the early-warning lead:** the domain tests at `packages/domain/src/storage-terms.test.ts:253` and `:289` pass.
- **5. Pauses:** an owed shipping quote pauses the total (`quotePausesOf`, `purchase-storage.ts:30-42`). Open checks and disputes are still listed under "Not yet built", to land before PR 6.
- **6. ST9 lot-page terms:** the lot page reads the terms in force on the London day the sale closes (`apps/api/src/lib/public-storage-terms.ts:24`).
- **7. Booking page read:** the purchase facts are read in `Promise.all` with availability, and a failed read is logged (`apps/web/src/app/(client)/purchases/collect/page.tsx:173-178`).
- **8. Copy per spec:** the wording is unchanged and pinned by the domain tests, and the extra wording is in "Buyer copy". `lint:client-copy` passes.
- **9. Shipping page:** fixed in code and in the screenshots.
- **10. Clean screenshots:** all of them are now retaken (finding 6 above).
- **11. Waived wording:** "No storage to pay" (`packages/domain/src/storage-terms.ts:347`, test at `storage-terms.test.ts:474`).

## Attribution

No commit in `origin/main..ad89b096` has a Co-Authored-By, Claude-Session or generated-by line. Neither does the PR title or body.

## Verification

- `corepack enable`, `pnpm install --frozen-lockfile` and `pnpm -r --filter './packages/**' build` pass.
- Typecheck (`tsc --noEmit`):
  - domain, persistence and API: clean.
  - web: only the `rpc-app.ts` error that needs the API built and predates this branch.
- Tests (`--maxWorkers=2`, Postgres 16 for the integration files):

  | Suite | Scope | Result |
  |---|---|---|
  | Domain | `storage-terms`, `collection*` | 407 passed |
  | Persistence | workspace-buying readers and collect-by integration, `purchase-storage-pricing` | 19 passed |
  | API | public terms, organisation-buying, collection-storage, catalog | 265 passed |
  | Web | purchases lib, dashboard purchases, lot page, collect, shipping, purchases routes, account-buying and public-catalogue data | 312 passed |
  | API on Postgres | scratch `purchaseView` test (not committed) | 3 passed |

- `biome check` on the 52 changed source files is clean.
- `lint:client-copy` passes.
