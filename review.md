Verdict: SHIP

# Recheck of PR #1459: collect-by on the next open day, venue phone on collection pages and emails

Head rechecked: `482cbb91` on `collect-by-open-day-venue-contact` (one commit after the first review's `97ecf37e`). The head did not change during the recheck.

Both blocking findings from the first review are fixed. The fixer also took on four of the non-blocking items: the purchases page range, part-day closures, the queued-email fallback and the untested look-ahead. No new blocking problem was found. The commit messages on the PR carry no attribution trailers.

## Findings

1. Fixed (was BLOCKING): the worker role can read the collection calendar.
   - `readCollectByCalendars` (`packages/persistence/src/lib/collect-by-calendars.ts:44`) now only reads:
     - a venue with no `collection_place` is skipped (line 55);
     - bank holidays come from the stored rows, plus `bankHolidayClosures` for any year that has none stored (line 102). A removed holiday's row still counts as stored, so it stays removed.
   - The booking page's `ensureBankHolidays` stores whole years at a time, so the read-only fallback agrees with what the booking page would store.
   - The new `apps/worker/src/repositories/drizzle-collect-by.reader.role.integration.test.ts` runs `DrizzleCollectByReader.storedLotsDue` and `readCollectByCalendars` as `worker_app` against real Postgres 16, after `db:migrate`, the probe seed and `db:roles`. It is added to the `worker-role-contract` job (`.github/workflows/ci.yml:830`). Locally the four role-contract files pass (488 tests). CI `worker-role-contract` is green.
   - Mutation: putting a write back (`insert into collection_place … on conflict do nothing` before the read) makes two of the three role tests fail.

2. Fixed (was BLOCKING): `apps/worker/src/repositories/drizzle-collect-by.reader.ts:17` now imports from `@auction/persistence/lib`.
   - `node scripts/check-layers.mjs`, `lint:layers`, `lint:deps` and `lint:client-copy` pass locally.
   - CI `static-checks` is green on this head.

3. Fixed: the look-ahead is now tested. Each mutation below fails the role test:
   - removing `MAX_OPEN_DAY_LOOKAHEAD_DAYS` from the SQL lower bound (`drizzle-collect-by.reader.ts:61`);
   - setting the calendar range's look-ahead to 0 (`collect-by-calendars.ts:20`).

   The closure in the role test starts after the counted day: counted Sat 15 Mar 2031, closed Mon to Wed, deadline Thu 20 Mar.

4. Fixed: part-day closures. `nextOpenDay` (`packages/domain/src/collection-calendar.ts:177`) counts a day only if some opening range is not covered by a closed range (`isOpenSomeHours`, line 158). Mutation: going back to `plan(day).kind === "open"` fails a domain test.

5. Fixed: queued emails. `collectionContactLine` (`packages/email/src/templates/collection-contact.ts:12`) falls back to the gallery's email when `contactEmail` is missing or blank. Mutation: removing the fallback fails a render test.

6. Fixed: the purchases page range. `collectByCalendarsFor` (`packages/persistence/src/repositories/drizzle-workspace-buying.readers.ts:383`) counts only lots that `awaitsCollection` keeps. It now uses the same read-only calendar read, so a GET no longer writes.

7. Kept for #1457: `nextOpenDay`, `MAX_OPEN_DAY_LOOKAHEAD_DAYS` (`packages/domain/src/index.ts:906-907`) and `type CollectByCalendar` (`packages/domain/src/index.ts:999`, defined in `collection-storage.ts:26`) are still exported, with the same signatures. The merge plan in the first review still applies: #1459 first, then #1457 rebases onto these.

8. Not blocking, CI: `api vitest (2/2)` and `test` (and so `ci-result`) are red on this head. Neither has a failing test:
   - `api vitest (2/2)`: 3297 tests passed;
   - `test`, `@auction/db`: 1155 passed, 72 skipped.

   Each job failed on one uncaught `57P01 terminating connection due to administrator command`. That comes from a test that drops or terminates its own temporary database while a pooled connection is still open:
   - `apps/api/src/services/reoffer/reoffer-legacy-premium.integration.test.ts:122`;
   - `packages/db/src/xero-token-sealing/backfill.integration.test.ts:46`.

   This PR changes neither file, nothing in `packages/db`, and nothing in the reoffer code. Both files pass locally on this head (1/1 and 5/5). The same jobs are green on #1460, which has the same base. Re-run the two jobs before merging. The flake itself belongs in its own ticket: those tests should attach an error listener to the pool before terminating.

9. Noted, not changed (accepted in the PR body): a lot already reminded for the old deadline gets one more reminder when its deadline moves, because the idempotency key (`apps/worker/src/services/collect-by-notices.ts:73`) includes the date. The placeholder phone number elsewhere on the site is out of scope here.

## Runs

Environment: Postgres 16 under `/var/tmp`, port 55432, fresh database, after `db:migrate`, the worker probe seed and `db:roles`. Vitest ran with `--maxWorkers=2`, or 1 for persistence.

| Area | Result |
|---|---|
| domain calendar and storage | 65 passed |
| email (whole package) | 247 passed |
| persistence collect-by, workspace-buying, collection (DB) | 100 passed |
| worker collect-by and collection reminders (DB) | 53 passed |
| worker role-contract files, plus the new collect-by role test (`worker_app`) | 488 passed |
| api collection, organisation-buying, purchases | 537 passed |
| web `src/lib/collect`, `src/components/collect` | 55 passed |

- `turbo typecheck` for domain, types, persistence, email, worker, api and web: 41/41 tasks pass.
- `biome check` on the changed files: clean.
- Layer and lint scripts: as in finding 2.

PR checks on `482cbb91`:

- Failed: `api vitest (2/2)`, `test` and `ci-result`. These are the flake in finding 8.
- Skipped: `art-browser-gates`.
- Passed: all the others, including `static-checks`, `worker-role-contract`, `build`, `browser-gates`, `account-browser-gates`, and the web and shop-api vitest jobs.

Commit messages on the PR: none has a `Co-Authored-By` or "Generated with" line.
