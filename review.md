Verdict: SHIP

# Final recheck of #1457: storage terms 1/7, domain rules and the next-open-day collect-by rule

Rechecked head `901fb8d5` ("Merge main into storage-terms-domain"). The head has not changed since 2026-11-15 20:21 UTC. Main was at `2504b5e2`, and #1459 (`a58bff02`) is in main. Nothing blocks the merge. The earlier non-blocking items 1 to 4, 6, 7 and 9 are still open. They are listed again below so PRs 3 to 5 can pick them up. Earlier items 5 and 8 are resolved.

## Findings

1. **Non-blocking (still open from the earlier review).** The charging notice does not add up when a handling fee is set. `packages/domain/src/storage-terms.ts:240` prints `{amount} so far ({n} days at {rate})`, but `amountPence` includes the handling fee (`:140-142`). With a £5 fee and 3 days at £3, the notice reads "£14.00 so far (3 days at £3 a day)". The fee is £0 today. Name the fee in the notice, and add a test.
2. **Non-blocking (still open).** The state is `charging` while £0.00 is owed. `storage-terms.ts:115` returns `charging` once `asOf > collectBy`, even when every day since then is paused or the rate is 0. The notice then reads "£0.00 so far (0 days …)". At a zero rate, the upcoming copy at `:254` reads "£0 a day after that".
3. **Non-blocking (still open; a question for the product owner).** While charging is off, the upcoming and soon notices hide the rate (`storage-terms.ts:249`, `:254`). Spec ST11 says buyers still see the terms. Confirm the wording, then rename the test that says the copy "reads as before".
4. **Non-blocking (still open).** An extension hides the "soon" warning. `storage-terms.ts:116` checks `extended` before `soon`, and the 7-day lead (`:118`) compares against `terms.freeDays` without the extension.
5. **Non-blocking (still open; for PR 3).** Lots won before the first terms need one rule. ST9 says they get 30 days free. `collectByPolicyFor` (`packages/domain/src/collection-storage.ts:22-27`) keeps today's behaviour: the place's `free_storage_days`, else 30. The doc comment at `:18-21` calls that value the 30 days "of a place with no storage terms", but a place without terms that has the old column set gets its own value. Today's deadlines do not change, so this is right for this PR. PR 3 should choose the rule for lots whose `storage_terms_id` is null, and could add a `LEGACY_STORAGE_TERMS` constant so those lots go through `calculateStorageCharge`.
6. **Non-blocking (still open; fit with #1458).** The field is `StorageTerms.dayCount: StorageDayCount` here and `StorageTermsRecord.countMode: StorageCountMode` in #1458. Use one type and one field name.
7. **Nit (still open).** `calculateStorageCharge` does not reject negative or fractional pence and day counts. `money()` (`storage-terms.ts:154-162`) uses `Math.floor` and `%`, so a negative or fractional value formats wrongly. Values are integers today, so totals need no rounding. A guard at the API edge in PR 2 or 3 would keep it that way.
8. **Nit (new).** `nextOpenDay` gives up after 60 days (`MAX_OPEN_DAY_LOOKAHEAD_DAYS`) and returns the closed day. The storage walk allows up to 1000 days (`MAX_WALK_DAYS`, `storage-terms.ts:75`). So when a place is closed for more than 60 days, charges start the day after a closed day. Main's `collectBy` does the same, so the two stay in step. Mention it in the runbook when closures are entered.

Resolved since the earlier review:
- The reminder query now widens its range by the look-ahead (`apps/worker/src/repositories/drizzle-collect-by.reader.ts:54,61`, from #1459). This was earlier item 5.
- The stray "X" in the doc comment was removed along with the duplicate function. This was earlier item 8.

## Checked and correct

- **One next-open-day rule.** The PR's own `nextOpenDay`, look-ahead constant, calendar type and `slackDays` are gone. `storage-terms.ts:1,109` imports main's `nextOpenDay` (`collection-calendar.ts:174`), and `collectBy` uses the same function. `grep` finds only one definition. The shared 60-day look-ahead has a boundary test (`collection-calendar.test.ts:372-379`).
- **Charge calculator.** It is pure and covers:
  - calendar and working days (`:106-108`)
  - the London day payment cleared (`storageClearedOn` uses `londonDateKey`, so DST changes have no effect; tests cover both clock changes)
  - pauses (open check, dispute, owed shipping quote), skipped in the free period, the extension and the charges
  - the standard and large bands, with the standard rate when the large band is off
  - a handling fee charged once
  - extension and waiver
  - money in integer pence (day count × integer rate + fee, with no division, so nothing to round), and `Math.floor` for formatting
- **No I/O in domain code.** `storage-terms.ts` imports only domain modules. It reads no clock (`asOf` and `now` are inputs), no store and no `process`.
- **`DEFAULT_COLLECT_BY_POLICY` reads.** All reads in `apps/` are replaced by `collectByPolicyFor`: `purchase-view.ts:170`, `collect-by-notices.ts:36-41` and `collection-collect-by-reminders.ts:43-48`. The remaining reads are the default parameter in the domain itself, the domain tests, and `packages/persistence/src/repositories/drizzle-workspace-buying.readers.ts:390`, which already falls back the same way and is outside this PR.
- **Attribution.** No commit message on the branch and nothing in the PR text has Co-Authored-By, Claude-Session or generated-by lines.

## Verification

- `corepack enable`, `pnpm install --frozen-lockfile` and `pnpm -r --filter './packages/**' build` all pass.
- Tests:
  - Domain: `storage-terms`, `collection-storage`, `collection-calendar` and `collection-collector`, 139 passed.
  - API: `organisation-buying`, 193 passed (7 integration tests skipped with no database).
  - Worker: `collect-by-notices` 17 and `collection-collect-by-reminders` 12 passed. The 17 reader integration tests were skipped with no database.
- Typecheck passes for domain, persistence, API and worker. `biome check` on the changed files is clean, and so are `lint:layers`, `lint:deps` and `lint:datetime`.
- Mutation re-run: 7 breaks, and the suite caught each one:
  - the open-day move removed (5 tests fail)
  - paused days charged (1)
  - the handling fee charged per day (1)
  - the UTC day used instead of the London day (1)
  - `collectByPolicyFor` ignoring the place's days (1)
  - the large rate replaced by the standard rate (2)
  - working days counted as calendar days (2)
- Merges cleanly with current main (`git merge-tree`). GitHub reports the PR as mergeable (`clean`).
- CI on `901fb8d5`: 37 check runs. 34 passed, and 3 were skipped by their path filters (`browser-gates`, `art-browser-gates`, `shop-v1-phase-smoke`). None failed.
