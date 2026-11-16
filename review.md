Verdict: FIX FIRST

# Recheck of #1478: storage terms 4/7, buyer surfaces (after merging main)

Reviewed head `d7b2b84d` ("Merge main into storage-terms-buyer-surfaces", parents `db57a865` and main `bb60b42e`, which includes #1477). Judged against the first review on this branch, the PR body "Changes after review", and `docs/design/storage-terms.md` (ST5, ST9, ST11, ST13, "Buyer copy", "Not yet built").

The fixes for findings 2 to 11 of the first review are in place. The merge itself is not: it took main's `StorageTerms` (`countMode`) but left the buyer code writing the old `dayCount` field. The API does not compile, every CI build job fails, and at runtime every lot that has storage terms throws inside the purchases read. Finding 1 of the first review is still open.

## Findings

1. **Blocking: the merge leaves `dayCount` in the buyer code, so the API does not compile.** #1477 renamed `StorageTerms.dayCount` to `countMode` (`packages/domain/src/storage-terms.ts:53`). These still write `dayCount`:
   - `apps/api/src/services/organisation-buying/purchase-storage.ts:24` (TS2353)
   - `apps/api/src/lib/public-storage-terms.ts:20` (TS2353)
   - `apps/api/src/lib/public-storage-terms.test.ts:36`
   - `apps/web/src/lib/purchases/purchases.test.ts:703` (TS2353 in the web typecheck)

   Fix: write `countMode` in all four places (better, delete the mappers; see finding 3).

2. **Blocking: every lot with terms breaks the buyer's purchases read.** Because the mapped terms have no `countMode`, `assertStorageTerms` (`packages/domain/src/storage-terms.ts:105`, called from `calculateStorageCharge` at `:217`) throws `RangeError: Storage days are counted in calendar or working days`. `purchaseStorageOf` (`apps/api/src/services/organisation-buying/purchase-storage.ts:67`) and its caller `collectByOf` (`apps/api/src/services/organisation-buying/purchase-view.ts:169`) do not catch it, so one such lot fails the whole purchases list, not just its notice. This is the risk the first review raised under finding 1. Local runs:
   - API `purchase-storage.test.ts`: 10 of 10 fail with this error.
   - Web `src/lib/purchases/purchases.test.ts`: 7 fail with the same error ("under the place's storage terms": upcoming, soon, charging, charging off, and others).

   The lot and shipping pages do not throw, because `formatStorageTerms` does not assert. They read `countMode` as `undefined`, though, so working-day terms would be described in calendar days (`storage-terms.ts:270`).
   Fix: after finding 1, also make a bad stored row fail only that lot's notice. Catch in `purchaseStorageOf`, log it, and fall back.

3. **Blocking: the merge did not do the rest of the first review's finding 1.**
   - **Duplicate mappers.** `storageTermsOfRecord` (`apps/api/src/lib/public-storage-terms.ts:17-26`) and `termsOf` (`purchase-storage.ts:19-30`) both copy stored terms into `StorageTerms` by hand, next to #1477's `toTermsView` (`apps/api/src/services/collection-storage/collection-storage.service.ts:64-69`). The hand copies are what kept the stale field. Keep one mapper, in the persistence layer or the domain, and use it in all three places.
   - **Legacy terms not used.** A lot with no recorded terms still returns `null` from `purchaseStorageOf` (`purchase-storage.ts:63-65`). It then falls back to `purchaseCollectBy` with `collectByPolicyFor(storage.freeStorageDays)` (`purchase-view.ts:170-176`): the place's own free days, not ST9's 30 calendar days. Main's own comment (`packages/domain/src/collection-storage.ts:20-23`) says such lots go through `LEGACY_STORAGE_TERMS` and `calculateStorageCharge`. Use `storageTermsForLot(recorded)` so legacy lots get 30 days free, nothing charged, from the same formatter. If the plan is to keep today's notice for legacy lots, say so in the design doc, because it contradicts ST9 for places whose `free_storage_days` is not 30.
   - The PR body says these would be done by "merging main once #1477 lands". The merge commit only resolved text conflicts.

4. **Blocking: CI is red on `d7b2b84d`.** REST check-runs, polled until complete. Every check has finished. Every failed job failed on the two TS2353 errors in finding 1:
   - `static-checks`
   - `build`
   - `api vitest (2/2)`
   - `web vitest (1/8)` to `(8/8)`
   - `identity boundary conformance`
   - `browser-gates`
   - `account-browser-gates`

   These passed: `test`, `api vitest (1/2)`, the shop-api shards, the docker images, `ui-chromium`, `build-packages`, the identity jobs and the role contracts. These were skipped by path filters: `art-browser-gates` and `shop-v1-phase-smoke`.

5. **Non-blocking: route JS could not be checked.** The CI `build` job failed before `next build`, so there is no route table for this head. The first review's table (no change against main) still holds for the pre-merge code. Recheck it once the build is green.

6. **Nit: two evidence screenshots are stale.**
   - `docs/pr-evidence/storage-terms-buyer/light-1440-shipping.png` (and its siblings) still show the old "Where lots remain uncollected for an extended period…" sentence below the concrete terms. The code no longer does this (`apps/web/src/app/(marketing)/shipping/page.tsx:228`, shown only when no place has terms).
   - `light-375-lot.png` still has the cookie banner over the "Storage policy" link. Both are noted as not retaken in the evidence README, but they now show behaviour the code no longer has. Retake them, or remove them.

## First-review findings 2 to 11: status

- **2. Total cut off at 375 px: fixed.** `dark-375-purchases-list.png` shows "Storage £9.00 so far" on its own badge, not cut off.
- **3. London-day test in the API: fixed** (`purchase-storage.test.ts`, "uses the London day, not the UTC day, in summer time"). It currently fails only because of finding 2.
- **4. Extension and the early-warning lead: fixed.** There is a domain test, and the domain suite passes (406 tests).
- **5. Pauses: partly applied, and the rest stated clearly.** A shipping quote LAX still owes pauses the total (`quotePausesOf`, `purchase-storage.ts:38-52`). Open checks and disputes are listed under "Not yet built" in the design doc as needed before PR 6. Accepted.
- **6. Lot page uses the terms at sale close: fixed.** `storageTermsTextForVenue` reads the terms in force on the London day of `closesAt` (`public-storage-terms.ts:33-42`).
- **7. Booking page read: fixed.** It runs in parallel with availability in `Promise.all`, a failed read is logged, and the ST13 gap is recorded (`apps/web/src/app/(client)/purchases/collect/page.tsx:173-176`).
- **8. Copy outside the approved list: fixed** by recording it in "Buyer copy" (`docs/design/storage-terms.md:76-83`). The "£0 a day" wording is gone.
- **9. Shipping page contradiction: fixed in code.** The screenshot is stale (finding 6).
- **10. Clean screenshots: partly.** The 375 px list and notice shots are clean. The lot, shipping and booking shots were not retaken (finding 6).
- **11. Waived past its day: fixed.** It reads "No storage to pay" in the neutral state, and there is a test.

## Copy and ST11

The domain formatter's wording matches "Buyer copy" for:
- upcoming, soon, charging, charging off, extended and waived
- the list badge
- the booking line
- the lot and shipping sentence

The domain tests pin this wording, and all of them pass. The ST11 test, "charging off before the day still shows the free period and the rates", passes: while charging is off, upcoming and soon still show the free period and rates. After the day, today's wording stays, and nothing is shown as due. The API and web tests that cover this end to end fail only because of finding 2.

## Screenshots

I opened `dark-375-purchases-list.png`, `light-375-lot.png` and `light-1440-shipping.png`. Text is readable in both themes. The badges wrap, and nothing scrolls sideways. See finding 6 for the stale shots.

## Attribution

No commit in `origin/main..d7b2b84d`, and neither the PR title nor its body, has a Co-Authored-By, Claude-Session or generated-by line.

## Verification

- `corepack enable`, `pnpm install --frozen-lockfile` and `pnpm -r --filter './packages/**' build` pass.
- Typecheck:
  - domain: passes.
  - API: 2 errors, from finding 1.
  - web: 1 error from finding 1, plus the `rpc-app.ts` error that needs the API built and predates this branch.
- Tests (`--maxWorkers=2`):

  | Suite | Scope | Result |
  |---|---|---|
  | Domain | `storage-terms`, `collection*` | 406 passed |
  | API | `public-storage-terms`, `organisation-buying`, `catalog` | 217 passed, 10 failed (all in `purchase-storage.test.ts`, RangeError), 7 skipped |
  | Web | purchases, dashboard purchases, lot page, account-buying, public-catalogue, collect, shipping, purchases routes | 334 passed, 7 failed (all in `purchases.test.ts`, RangeError) |

- `biome check` on the 50 changed TS/TSX files is clean.
- `lint:client-copy` passes (21 passed).
