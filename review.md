Verdict: FIX FIRST

# Review of PR #1459: collect-by on the next open day, venue phone on collection pages and emails

Reviewed head `97ecf37e` (branch `collect-by-open-day-venue-contact`) against `origin/main` `70ceb4c4`.
Owner decisions checked against: CB-Q2 (next open day) and GAP-15 (venue phone plus collections email, email alone when there is no phone).

## What was run

- `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`: pass.
- Throwaway Postgres 16 (port 55432), `db:migrate` and `db:roles` applied.
- Affected tests, `--maxWorkers=2`, all pass: domain calendar and storage (64), email collection render (24), worker collect-by notices, can-book and reader integration (43; the integration suite ran against the database and was not skipped), persistence collect-by integration (5), API collection visits and organisation buying (263), web collect lib and components (55).
- `turbo typecheck` for domain, types, persistence, email, worker, api, web: 41/41 pass.
- `biome check` on the 38 changed files: clean. `pnpm lint:client-copy`: pass.
- `node scripts/check-layers.mjs`: **fails** (see finding 2). It also fails in CI.
- CI on the head commit: `static-checks` **failed**; 32 checks passed, 1 skipped, 5 still running when this was written (build, test, browser-gates, account-browser-gates, shop-v1-phase-smoke admin-routes).

## Findings

1. **BLOCKING: the worker's database role cannot read the calendar, so every storage reminder sweep fails.**
   `apps/worker/src/repositories/drizzle-collect-by.reader.ts:65` calls `withCalendars`, which calls `readCollectByCalendars` (`packages/persistence/src/repositories/drizzle-collect-by-calendars.ts:37`), which calls `DrizzleCollectionPlaceRepository.readCalendarFacts`. That method writes before it reads: `this.ensure(venueId)` (`packages/persistence/src/repositories/drizzle-collection-place.repository.ts:132`) runs `insert into collection_place ... on conflict do nothing`, and `ensureBankHolidays` (line 133) inserts any missing bank holidays. `worker_app` has SELECT only on `collection_place`, `collection_weekly_hours` and `collection_exception` (`packages/db/src/migrate-roles.ts:702`, `WORKER_READ_TABLES`). Postgres checks INSERT permission even when the conflict clause would skip the row.
   Reproduced on the throwaway database after `db:roles`: calling `readCollectByCalendars` as `worker_app` fails with `permission denied for table collection_place`. `storedLotsDue` is called outside the per-group try/catch (`apps/worker/src/jobs/collection-collect-by-reminders.ts:44`), so the job throws on every run and no collect-by reminders are sent. The integration tests pass only because they connect as the owner role.
   Fix: give the worker (and the purchases reader) a read-only calendar read. It should not call `ensure` or `ensureBankHolidays`, should skip a venue that has no `collection_place`, and should take bank holidays from the stored rows, adding `bankHolidayClosures` from the domain for any year with no stored rows yet so the result does not depend on the booking page having run. Granting the worker INSERT is the wrong fix. Add a role-contract test that runs the reader as `worker_app` (the `worker-role-contract` CI job is the place for it).

2. **BLOCKING: the layer check fails (CI `static-checks` is red).**
   `apps/worker/src/repositories/drizzle-collect-by.reader.ts:17` imports `@auction/persistence/repositories` outside `container/**`. `scripts/check-layers.mjs` reports: "`@auction/persistence/repositories` outside container/tests/integration support. Use subpath imports: interfaces for ports, lib for mappers/helpers, repositories only in container/**." Reproduced locally. Fix it together with finding 1: inject a calendar reader port through the worker container, or move the read-only calendar helper to `@auction/persistence/lib`.

3. Non-blocking: queued emails rendered after deploy can print "Email undefined".
   `contactEmail` is a new required var (`packages/email/src/templates/types/collection.ts:146,166`). The outbox renders from stored vars at send time (`apps/worker/src/infrastructure/postmark-email.sender.ts:74`), so a `collection-collect-by` or `collection-can-book` row queued before deploy and sent after it renders "Questions? Email undefined." Make `collectionContactLine` (`packages/email/src/templates/collection-contact.ts:5`) fall back to `GALLERY_CONTACT.email` when `contactEmail` is missing or blank, and add a render test for vars without it.

