Verdict: FIX FIRST

# Review of PR #1489 "Storage terms 5/7: reminders and staff follow-up"

Reviewed head `75d9fb14` against `docs/design/storage-terms.md` on main (`5569ca0e`): ST5, ST9–ST12, ST15, ST16, the Not collected tab, the buyer copy and the build notes for PRs 4 and 5. Review only. The PR branch was not changed.

Paths in this file are on the PR head (`git show 75d9fb14:<path>`).

## Blocking

1. **The reminder emails before and on the collect-by day say storage "is charged" while "Raise storage invoices" is off (ST11).**
   - `packages/email/src/storage-reminder-copy.ts:44`: on the day, "From tomorrow, storage is charged at the daily rate shown below, under our storage policy."
   - `packages/email/src/storage-reminder-copy.ts:57`: a week before, "After that, storage is charged at the daily rate shown below, under our storage policy."
   - What chooses the wording: `withRates` (`storage-reminder-copy.ts:33`), which is true whenever a lot's band has a rate. `apps/worker/src/services/collect-by-notices.ts:199-201` builds `lotRates` from `formatStorageRateAfter` and never reads `group.chargingOn`. The charging switch only reaches the emails sent after the day (`collect-by-notices.ts:214-216`).
   - Failure scenario: a place has terms (£3 a day) and charging off, which is the default and today's state everywhere. On the collect-by day the buyer is told charges start tomorrow. The next day they get "Your free storage has ended … storage charges may apply". The first email says they will be billed, which ST11 says must not happen while charging is off ("nothing is billed"), and the two emails contradict each other.
   - The wording is not in the approved buyer copy. The PR adds it to the design doc itself (`docs/design/storage-terms.md:87-88`), so the doc now records the problem as approved.
   - Fix:
     - pass `chargingOn` into `collectByReminderCopy`;
     - while it is off, keep today's "storage charges may apply" sentences. Listing each work's rate can stay, because the purchase notice shows the rate with charging off too;
     - update the doc lines to match;
     - add a worker test and an email render test for "charging off, terms with a rate, lead and day".

## Non-blocking

1. **A second money formatter in the web app.**
   - `apps/web/src/lib/admin/collections/not-collected.vm.ts:9` (`formatPence`) copies the domain's `formatStoragePence` (`packages/domain/src/storage-terms.ts:420`), which this PR exports for this purpose.
   - The file header in `not-collected-copy.ts:3` says "Money is formatted by the domain storage formatter", which is not true.
   - Use the domain export.
2. **Fixed numbers in the staff copy.** `not-collected-copy.ts:36` ("60 days"), `:48` and `:54` ("30") repeat `STORAGE_FOLLOW_UP_DAYS` and `MAX_STORAGE_EXTENSION_DAYS`. Build the strings from the constants so they cannot drift.
3. **The rule for "waiting to be collected" now exists twice in SQL.**
   - It is in `packages/persistence/src/repositories/drizzle-collection-storage.repository.ts:449` (`waitingLotsAt`) and in `apps/worker/src/repositories/drizzle-collect-by.reader.ts:107`.
   - Only the worker reader's integration test checks it against the domain's `awaitsCollection`.
   - Share one condition builder, or add the same agreement test for `waitingLotsAt`.
4. **The worker role contract does not exercise the new reads.**
   - The probe `apps/worker/src/container/worker-role-contract.integration.test.ts:223` asks for `today: "2000-01-01"`. That returns no lots, so `readWaitingLotStorage` returns before running any query.
   - The role integration test reaches the extension, waiver, quote and place reads, but its lot has no `storage_terms_id`, so `collection_storage_terms` is never read as `worker_app`.
   - The grant exists (`packages/db/src/migrate-roles.ts:753`), so nothing fails today. The tests would not catch a regression.
5. **The calendar may be too short for a paused lot.**
   - `packages/persistence/src/lib/waiting-lot-storage.ts:44` reads the calendar to `freeDays*2 + extensionDays`.
   - A shipping-quote pause pushes the collect-by day later, and so can a long closure before the next open day. Either can land past that range.
   - This came in with PR 4's reader; PR 5 now shares it with the sweep and the staff tab. Add the paused days to the range.
