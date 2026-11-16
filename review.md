Verdict: FIX FIRST

# Recheck of PR #1489 "Storage terms 5/7: reminders and staff follow-up"

Rechecked head `94f66f5e` (review fixes in `5f4fdf25`, screenshots in `94f66f5e`, main merged in at `70d216ea`) against `docs/design/storage-terms.md` on main (`f1e70f47`) and the previous review (`8d1196e6` on this branch). Review only. The PR branch was not changed.

Paths are on the PR head (`git show 94f66f5e:<path>`).

The previous blocking finding is fixed, and so are all eight code findings. One new problem stops it: a test the fix commit changed now fails in CI, so the required `worker-role-contract` job and `ci-result` are red.

## Blocking

1. **CI is red: the worker reader's role integration test inserts storage terms that break a check constraint.**
   - `apps/worker/src/repositories/drizzle-collect-by.reader.role.integration.test.ts:65-68` inserts `collection_storage_terms.free_days = MAX_FREE_STORAGE_DAYS`. That constant is 365 (`packages/domain/src/collection-storage.ts:58`), a limit on the old place column. The terms table allows 0 to 90 (`packages/db/src/schema/collection-storage.ts:47`, `collection_storage_terms_free_days_check`).
   - The comment on the line above (`:63-64`) says "30 days calendar". The value does not match it.
   - CI run 43818123834, job `worker-role-contract` (133135397432): `beforeAll` fails with `23514 ... collection_storage_terms_free_days_check`, then `afterAll` fails with `invalid input syntax for type uuid: ""`, because `lotId` was never set. Result: 1 file failed, 13 passed. `ci-result` fails as a result.
   - Impact: the test that was added to prove the sweep reads the storage tables as `worker_app` (non-blocking 4 of the last review) does not run. The PR body says "integration tests ... CI runs them", but CI does not pass them.
   - Fix: use `30` in the terms insert. The lot then keeps the 30-day calendar deadline the assertions expect, Thu 20 Mar 2031. Re-run CI.
   - The other half of that fix works. `worker-role-contract.integration.test.ts` passed its 153 tests in the same job, including the `withAccountLock` probe (`:236`) and the seeded waiting lot with `storage_terms_id` (`:369-386`, `free_days` 14).

## Non-blocking

1. **The cut-list count still disagrees in two places.**
   - At the top of the list, `overdue-lots.tsx:86` still prints `C.section.count(rows.length)`. In `list-charging-on-more-*`, the page reads "2 lots past collect-by", then the notice reads "340 lots past collect-by, showing the 2 longest over". Use `overdue.total` there, or drop the line when `more` is true.
   - `total` is `over.length` (`collection-storage-follow-up.service.ts:118`), counted from at most `WAITING_LOTS_READ_LIMIT` (1,000) waiting lots. A place with more than 1,000 waiting lots still undercounts. When the cut comes only from that read limit, the notice can read "150 lots …, showing the 150 longest over". This is rare. Either count in SQL or say "at least".
2. **The dialog screenshots were captured mid-animation.**
   - In `extend-errors-*` and `waive-errors-*`, at both widths and in both themes, the dialog is still fading in (`data-lax-motion="dialog"`, `packages/ui/src/components/ui/dialog.tsx:44`). The list shows through it, and the 375 px dialog text overlaps the rows.
   - At 375 px the scrim covers only the first viewport of the full-page capture.
   - The product is fine. The dialogs pass their tests (focus, summary versus inline errors). The images are just not usable as review evidence. Re-take them with `reducedMotion: "reduce"`, or wait for the animation to finish, and capture the viewport only.
3. **Clock in the calendar range.** `waiting-lot-storage.ts:99` uses `londonDateKey(new Date())` for the pause end rather than the caller's day. It is harmless in the sweep and the staff tab, which run on today. A sweep re-run for a past day would use a slightly different range. A `today` parameter would make it pure.
4. **Charging-on wording still needs sign-off before PR 6.**
   - With charging on, the reminders say "storage is charged at the daily rate shown below" (`storage-reminder-copy.ts:51,64`), and the 14-day email says "storage has been charged since".
   - The doc correctly lists these under "Wording that is not in the approved list above" (`docs/design/storage-terms.md:76,87-92`), not as approved.
   - Nobody receives them until Finance switches charging on, but they need approval before PR 6.

## Verified

