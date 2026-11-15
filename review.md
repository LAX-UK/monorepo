Verdict: SHIP

# Review of #1457: storage terms 1/7, domain rules and the next-open-day collect-by rule

Reviewed head `871ee0c6` against the approved spec `docs/design/storage-terms.md` (branch `storage-terms-spec`, commit `d325c00f`; the copy in this PR is identical). Nothing below blocks the merge. Items 1 to 3 are buyer-facing wording and are cheapest to settle before PR 4 uses the formatter.

## Findings

1. **Non-blocking. The charging notice does not add up when a handling fee is set.** `packages/domain/src/storage-terms.ts:240` prints `{amount} so far ({n} days at {rate})`, but `amountPence` includes the handling fee (`:140-142`). Example: free 14 days, £3 a day, £5 fee, 3 days charged gives "£14.00 so far (3 days at £3 a day)". The fee is £0 today (spec Defaults), so no buyer sees this yet. Either add "plus a £5 handling fee" when the fee is above 0, or show the fee as its own line. Add a test for the fee case.

2. **Non-blocking. The state can be "charging" while £0.00 is owed.** `storage-terms.ts:115` returns `charging` as soon as `asOf > collectBy`, even when every day since then is paused (`:136-138`) or the rate is 0 (migrated terms in #1458 have rate 0). The buyer then reads "Storage charges since Tue 17 Nov · £0.00 so far (0 days at £3 a day)". Suggest staying in `soon`/`upcoming` (or a separate held state) until `chargeableDays > 0`. With a zero rate, use the charging-off wording. The upcoming copy has the same issue at a 0 rate: "and £0 a day after that" (`:254`).

3. **Non-blocking (spec question). While charging is off, the upcoming and soon notices hide the rate.** In `storage-terms.ts:249` and `:254`, when `chargingOn` is false the notice reads "storage charges may apply". The spec's charging-off banner says "Buyers see the free period and the rates below", and only the overdue wording is kept from today. The test at `storage-terms.test.ts:383` says this "reads as before", but today's upcoming copy (`apps/web/src/lib/collect/collect-copy.ts:153`) is "Book a time to collect it." It does not mention storage charges. Please confirm which wording the product owner wants, then rename the test to match.

4. **Non-blocking. An extension hides the "soon" warning.** `storage-terms.ts:116` puts `extended` ahead of `soon`. A lot with an extension never gets the "after {day}, storage is {rate} a day" warning in the week before its extended deadline. It goes straight from "Free storage extended to …" to charging. Consider "extended" until 7 days before the deadline, then "soon". The 7-day lead (`:118`) also compares against `terms.freeDays` and ignores the extension.

5. **Non-blocking (follow-up for PRs 3 to 5). The next-open-day move does not run yet.** `apps/api/src/services/organisation-buying/purchase-view.ts:167` and `apps/worker/src/services/collect-by-notices.ts:35` pass no calendar, so collect-by days are unchanged (verified). The approved move (CB-Q2) is therefore not live after this PR. When the calendar is wired in, the reminder query must widen its range by the same slack. That query is `apps/worker/src/repositories/drizzle-collect-by.reader.ts:46` (`first = today - free`). It repeats the cleared-range rule in SQL instead of calling `collectByClearedRange`, so the new `slackDays` parameter has no effect there. Without the change, a lot whose deadline moved past a closure gets no reminder on the moved day.

6. **Non-blocking (cross-PR). Legacy lots need one shared definition.** The spec (ST9) and #1458 say lots won before the first terms keep 30 days free and are never charged. `collectByPolicyFor(freeStorageDays)` (`packages/domain/src/collection-storage.ts:22-27`) keeps today's behaviour: the place's `free_storage_days`, else 30. Both are fine for this PR. PR 3 has to choose one rule for lots whose `storage_terms_id` is null, because switching from the place value to 30 changes deadlines that buyers have already seen. A `LEGACY_STORAGE_TERMS` constant here (30 days, calendar days, rate 0, large band off, fee 0) would let PR 3 send legacy lots through `calculateStorageCharge`.

7. **Non-blocking (fit with #1458).** The domain names are `StorageTerms.dayCount: StorageDayCount`. The repository type in #1458 is `StorageTermsRecord.countMode: StorageCountMode`, with the same `"calendar" | "working"` values. `@auction/persistence` already depends on `@auction/domain`. Once this PR merges, #1458 (or PR 3) should import `StorageDayCount` and use one field name, so the mapping is not repeated. All other fields line up: `freeDays`, `standardDailyPence`, `largeDailyPence | null`, `handlingFeePence`, `effectiveFrom` (`YYYY-MM-DD`), and the band from `lot.storage_large`.

8. **Nit.** `packages/domain/src/collection-calendar.ts:158`: the doc comment has a stray "X" and a broken sentence ("the place is open, X / or none of the closures").

9. **Nit.** `calculateStorageCharge` trusts its inputs: negative or fractional pence and days are not rejected. The database checks in #1458 cover stored values. A guard (or a branded integer type) would stop a bad API value from reaching the calculator.

## Checked and correct

- **Spec rules.** ST3 (14 days from the London day payment clears, as data), ST4 (calendar or working days, and a deadline on a closed day moves to the next open day, Christmas and Boxing Day substitute included), ST5 (paused days are not counted toward the free period, the extension or charges), ST6 (per lot per calendar day, weekends charged), ST7 (large band, with the standard rate when the band is off), ST8 (handling fee once), ST11 (charging-off wording kept after the day) and ST15 (soon is 7 days ahead).
- **Dates and money.** London dates are used throughout. `storageClearedOn` uses `londonDateKey`, and day arithmetic works on date keys, so DST changes have no effect (tests cover both clock changes). All amounts are integer pence.
- **Collect-by unchanged.** The existing `collectBy`, reminder and purchase notice results do not change without a calendar.

## Verification

- `pnpm install --frozen-lockfile`, then `pnpm -r --filter './packages/**' build`: OK.
- Domain: `storage-terms`, `collection-storage` and `collection-calendar` tests pass (116). Domain typecheck passes.
- API: typecheck passes, and the `organisation-buying` tests pass (191). Worker: typecheck passes, and the collect-by and can-book tests pass (32). Biome is clean on the changed paths.
- Probes against the built package confirmed the Christmas move (25 Dec 2026 moves to 29 Dec), a 10-working-day count over Christmas and New Year (18 Dec 2026 gives 6 Jan 2027), and the cases in items 1, 2 and 4.
- Mutation check: 25 deliberate breaks, all caught by the suite. The breaks covered the open-day move (calculator, `collectBy` and `nextOpenDay`), the first charged day, the fee (always charged or charged per day), pauses (charges, working-day count, calendar count, extension, both range ends), the waiver (amount and state), the charging boundary, an exclusive `asOf`, the large fallback, band ignored, soon lead, extended state, a UTC day instead of the London day, pence formatting, pound rounding, slack ignored, and `collectByPolicyFor` ignoring the place's days.
- Merged with #1458 locally: no conflicts. Packages build, and `persistence`, `api` and `worker` typecheck pass.
- CI: everything passes except `api vitest (2/2)`. All 380 test files passed, but Vitest reported one unhandled `57P01 terminating connection due to administrator command` error from a temporary database being dropped during teardown. This PR changes no database code, and the same API tests pass locally. Re-run the job.

## Merge order

The two PRs are independent: no shared files, a clean merge, and #1458 does not import the domain types. Merge **#1457 first**. It ships the approved spec that #1458 links to and carries no migration risk. Merge #1458 after its blocking items are fixed. PR 3 then joins them through the `StorageTerms` and `StorageTermsRecord` mapping (item 7).