6. **Concurrent sweeps with different sets of lots.**
   - Idempotency rests on the unique `email_outbox.idempotency_key` (`packages/db/src/schema/email.ts:65`) with `onConflictDoNothing` (`packages/email/src/outbox-service.ts:177`), which is sound for the same set of lots.
   - The key includes a hash of the lot set (`collect-by-notices.ts:129` plus `lotSetStamp`). Two overlapping runs that see different eligible sets (a check closes between their reads) would each send an email.
   - The check-then-enqueue at `apps/worker/src/jobs/collection-collect-by-reminders.ts:66-73` is not locked. The risk is low with one scheduled worker; an advisory lock per account would close it.
7. **Not collected tab details.**
   - When `more` is true, the notice title repeats the shown count (`overdue-lots.tsx:92`), so "200 lots past collect-by" undercounts.
   - The Waive dialog says "£x so far will not be charged" (`not-collected-copy.ts:70`) even while charging is off, when nothing would be charged anyway.
   - `extend`/`waive` read up to 1,000 waiting lots to find one (`collection-storage-follow-up.service.ts:122,136`). A lot beyond that limit returns 404.
8. **Container.** `apps/api/src/container.ts:577` creates a second app logger just for this service. Reuse the container's logger.
9. **No e2e or screenshots in the PR** (its own checklist says so). I rendered the states myself; see Verified.

## Verified

### Reminder timing (ST15)

- `packages/domain/src/storage-follow-up.ts:126-148`:
  - the early reminder from collect-by minus 7 until the day before (`:139`);
  - the reminder on the day only (`:134`);
  - "started" from the day after, for 14 days;
  - a running total every 14 days (`:145`);
  - no totals while charging is off (`:147`);
  - nothing for a waived lot (`:132`).
- I probed it with a scratch test using a weekday-only calendar:
  - The lot cleared at 23:30 UTC on Sat 10 Oct 2026, which is Sun 11 Oct in London.
  - 14 days later is Sun 25 Oct, the day the clocks go back, a closed day. The deadline moved to Mon 26 Oct.
  - The early reminder ran 19–25 Oct, the day reminder on 26 Oct, "started" 27 Oct–9 Nov, total cycle 1 from 10 Nov and cycle 2 from 24 Nov.
  - Spring: payment cleared 16 Mar 2026, deadline 30 Mar after the clocks go forward on 29 Mar, "started" on 31 Mar, cycle 1 on 14 Apr.
  - All London calendar days; `daysBetweenKeys` rounds, so there is no off-by-one from the hour change.
- The sweep starts at 09:00 London (`reminderWindow`). The worker reader limits payment cleared to before the London midnight that ends today (`drizzle-collect-by.reader.ts`, `at time zone 'Europe/London'`).

### Mutation checks on the scheduler

Every mutation was killed: at least one test failed each time.

| Mutation | Domain tests (18) | Worker tests (44) |
|---|---|---|
| Every 14 days changed to 15 | 2 fail | |
| Early window cut to 6 days | 2 fail | |
| Waived guard removed | 1 fail | |
| Totals sent while charging is off | 1 fail | |
| Cycle dropped from the idempotency key | | 3 fail |
| Day reminder dropped | 5 fail | |
| `floor` changed to `ceil` for the cycle | 2 fail | |

### Idempotency

- Each key names the kind, the account, the place, the collect-by day, the cycle (for charge emails), the user id (never an address) and a hash of the lot set.
- The outbox is checked first (`collection-collect-by-reminders.ts:66-72`), and the unique outbox key with `onConflictDoNothing` stops duplicates from retries and repeated runs.
- Earlier "lead" and "day" keys are unchanged, so emails already sent are not re-sent.

### Pauses, extensions and waivers

- One function prices every reader: `lotStorageCharge` with `storageQuotePauses`.
- An extension moves the day, and a new day starts a new key.
- A waived lot gets no email.
- Checks, disputes and refunds still hold emails back through `collectionEligibility`.
- The ST5 gap (checks and disputes do not pause the running total) stays tracked in "Not yet built".