### Blocking finding from the last review: fixed

- `collectByReminderCopy` takes `chargingOn` (`packages/email/src/storage-reminder-copy.ts:39`). The "is charged" sentences need `withRates && chargingOn` (`:42`, used at `:50` and `:63`).
- With charging off, the lead and day paragraphs are byte-for-byte main's approved sentences:
  - "After that, storage charges may apply under our storage policy.";
  - "Storage charges may apply from tomorrow under our storage policy.";
  - compare `git show origin/main:packages/email/src/templates/collection-collect-by.tsx:49-50`.
- The worker passes `chargingOn: group.chargingOn` on lead and day emails (`apps/worker/src/services/collect-by-notices.ts:200`).
- The template treats a missing variable as off (`templates/collection-collect-by.tsx:19`, `chargingOn: vars.chargingOn === true`; type `templates/types/collection.ts:147`). Rows already queued without the variable therefore render the "may apply" wording.
- The rates still list with charging off ("Free until …, then £3 a day …"). That matches ST11 (buyers see terms) and the purchase notice.
- Tests:
  - Worker: `collect-by-notices.test.ts:275-292`, lead and day, charging on and off. It checks `chargingOn` and `lotRates` on the queued email.
  - Email: `collection-emails.render.test.ts:252-271`, lead and day with charging off and with the variable missing. It asserts "may apply" and never "storage is charged", plus the exact sentences. The existing tests with `chargingOn: true` in `base` cover charging on.
- Design doc (`storage-terms.md:87-89`): it records the charging-off case as the approved "may apply" sentences and says no email says storage is charged. The charging-on sentences sit in the doc's "not in the approved list" section (non-blocking 4).
- ST11 holds: with charging off, nothing says charges are made, before, on or after the day (`storage-reminder-copy.ts:71-75`, unchanged).

### Non-blocking fixes from the last review

| # | Finding | Status | Evidence |
|---|---|---|---|
| 1 | Second money formatter | Fixed | `formatPence` removed. `not-collected.vm.ts:1,35` uses the domain `formatStoragePence`, and the test checks it (`not-collected.vm.test.ts:62-65`). The file header is now true (`not-collected-copy.ts:1-6`). |
| 2 | Fixed numbers in copy | Fixed | `not-collected-copy.ts:42` uses `STORAGE_FOLLOW_UP_DAYS`; `:54` and `:61` use `MAX_STORAGE_EXTENSION_DAYS`. No literal 60 or 30 is left in the staff copy. |
| 3 | "Waiting" rule twice in SQL | Fixed | One builder, `packages/persistence/src/lib/lot-awaits-collection.ts:12-28`, used by `drizzle-collection-storage.repository.ts:433` and `apps/worker/src/repositories/drizzle-collect-by.reader.ts:102`. The conditions are identical to both old copies. The worker reader's agreement test now covers both. |
| 4 | Role probe misses new tables | Fixed in `worker-role-contract` (passes in CI). The reader role test is broken (blocking 1). | `worker-role-contract.integration.test.ts:235-241,369-386` |
| 5 | Calendar too short when paused | Fixed | `waiting-lot-storage.ts:45-53,103-107` adds the inclusive paused days from `storageQuotePauses` to the reach. Extending the range can only add calendar rows, so it cannot change a price. |
| 6 | Concurrent sweeps | Fixed | See "The account lock" below. |
| 7a | Cut-list title | Partly fixed | The notice title uses `total` (`overdue-lots.tsx:93`, test `overdue-lots.test.tsx:192-197`). The count line above it does not (non-blocking 1). |
| 7b | Waive copy with charging off | Fixed | `not-collected-copy.ts:76-79`. `overdue-lots.tsx:72` passes `chargingOn`. Tests cover on and off (`overdue-lots.test.tsx:208-221`). |
| 7c | 1,000-lot cap on extend and waive | Fixed | `find` passes `lotId` (`collection-storage-follow-up.service.ts:131`), and the repository adds `eq(lot.id, lotId)` to the venue-scoped query (`drizzle-collection-storage.repository.ts:434`). A lot at another venue still returns 404, so there is no cross-venue reach. The test with 206 lots shows the direct lookup and `total` (`service.test.ts:52-72`). |
| 8 | Second logger | Fixed | `apps/api/src/container.ts:550` creates one `appLog`, reused at `:561,582,601`. |

