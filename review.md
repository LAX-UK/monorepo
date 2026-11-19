Verdict: SHIP

# Review of PR #1571: Zoho artwork write-back audit fixes (F1 F4 F8 F12 F15 F16 F21)

Head reviewed: `b959b74f` (5 commits on `33ca431d`, current `origin/main`). Each fix was checked against what `findings.md` (branch `review-notes-systems-final-audit`) asked for, then by tracing the code, not only the PR's tests. The PR branch was not changed.

## Test and typecheck run

Run on a throwaway Postgres 16 on :55432 and a local Redis, after `db:migrate` and `db:roles`, with `vitest run --maxWorkers=2`:

| Package | Result |
|---|---|
| @auction/persistence | 1150 passed, 19 skipped (the artwork-register Postgres integration file ran 57/57, including the new stock code conflict test) |
| @auction/worker | 2298 passed, 469 skipped (role-scoped integration tests need `DATABASE_URL_WORKER`, as in CI) |
| @auction/shop-api | 3096 passed, 638 skipped |
| tsc --noEmit (worker, shop-api, persistence, types) | clean |

## Per finding

**F1: fixed.** Two parts, and either one alone is enough:
- Writer side, `apps/worker/src/integrations/zoho/artwork/listing/zoho-listing-writeback.ts:56`: in `dry_run`, every outcome that is not a failure and not `not_an_original` is now `dry_run`. A dry run can no longer record `listing_already_in_sync`, `newer_listing_in_zoho` or a success.
- Reader side, `apps/shop-api/src/application/zoho-mirror/derive-zoho-mirror-state.ts:150`: only a listing delivery with status `succeeded` proves `live`. A listing skip falls back to `ZOHO_ARTWORK_LISTING_MODE`, so dry-run-era skips already in the ledger read in the configured mode.

I walked every combination: writeback off, dry_run or live; listing off, dry_run, live or unset; newest delivery a listing skip, a listing success, or a writeback success/in-sync/dry_run/off. "Mirrored, live" now needs one of two things: a `succeeded` delivery (a listing success is recorded only live, and a writeback success only live, `zoho-artwork-writeback-service.ts:91,106`), or a writeback `*_already_in_sync` skip (also live only, because both dry-run branches return first), or a listing skip while shop-api is configured with the listing `live`. Live still proves live (test "reads a listing success as live whatever mode shop-api is told").

**F4: fixed.** `writeback-mapping.ts:30` sends only when Zoho is blank. Equal is in sync. Anything else is a conflict, raised through the new `recordStockCodeConflict` (`zoho-artwork-writeback-service.ts:113`). That writes the same `artwork_register_conflict` row (`field = stockCode`) and `conflict_recorded` history the inbound sync writes, via the shared `raiseConflict` (`drizzle-artwork-register.repository.ts:803`). An identical open conflict is `unchanged`, and the upsert keeps one open row per field. Nothing is written to Zoho in the conflict branch (unit test asserts `products.update` not called). The go-live catch-up requeues deliveries into this same `deliver()`, so it fills blanks and raises the rest; it cannot overwrite in bulk.

On "last written": the PR records no separate last-written stock code. Instead it relies on the register's code never changing except by accepting Zoho's value. I checked this. The only update of `register.stock_code` is `applyZohoStockCode` (`drizzle-artwork-register.repository.ts:894`), and after it Zoho equals the register. The writeback is the only code that writes `Reference_Stock_Code`. So "Zoho equals LAX's last-written value" can only happen when Zoho equals the current code, which is handled as in sync. The rule as built is equal to, or stricter than, what was required, and never a silent overwrite.

**F8: fixed.** `docs/integrations/zoho.md:268` and `:384` now say the Status runs whenever `ZOHO_ARTWORK_WRITEBACK_MODE` is not `off`: inside the listing job, or on its own at 03:15 (`zoho-status-nightly-check`). This matches `create-zoho-status-nightly.ts` (built only when the listing is off) and `ZOHO_STATUS_NIGHTLY_PATTERN = "15 3 * * *"`. The badge docs (`:409-419`) were also corrected to say the listing's in-sync skips are recorded only live.