4. Non-blocking: two mutations survive, so two parts of the widened window are untested.
   - Removing `+ MAX_OPEN_DAY_LOOKAHEAD_DAYS` from the indexed lower bound (`drizzle-collect-by.reader.ts:61`) passes every test. No test covers a lot at a place with the longest free period whose deadline moved forward.
   - Setting the calendar range's look-ahead to 0 (`drizzle-collect-by-calendars.ts:20`) passes every test. The range then ends on the counted day, so a closure or bank holiday starting after it is never read. For example: counted day Saturday, staff closure Monday to Wednesday, the reminder says Monday. Add an integration case with a staff closure that starts after the counted day, for both the reader and the purchase facts reader.
   These mutations were killed: `nextOpenDay` returning its input; look-ahead 60 changed to 3; fallback returning the last day checked; `collectBy` ignoring the calendar; the worker dropping the calendar; the SQL `first` bound not widened; the purchase view dropping the calendar; and a placeholder number put into the worker contact, the web no-phone copy or the email no-phone copy.

5. Non-blocking: the purchases page reads a calendar range across the account's whole history.
   `collectByCalendarsFor` (`packages/persistence/src/repositories/drizzle-workspace-buying.readers.ts:362`) adds every cleared lot at an online-booking place, including lots collected or delivered years ago. The range then runs from the oldest counted day, and the sale-day and exception queries cover all of it, on every purchases page load. It also writes (`ensure`, bank holidays) on a GET; finding 1's read-only path fixes that too. Only count lots that `awaitsCollection` would keep, or at least only lots whose fulfilment is still open.

6. Non-blocking: a one-off extra reminder at rollout and whenever a deadline changes.
   The idempotency key includes `collectBy` (`apps/worker/src/services/collect-by-notices.ts`, `collectByKeyPrefix`). A lot already sent a lead reminder for a Saturday deadline will, after deploy, be sent another lead reminder for the Monday deadline. The same happens when staff add a closure on a deadline day. If a Saturday "day" reminder has already gone out, a "lead" reminder for Monday follows it. This is defensible because the date did change, but the email does not say so. Either accept it and note it in the PR, or add "Your collect-by date has moved to …" wording. The existing idempotency rules are otherwise unchanged: the same lot set, kind and date never sends twice, and failed rows still retry once per London day.

7. Non-blocking: a part-day staff closure that covers all opening hours counts as open.
   `nextOpenDay` (`packages/domain/src/collection-calendar.ts:163`) accepts `plan(day).kind === "open"`. A staff closure entered as 10:00–19:00 rather than as a whole day leaves the day "open" with `closedRanges` covering every opening range, so a deadline can land on it. This is an edge case. Count a day as open only if some opening range is not covered by its closed ranges, or have the staff form store a full-hours closure as a whole-day closure.

8. Note (not a defect): the placeholder number remains elsewhere.
   A grep for `800 208` / `8002084800` / `GALLERY_CONTACT.phone` finds no use in collection pages or collection emails; the only remaining collection mentions are the new negative tests. The number is still in `packages/branding/src/gallery-contact.ts:61` and `packages/branding/src/site.ts:23`. It is used by the art enquiry email, the shop help and delivery copy (`apps/shop/src/lib/delivery/delivery-glance.ts:114,147`), the subject export summary and the legal pages in `packages/marketing-ui/src/legal/london-art-exchange/*`. GAP-15 only covers collection pages and emails, so this is out of scope, but if the number is a placeholder site-wide it needs its own ticket.