### The account lock

- `drizzle-collect-by.reader.ts:17-33` runs `pg_try_advisory_xact_lock(hashtextextended('collect-by:'||id, 0))` inside a transaction. The work runs inside it and returns `{ ran: false }` when another sweep holds the lock.
- The lock is transaction-scoped, so it is released at commit or rollback, and on a crash with the connection. It never leaks across pooled sessions, as a session lock could.
- The work queues on its own pooled connections, which commit straight away. A second sweep therefore takes the lock only after the first sweep's rows are visible, so its outbox check sees them. This closes the race the last review described.
- The cost is one pooled connection per account while the work runs, sequentially, against node-postgres's default pool of 10. There is no deadlock.
- A busy account is skipped and logged without personal data (`collection-collect-by-reminders.ts:85-86`, `legalEntityId` only). The sweep holding the lock covers it.
- Unit tests check the lock is taken per account (`collection-collect-by-reminders.test.ts:108`) and that the skip path works (`:219`). The role contract runs the lock as `worker_app` (CI, passed).

### No regressions

- **Idempotency keys unchanged.**
  - `5f4fdf25` adds only `chargingOn` to the email variables in `collect-by-notices.ts` (+1 line).
  - The keys are still `collectByKeyPrefix` + `lotSetStamp` (`:104,143,190`) and do not depend on the variables.
  - The outbox check before queueing is unchanged, so emails already sent are not re-sent.
- **Capability checks and step-up unchanged.**
  - Nothing in `apps/api/src/routes/admin/collection-storage.routes.ts` or the dangerous-actions registry changed since `75d9fb14`.
  - Extend is still Fulfilment or Admin. Waive is still Finance or Admin, with step-up.
- **Audit unchanged.**
  - The extend and waive write paths and their audit rows (who, when, reason, before/after) are untouched.
  - The only service change is how the lot is found.
- **API contract.**
  - `total` is added to `StaffOverdueLots` (`packages/types/src/collection-storage.ts:117`) and to the web reader's zod schema (`admin-collection-overdue.reader.ts:13`), and the fixtures are updated.
  - The web reader requires `total`. If web ships before api, the tab load fails. Deploy together, or api first.

### Screenshots (`docs/design/screenshots/storage-not-collected/`, opened myself)

All eight states are there: list, list-charging-on-more, empty, loading, error, read-only, extend-errors and waive-errors. Each is at 1440 and 375, light and dark: 32 PNGs.

- **List with charging off.** The "Charging is off" notice is present. Each row has "{n} days over", the Follow up flag at 66 days, "Collect by Thu 10 Sep · A private buyer", "Storage so far £396.00" with the domain sentence, and the band. The capped Extend has its reason as text.
- **375 px.** Rows stack, buttons wrap under the facts, and there is no horizontal overflow.
- **Dark theme.** Tokens hold, and the notice and badge contrast reads well.
- **Charging on, cut list.** The notice shows the true total (but see non-blocking 1).
- **Waive with charging off.** It shows the new "is what would be due … Nothing is charged while charging is off" copy.
- **Extend.** It shows the "2 things to fix" summary plus the inline errors.
- The dialog images were captured mid-animation (non-blocking 2).

### Tests run locally (PR head `94f66f5e`)

| Check | Result |
|---|---|
| Typecheck: api, worker, web, persistence, email, domain | 40/40 turbo tasks passed |
| Domain | 3922 passed, 1 skipped |
| Email | 255 passed |
| Persistence | 265 passed, integration skipped (no DB) |
| Worker | 1892 passed. 1 file fails to load: `finance/accounting/bid-refunds-books.integration.test.ts`, "Invalid URL" (missing DB env). It is untouched by this PR and already known. |
| API | 7547 passed, 323 skipped (integration, no DB) |
| Web (admin collections components and lib, http readers, app/admin, admin actions) | 398 + 175 passed |

### CI on `94f66f5e`

- Failed: `worker-role-contract`, and `ci-result` because of it (blocking 1).
- `art-browser-gates` was skipped by design.
- Everything else passed: `test` (integration), `build`, `static-checks`, `browser-gates`, `account-browser-gates`, api vitest 1/2 and 2/2, web vitest 1–8/8, shop-api vitest 1–4/4, `auth-role-contract`, `ui-chromium`, the identity checks, the shop smoke jobs and docker-images.