### Billing while charging is off (apart from blocking 1)

- After the day, the email uses only the approved wording, with no figures and no totals.
- The Not collected tab says the amounts are what would be due.
- The Storage tab notice is back to the approved wording (`apps/web/src/lib/admin/collections/storage-copy.ts:16`), as the PR 4 build note required (`docs/design/storage-terms.md:59`).

### One formatter

- `formatStorageRunningTotal` and `formatStorageRateAfter` are taken out of `formatStorageNotice` (`storage-terms.ts:387,408`), not copied, and the purchase notice output is unchanged.
- The buyer page, the worker and the API all use them.

### Emails

- Both templates use the shared `Layout`, `FactCard` and `Button`.
- The wording lives in one copy file.
- Nothing about sale or disposal (ST16); a render test asserts this.

### No personal data in logs

- The logs carry lot, venue and legal entity ids and the error.
- People are keyed by user id, never by email.

### Not collected tab

- Each row shows "{n} days over", "Collect by {date} · buyer", "Storage so far £x", the band, and the follow-up flag at 60 days.
- Extend (Fulfilment):
  - the route requires `operations.fulfilment` (`apps/api/src/routes/admin/collection-storage.routes.ts:112`);
  - days are a whole number from 1 to 30, the body is strict, and a reason is required;
  - the 30-day cap is checked again under a row lock (`drizzle-collection-storage.repository.ts:365`).
- Waive (Finance or Admin):
  - the route uses `requireCollectionStorage` (`:124`) and is registered for step-up (`apps/api/src/middleware/dangerous-staff-actions.ts:211`);
  - a reason is required, and a second waiver is refused.
- The audit records who and when (`StorageChange`), why (the reason), and before/after values: extension days and waived, plus the collect-by day and the amount (`repository.ts:385,413`; `service.ts:159,179`).
- The buyer page reads with `cache: "no-store"`, and the admin action calls `revalidatePath`.

### Staff UI

- Built from the staff-ui kit: `Section`, `Notice`, `EmptyState`, `ErrorState`, `StaffDialog`, `Field`, `FormErrorSummary`, `UnsavedChangesGuard`, `DisabledReason`.
- I rendered every state to HTML through the components with jsdom, compiled `apps/web/src/app/globals.css` with Tailwind, and took 375 px screenshots in light and dark: list with charging off, list with charging on and more lots, read-only, empty, loading skeleton, load error with retry, Extend with 2 errors, and Waive with 1 error.
- No horizontal scroll in any of them (scroll width 375). Rows stack, and tokens hold in both themes.
- The disabled Extend gives its reason as text on the row, not only a tooltip.
- Form errors follow the design:
  - Extend shows the summary plus inline errors at 2 or more (`extend-storage-dialog.tsx:137`), and focuses the field at 1 (`:80`);
  - Waive shows the inline error only and focuses the field (`waive-storage-dialog.tsx:51`).
- The read-only notice appears for read-only viewers (`collections-page.tsx:127`).
- Finance gets the tab without the missed visits.

### Worker DB role

- No migration.
- The reads are covered by existing SELECT-only grants in `WORKER_READ_TABLES` (`migrate-roles.ts:704-766`): `collection_storage_terms`, `collection_storage_extension`, `collection_storage_waiver`, `delivery_quote`, `collection_place`. These are least-privilege grants. See non-blocking 4 on test coverage.

### Tests run locally (PR head)

| Check | Result |
|---|---|
| Typecheck: domain, api, worker, web, persistence, email | 40/40 tasks passed |
| Domain | 3915 passed |
| Persistence | 261 passed, integration skipped (no DB) |
| Email | 254 passed |
| API | 7469 passed |
| Worker | suite exit 0; storage files 51 passed |
| Web (admin collections, actions, http readers) | 566 passed |

### CI

All 41 check runs on `75d9fb14` passed or were skipped by design: `ci-result`, `test` (integration), `worker-role-contract`, `browser-gates`, `build`, `static-checks`, and all vitest shards. `art-browser-gates` was skipped.