9. Checked and fine.
   - London time and DST: `londonDateKey` in the domain and `at time zone 'Europe/London'` in SQL agree. Payments cleared at 23:30Z on 24 Oct 2026 (00:30 BST on 25 Oct) and on 28/29 Mar 2026 land on the London day. A deadline of Sat 1 Aug 2026 moves to Mon 3 Aug. Christmas 2026 moves to Tue 29 Dec.
   - Reminder window: deadline `D = nextOpenDay(counted)` is between `counted` and `counted + 60`. A reminder is due on `today` only if `D - lead <= today <= D`, so payment cleared between `today - free - 60` and `today - free + lead`. These are exactly the SQL `first`/`last` bounds, and `collectByReminderFor` then picks the exact lots. Nothing is missed or added (given finding 1 is fixed).
   - One date everywhere: the purchase notice, `collectByReminderFor` and the email's `collectByLabel` all come from `collectBy(..., calendar)`, and the worker and API build the same calendar (weekly hours, bank holidays, staff closures, sale days) over the same `counted .. counted + 60` range.
   - The 60-day fallback keeps the counted date (checked with a closure from 1 Dec 2026 to 29 Jan 2027).
   - Copy: the web strings are in `apps/web/src/lib/collect/collect-copy.ts:105`, and the email line is in `packages/email/src/templates/collection-contact.ts`, alongside the other collection template copy. `lint:client-copy` passes.
   - UI: the only page change is the text of the existing `visit-card.tsx` paragraph (`text-lax-13 text-lax-muted`, tokens set for both themes). No new layout or fixed widths, so light, dark and 375px are unaffected. A `tel:` link for the phone would help phone users (optional).
   - Route JS: one nullable zod field and a copy branch; no new client imports, so no budget impact expected.

## Overlap with PR #1457 (storage-terms-domain)

Both PRs add `nextOpenDay(calendar, date)` to `packages/domain/src/collection-calendar.ts` with the same signature and loop. Both add `type CollectByCalendar = Pick<CollectionCalendar, "plan">` and an optional `calendar` argument to `collectBy`, `collectByReminderFor` and `purchaseCollectBy` in `collection-storage.ts`. They will conflict on those lines, on `index.ts`, on `purchase-view.ts` and on `collect-by-notices.ts`.

Differences:

- #1459 looks ahead 60 days through the exported `MAX_OPEN_DAY_LOOKAHEAD_DAYS`. The worker SQL window and both calendar-range readers use the same constant, so the bound is in one place. #1457 uses a private 366-day constant, and its doc comment has a stray "X" (`packages/domain/src/collection-calendar.ts:158` on that branch).
- #1459 connects the calendar end to end (worker, API purchase view, persistence). #1457 only changes the domain; it passes no calendar to the reminder or purchase notice.
- #1457 adds `collectByPolicyFor(freeStorageDays)` and a `slackDays` argument on `collectByClearedRange`. Both are useful and not duplicated in #1459.

Recommendation: #1459's `nextOpenDay`, `MAX_OPEN_DAY_LOOKAHEAD_DAYS` and `CollectByCalendar` should be the single shared implementation. #1459 should merge first as the owner of CB-Q2, once findings 1 and 2 are fixed. #1457 should then rebase and:

- delete its own `nextOpenDay`, `MAX_LOOKAHEAD_DAYS`, `CollectByCalendar` and its `calendar` parameters on `collectBy`/`collectByReminderFor`/`purchaseCollectBy`, keeping #1459's;
- import `nextOpenDay` for `storage-terms.ts` `collectByDay`, and drop or adapt its "gives up after a year" test to the 60-day bound (any longer look-ahead must change the shared constant, which also widens the worker scan);
- keep `collectByPolicyFor`, and apply it at #1459's call sites in `purchase-view.ts` and `collect-by-notices.ts`;
- use `collectByClearedRange(today, policy, MAX_OPEN_DAY_LOOKAHEAD_DAYS)` if it wants the worker window to come from the domain instead of the reader's hand-written SQL bound.

#1457's version is not clearly better: it is the same loop with a longer, private bound and no wiring.