**F12: fixed.** `zoho-status-sync.ts:337-353` handles a retryable write error (timeout or reset) with one re-read. The write counts as landed only if Zoho shows `wanted` and `causeOf(Modified_By)` is `zoho_automation`, meaning it equals the integration user id. `causeOf` (`:428`) returns `staff` when the integration-user lookup is missing or fails, and a failed re-read yields `false`. So a staff value, or an unknown author, is never recorded as LAX-written, and the original error is rethrown. A certain refusal (non-retryable) is not re-read (tested). A landed write then goes through the normal `recordCatalogueStatusWritten` and check-after-write (`:301-307`), so the compare-and-set, the stale re-read and the post-write conflict path are unchanged. A Status already differing at the re-read is still `stale`, and existing conflicts and the gallery-sale rule are untouched (Status suite green).

**F15: fixed.** `gallerySaleOwnedByZoho` and `stockCodeConflictRaised` are added to `ARTWORK_WRITEBACK_SKIP` (`packages/types/src/zoho-mirror.ts`). `zoho-status-sync.ts` emits all three of its skip reasons from the constant (its type is now derived from it). The listing projector imports `ZOHO_ARTWORK_LISTING_CONSUMER`. Both files are added to `zoho-mirror-skip-reasons.contract.test.ts`, whose regex rejects `reason: "` and bare consumer strings.

**F16: fixed for the case the finding named.** `modeOfUnsent` (`derive-zoho-mirror-state.ts:202`) makes an artwork with no deliveries read `mirroring_off` only when both modes are `off`. With the writeback off and the listing unset, `mode` is `null` and the record reads `not_sent_yet`: not off, which is the safe reading. Tested for off/off, off/dry_run and live/off.

**F21: fixed.** `zohoLocationValue` (`location/zoho-location-fields.ts:21`) collapses and trims, and trims again after the 255 cut. The same value is used for the compare and the send (`zoho-location-sync.ts`: one `value` feeds both the equality check and `planned.value`), so they are identical by construction. Tests cover stray spaces, whitespace-only names and a cut that lands on a space.

**PR #1570 overlap:** the only shared file is `docs/integrations/zoho.md`. A trial merge of #1570 into this head is clean, and the merged text does not contradict itself (#1570's "dry_run needs OAuth" agrees with this PR's "dry_run Status pass reads Zoho"). The two PRs share no code files.

## Non-blocking follow-ups

1. **A stock code conflict leaves the badge "failed" for good, even after staff resolve it.** `derive-zoho-mirror-state.ts:99` makes `stock_code_conflict_raised` a failure that only a later good stock code delivery clears. But `artwork_register.stock_code_assigned` is published once, and `resolveConflict`/`applyZohoStockCode` (`drizzle-artwork-register.repository.ts:866-896`) publish nothing. So after "accept Zoho's" (register now equals Zoho) or "keep LAX's", no further stock code delivery ever comes. It fails safe (it shows a problem, never a false success), but after the go-live catch-up every resolved stock code conflict will keep reading Failed. Suggested fixes: publish `stock_code_assigned` when Zoho's code is accepted, or let the reader treat a resolved conflict as settling the stock code part.
2. **F16 residual with deliveries.** `derive-zoho-mirror-state.ts:267`: when the newest delivery is a writeback `writeback_off` skip (for example a `stock_code_assigned`, which the listing does not consume) and the listing is on, the artwork still reads "Zoho mirroring is off". This is outside what F16 asked for (the no-delivery case) but against its spirit.
3. **The stock code read-then-write is not compare-and-set.** A staff edit between the read and `products.update` (`zoho-artwork-writeback-service.ts:110-127`) can still be overwritten. The window is narrow, and only for a Product that was blank at the read. This is the same class as the documented Status residual race, and was already there before the PR.
4. **Doc nit.** `zoho.md:258` ("3 COQL reads + 1 update") does not mention the one extra read on an errored write (F12).

