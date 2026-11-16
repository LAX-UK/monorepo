Verdict: FIX FIRST

# Review of #1478: storage terms 4/7, buyer surfaces on LAX Bid

Reviewed head `5d989834` (6 commits on merge base `3ad0a869`; main is at `a54b584f`). Judged against `docs/design/storage-terms.md` (ST11, ST12, "Buyer copy"), the ST11 decision (while charging is off, upcoming and soon notices still show the free period and rates; only the notice after the day keeps today's wording), and items 1, 2 and 4 of the #1457 recheck.

The buyer work itself is sound. One item blocks: this branch does not merge with #1477 (PR 3/7), and after a hand-merge it would not compile. PR 3 goes in before PR 4, so rebase this branch onto #1477 before merging it.

## Findings

1. **Blocking: conflicts with #1477 (`storage-terms-staff-tab`, `c66cc7ba`).**
   - `git merge-tree --write-tree origin/storage-terms-staff-tab origin/storage-terms-buyer-surfaces` reports `CONFLICT (content)` in `packages/domain/src/storage-terms.test.ts`.
   - Both branches also edit `packages/domain/src/storage-terms.ts` and `packages/domain/src/index.ts`. Those two files merge without a text conflict, but the result does not type-check. #1477 renames `StorageTerms.dayCount` to `countMode` and removes the `StorageDayCount` export, which is the agreed unification. This PR still writes `dayCount` in four places, and its `index.ts` hunk sits next to the removed `type StorageDayCount` export:
     - `apps/api/src/services/organisation-buying/purchase-storage.ts:23`
     - `apps/api/src/lib/public-storage-terms.ts:20`
     - `apps/api/src/lib/public-storage-terms.test.ts:36`
     - `apps/web/src/lib/purchases/purchases.test.ts:703`
   - Fix: rebase onto #1477 once it merges. While doing that, also:
     - Delete `storageTermsOfRecord` (`apps/api/src/lib/public-storage-terms.ts:17-26`). It duplicates #1477's record mapper (`apps/api/src/services/collection-storage/collection-storage.service.ts:65-69`). Keep one.
     - Use #1477's `storageTermsForLot` / `LEGACY_STORAGE_TERMS` for lots with null terms (`purchase-storage.ts:16-28`, `:43`), so legacy lots go through the same formatter (ST9, recheck item 5). This PR rightly left that to PR 3. It is listed here so the rebase does not miss it.
     - Check that #1477's new `assertStorageTerms` throw inside `calculateStorageCharge` cannot fail the whole purchases read. `purchaseStorageOf` (`purchase-storage.ts:44`) does not catch it. One bad stored row would then break the buyer's purchases page instead of only that lot's notice.
2. **Non-blocking (must land before charging is switched on): the running total is cut off in the purchases list at 375 px.** In `docs/pr-evidence/storage-terms-buyer/dark-375-purchases-list.png`, the charging row reads "Collect by Mon 16 Nov · S…". The amount, which is the reason for the badge, is clipped (`apps/web/src/components/dashboard/purchases/purchase-row.tsx:109-111`). The row's `aria-label` (`:76`) has the full text, so screen readers are fine. Nothing shows today, because the badge carries an amount only while charging is on. Let the badge wrap, or put the amount on its own line on narrow screens.
3. **Non-blocking: the API has no London-day test.** `purchase-storage.ts:52` uses `londonDateKey(now)`, which is correct. But changing it to the UTC day (`now.toISOString().slice(0, 10)`) still passes all 201 API tests. The domain DST tests do not cover this call. Add a `purchaseStorageOf` case at 23:30 UTC in BST, where the London day is the next day.
4. **Non-blocking: half of the item 4 fix is untested.** Checking `soon` before `extended` (`packages/domain/src/storage-terms.ts:122-123`) is covered. Adding `extensionDays` to the early-warning test (`:121`) is not: removing it passes all tests. It only matters when the free period is 7 days or fewer and an extension takes it past 7. Add that case.
5. **Non-blocking (known gap): pauses are not applied.** `purchase-storage.ts:50` passes `pausedRanges: []`, so open checks, disputes and owed quotes (ST5) do not stop the buyer's running total. The PR text names this. It must land before charging is switched on (PR 6), or buyers in a dispute will see charges.
6. **Non-blocking: the lot page shows today's terms, not the terms the lot will be sold under.** `apps/api/src/lib/public-storage-terms.ts:34` reads the terms in force on today's London day. ST9 says a lot keeps the terms in force when its sale closes. If a change is scheduled before an open lot's sale closes, the page states the outgoing rates. Read the terms in force on the sale's close day, or accept this and record it in the design doc.
7. **Non-blocking: the booking page makes an extra read on every load.** `apps/web/src/app/(client)/purchases/collect/page.tsx:182-191` reads all of the account's purchase facts again, after `loadAvailability` and not in parallel with it. While charging is off it can never show anything, because `amountPence` is 0. Run it in parallel or skip it while charging is off. Also, `.catch(() => null)` hides errors without logging them, and the `as string` cast is redundant after the null check. A visit being changed gets no "Storage to pay" line, while ST13 says the charge is re-priced when the visit moves. That is fine until billing exists, but record it for PR 6.
8. **Nit: copy beyond the approved wording.** These have no approved wording in the design doc. Confirm each with the product owner or add it to the doc:
   - the handling-fee sentence on the upcoming and soon notices, "A handling fee of £x applies once when charges start." (`storage-terms.ts:220-223`)
   - the large-band-only wording "…and nothing for others" (`:184`)

   The fee also uses two formats in one line: "£14.00 so far (3 days at £3 a day, and a £5 handling fee)" (`:253`). At a zero rate with a fee set, the charging notice says "3 days at £0 a day". The fee is £0 today.
9. **Nit: the shipping page now says two different things.** The concrete terms (`apps/web/src/app/(marketing)/shipping/page.tsx:214-223`) are followed by the old sentence "Where lots remain uncollected for an extended period, storage charges may apply…" (`:229`). Show the old sentence only when no place has terms.
10. **Nit: overlays hide parts of the evidence screenshots.** The cookie banner, the Next dev indicator and a floating avatar cover part of every 375 px shot. In `light-375-lot.png` they hide the "Storage policy" link. Dismiss them before capturing.
11. **Nit: a waived lot past its day.** `purchase-storage.ts:63` maps `waived` to the legacy state `upcoming` even after the collect-by day. The notice and badge read "Collect by {past day}" in a neutral or info tone. That is acceptable, since nothing is owed, but a test would pin it down.

## Checked and correct

- **One formatter.** `purchaseStorageView` (`storage-terms.ts:290-314`) builds the notice, badge and amount from `formatStorageNotice` / `formatStorageBadge`. The API returns them (`purchase-storage.ts`), and the web only draws them (`purchases.vm.ts`, `purchase-collection.ts`). The lot page and shipping page use `formatStorageTerms` through the API (`public-storage-terms.ts`). The booking line comes from `collect-copy.ts`.
- **Buyer copy matches "Buyer copy" word for word:**
  - upcoming
  - soon
  - charging, with the running total
  - charging off: today's wording, unchanged
  - extended
  - waived
  - list badge, "Collect by {day} · Storage {amount} so far"
  - booking summary, "Storage to pay · Charged up to your visit day. If you move the visit, we adjust it."
  - lot and shipping sentence

  The lot page heading is "Collection and storage".
- **ST11 decision.** While charging is off, upcoming and soon still show the free period and rates (`storage-terms.ts:235`, independent of `chargingOn`). A mutation that hides them while charging is off is caught by "charging off before the day still shows the free period and the rates (ST11)". After the day, today's "may apply" wording stays. The list badge keeps "Overdue since". `amountPence` is 0 while charging is off (`:312`), so nothing is shown as due.
- **Recheck item 1 (handling fee named).** The charging notice adds ", and a £5 handling fee" (`:253`), so the figures add up. Tested, and a mutation that drops it is caught.
- **Recheck item 2 (no charging and no £0).** A lot past its day with nothing owed is in the new `overdue` state (`:116`), which reads "That day has passed." with no "may apply" and no total. Upcoming and soon drop the rate clause at a zero rate (`:235`, `:263`, `:268`). The badge shows an amount only when one is owed (`:285`). The web badge is a warning, not a danger, when nothing is owed. Mutations here are caught.
- **Recheck item 4 (extension and soon).** `soon` is checked before `extended`, and the lead is measured from the extended collect-by day. Tested and caught by a mutation. See finding 4 for the untested half.
- **London days and DST.** `storageClearedOn` and `londonDateKey(now)` are used throughout. The domain tests cover both clock changes and the 23:30 UTC case. The API case is finding 3.
- **Money in integer pence.** Amounts are day count × integer rate + fee, with no division. `money()` formats them. The persistence pricing read sums integer extension days.
- **Nothing billed.** No invoice, payment or ledger writes. The booking line appears only when `amountPence > 0`, which needs charging on.
- **Persistence.** `readLotStoragePricing` makes three queries however many lots there are. The calendar range covers 2 × free days plus the extension plus the 60-day look-ahead, enough for working days.
- **UI.** The new markup uses only LAX tokens (`border-lax-line`, `text-lax-*`), the shared `Notice` / `StatusBadge` / `FactList` / `Link` components, and copy files (`lib/lot/storage-copy.ts`, `lib/collect/collect-copy.ts`). Headings: a labelled `<aside>` with an `h2`, the same as "Buying this work". There is no new live region; the existing `Notice` keeps its `role="status"`. I opened the screenshots: light and dark, 1440 and 375 px. Text is readable in both themes, and nothing scrolls sideways except finding 2.
- **SEO.** `LotDetails` and `LotTemplate` are server components. `storageTerms` comes from the cached public lot read (60 s revalidate), so the facts are in the server HTML. A failed read leaves the section out and the page still renders.
- **Route JS not raised.** From the CI `build` job:

  | Route | This PR | Main `a54b584f` |
  |---|---|---|
  | `/lot/[slug]/[id]` | 54.6 kB / 397 kB | 54.6 kB / 397 kB |
  | `/purchases/collect` | 17.8 kB / 294 kB | 17.8 kB / 294 kB |
  | `/purchases` | 8.76 kB / 323 kB | 8.76 kB / 323 kB |
  | `/shipping` | 327 B / 216 kB | 327 B / 216 kB |

  Route-JS budget table: lot group 481.4 KB, enforced, ok (ratchet 486.8 KB). Checkout group 476.2 KB, ok. No budget or baseline file changed.
- **Attribution.** No commit message on the branch, and neither the PR title nor its body, has Co-Authored-By, Claude-Session or generated-by lines.

## Verification

- `corepack enable`, `pnpm install --frozen-lockfile` and `pnpm -r --filter './packages/**' build` pass.
- Tests (`--maxWorkers=2`), all passed:

  | Suite | Scope | Result |
  |---|---|---|
  | Domain | `storage-terms`, `collection*` | 382 passed |
  | Persistence | `purchase-storage-pricing` | 2 passed |
  | API | `public-storage-terms`, `organisation-buying`, `catalog-lot-read` | 217 passed, 7 DB tests skipped |
  | Web | lot page, shipping, collect session, purchase detail and list, `purchases`, `account-buying`, `public-catalogue`, `lot-page` | 466 passed |

- Typecheck passes for domain, persistence, API and web. The web check passes once `apps/api` is built.
- `biome check` on the 48 changed TS/TSX files is clean.
- These pass: `lint:client-copy`, `lint:layers`, `lint:deps`, `lint:datetime`, `lint:web-guardrails`, `lint:bid-public-kit`, `lint:ui-guardrails`, `lint:web-barrel-imports`, `lint:z-schema-transform` and `lint:client-boundary`.
- Mutation run: 9 breaks. 7 were caught (ST11 rates hidden, the overdue wording, the fee left out, the amount shown while charging is off, `extended` checked before `soon`, the badge tone, and the passed-notice wording). 2 survived: the UTC day in the API (finding 3) and the extension left out of the lead (finding 4).
- CI on `5d989834` (REST check-runs, because GraphQL is blocked here): 37 runs, 35 passed, 2 skipped by path filters (`art-browser-gates`, `shop-v1-phase-smoke`), none failed. GitHub reports the PR as mergeable (`clean`) against main.
- `git merge-tree` against main is clean. Against `origin/storage-terms-staff-tab` it conflicts (finding 1).
- No full `next build` of `apps/web` was run, as instructed.