## Fixes after review

These are pushed to `fix/zoho-artwork-audit` as `e21c8767` (follow-up 1), `ae392f95` (follow-up 2) and `994cc967` (docs, follow-ups 3 and 4).

- **1. A resolved stock code conflict no longer reads Failed (fixed, reader side).** I chose the reader-side fix over publishing `stock_code_assigned`. On "keep LAX's", a new delivery would find that Zoho still differs and raise the conflict again, unless the writeback also learnt to overwrite Zoho. Overwriting Zoho is a behaviour change, and this PR keeps it out of scope. The reader change also gives the event no new meaning.
  - `packages/persistence/src/repositories/zoho-mirror/drizzle-zoho-mirror-ledger.reader.ts:74`: for artworks, the reader returns `stockCodeConflictResolvedAt`. That is the latest `resolved_at` of the artwork's `stockCode` conflicts, and it is given only when none of them is still open. Its type is at `interfaces/zoho-mirror-ledger.ts:44` and `apps/shop-api/src/application/ports/zoho-mirror.ports.ts:27`. The service passes it through at `zoho-mirror-status.service.ts:48`. `shop_app` already has SELECT on `artwork_register_conflict`, so no grant change was needed.
  - `apps/shop-api/src/application/zoho-mirror/derive-zoho-mirror-state.ts:217` (`settledByResolution`): a `stock_code_conflict_raised` skip recorded at or before that time no longer stands. It is used at `:264` (`standingFailure`) and passed over in `newestThatDecides` (`:233`). If a conflict is raised again after the resolution, it is open, so it still reads Failed.
  - Tests:
    - `derive-zoho-mirror-state.test.ts:226` covers both resolutions (accepted Zoho's code, kept LAX's code), the conflict being raised again after a resolution, and that no other failure is settled this way.
    - `zoho-mirror-ledger.integration.test.ts:318` covers accepted_zoho, kept_lax (latest of two), one still open, another field, none, and an order.
    - `zoho-mirror-status.service.test.ts:127` covers the pass-through.
- **2. A newest `writeback_off` skip no longer reads "off" while the listing is on (fixed).** In `derive-zoho-mirror-state.ts:233` (`newestThatDecides`), when an artwork's `listingMode` is `dry_run` or `live`, newer writeback deliveries that only say the writeback is off are passed over. The listing's newest delivery then decides; if there is none, the artwork reads `not_sent_yet` in the listing's mode.
  - "Only say the writeback is off" means the skip is `writeback_off`, or the delivery is not good while the writeback is configured `off`.
  - Tests at `derive-zoho-mirror-state.test.ts:282`: listing success behind a `writeback_off` skip reads mirrored live; only `writeback_off` with the listing in dry_run reads not sent yet in dry_run; with the listing off too it still reads mirroring off.
  - I changed one existing expectation (`:438`). A pending writeback delivery with the writeback off and the listing live now reads `not_sent_yet` (live), no longer `mirroring_off`.
- **3. Stock code read-then-write is not compare-and-set (left as a documented residual).** `docs/integrations/zoho.md:223` now has a one-line residual note.
- **4. Doc nit (fixed).** `docs/integrations/zoho.md:258` now says that a retryable errored Status write costs one more read, to see whether it landed.
- Badge docs: `zoho.md:415` (failed: a resolution settles a stock code conflict) and `:419` (`writeback_off` skips are passed over while the listing is on).

Re-run on Postgres 16 :55432 with Redis, `vitest run --maxWorkers=2`:

| Package | Result |
|---|---|
| @auction/shop-api | 3104 passed, 638 skipped |
| @auction/persistence | 1152 passed, 19 skipped |
| `tsc --noEmit` (shop-api, persistence) and biome on the changed files | clean |

The worker and types are untouched.
