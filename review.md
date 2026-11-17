Verdict: SHIP

# Final recheck of PR #1534: Database: online index pre-step for production migrations

I rechecked head `f2e3c4a3` against my earlier review (head `431e31e2`) and against section A of `docs/design/overnight-decision-pack-2026-11-17.md`. I did not change the PR branch. Findings 1–4 are fixed at the root. The independent pass found nothing that blocks the merge.

## What I ran

- I built with `pnpm turbo run build --filter=@auction/db...`. I then ran `db:migrate` and `db:roles` against a local Postgres 16 `auction_ci` database, set up with the same env vars as CI.
- `vitest run` for all of `packages/db`: 245 files passed, 2 skipped (1404 tests passed, 78 skipped). This includes:
  - `online-index.integration.test.ts` (9)
  - `step.test.ts` (15)
  - `declarations.test.ts` (25)
  - `declarations.contract.test.ts` (7)
  - `opt-in.test.ts` (6)
  - the existing `migration-0399-0400-online-indexes` unit (9) and integration (2) tests
- `tsc --noEmit` and `biome check .` in `packages/db` are both clean.
- **Mutation checks.** For each one I changed the source, rebuilt `dist`, ran the tests, then reverted:

  | Mutation | Result |
  |---|---|
  | Remove the step call from both `migrate.ts:16` and `migrate-prod.ts:29` | caught by 3 integration tests |
  | Remove it from `migrate-prod.ts:29` only | caught by 2 tests ("exits non-zero … INVALID", "migrate-prod.js builds … before the runner") |
  | Remove it from `migrate.ts:16` only | caught by 1 test ("migrate.js with ONLINE_INDEX_STEP=1 builds … before the runner") |
  | Move the step after `runMigrationsPerTransactionThrough` in `migrate-prod.ts` | caught by 2 tests |
  | Remove the comment rule (`declarations.ts:58`) | caught by 4 tests |
  | Ignore other builders before dropping (`step.ts:136`) | caught by 2 tests (unit and integration race) |
  | Skip the validity check after a successful `CREATE` (`step.ts:193`) | caught by 1 test |

## Earlier findings

1. **Test environment deploy (Q1): fixed.**
   - `packages/db/src/migrate.ts:15-16` runs the same `runOnlineIndexPreStep` (`online-index/index.ts:75`) over the whole journal (`null` ceiling), but only when `ONLINE_INDEX_STEP=1`.
   - `onlineIndexStepOptedIn` (`online-index/index.ts:60`) is off when the variable is unset, empty or `0`. It throws on any other value.
   - No workflow or script in this repo sets the variable. The integration test strips it from the child env, and "migrate.js without ONLINE_INDEX_STEP" (`online-index.integration.test.ts:312`) asserts that no `Online index` lines are logged. So local and CI are unchanged (D6 holds).
   - The infra change needed (`ONLINE_INDEX_STEP=1` on the test migrate job in `auction-infra`, `terraform/ephemeral/test/main.tf`) is named in three places, each marked as a blocker for the Q1 rehearsal: the runbook (`docs/runbooks/online-index-builds.md:8`, `:13`), `docs/architecture/06-deployment.md`, and the PR body.
2. **The integration test now proves the step runs, and runs first: fixed.**
   - The failure test asserts the step's own `OnlineIndexBuildError: Online index 0399_…: … exists but is INVALID` (`online-index.integration.test.ts:247`). The 0399 guard does not print that text.
   - A new success case (`:263` and the cases around it) runs `migrate-prod.js` and `migrate.js` with the opt-in, with a writer transaction open. It checks that the `lax-online-index` build is seen while the ledger is still empty, and that the `built in` lines come before the runner's final line.
   - The mutation checks above confirm all of this.
3. **Trailing-comment test: fixed.** `declarations.test.ts:54` and `:61-66` cover `-- c`, a bare `--`, and `-- c\n`. Each is asserted against the comment rule's own message, and removing the rule fails 4 tests.
4. **The drop touches only an index this run created: fixed.**
   - Cleanup runs only when `before` was null (`step.ts:164-175`, `:182`). It drops the index only if it is INVALID and `otherBuilders` (`step.ts:84-108`) finds no other `pg_stat_progress_create_index` row for the table or index, and no other client session holding or waiting for `ShareUpdateExclusiveLock` on either.
   - If the ownership check fails, the index is left in place (`step.ts:133-135`).
   - After a successful `CREATE`, the step checks that the index is valid (`step.ts:192-197`). This catches the case where `IF NOT EXISTS` skips another session's index.
   - The real-Postgres race test (`online-index.integration.test.ts:339`) confirms the other session's index survives and then completes valid.
   - The one remaining window is a manual build that both starts and fails while the step's own build is failing. The step cannot tell that index from its own and would drop it, but the index is INVALID and unused anyway, and the runbook (`:94`) documents it. Not blocking.

## Independent pass against section A

- **D1 / Q3:** no trigram index and no audit-log search change.
- **D2:** declarations live in `drizzle/online/<journal tag>.sql`. Only `CREATE [UNIQUE] INDEX CONCURRENTLY IF NOT EXISTS` is accepted, separated by `--> statement-breakpoint`. Comments, `;` other than one trailing, and other DDL are rejected.
- **D3:** `migrate-prod.ts:29` runs the step before the runner, with the same `ceiling.folderMillis`. It covers only migrations that are not in the ledger yet and are within the ceiling, and a test covers a declaration above the ceiling being skipped.
- **D4:** `step.ts:16-20` sets `lock_timeout = '5s'`, `statement_timeout = 0` and `application_name = 'lax-online-index'`. The connection is also named at connect time (`index.ts:79-82`). There is no timeout in code (Q2).
- **D5:** the step drops only the index named in the failing statement, with `DROP INDEX CONCURRENTLY IF EXISTS`. It never drops a valid or pre-existing index, and it exits non-zero before the runner. It is more conservative than D5 in one way: it also keeps the index when another session is building it. That is a safe narrowing.
- **D6 / D7:**
  - migrations 0399 and 0400 are unchanged in the diff;
  - declarations exist for those two only;
  - the journal is unchanged and there is no new numbered migration;
  - `declarations.contract.test.ts` compares each definition's text with its migration and requires the INVALID guard (PR plan step 4).
- **Testing plan:**
  - writer not blocked;
  - failed-UNIQUE cleanup;
  - idempotent rerun;
  - the runner adopts the indexes with the same OIDs.

  All are covered against real Postgres.
- **Runbook:** it covers which entry point runs the step, how to watch a build (`pg_stat_progress_create_index`), how to find the blocker, a fix for each failure message, how to finish a build by hand, and how to roll back.
- **Security:** a file name must equal a journal tag. Catalog lookups are parameterised, and the drop uses identifiers quoted with `quoteIdent`. There is no injection path.

## Non-blocking notes

- **Progress is not logged during a build.** The design's risk mitigation mentions logging progress from `pg_stat_progress_create_index`. The step logs only start and finish (`step.ts:178`, `:198`), and the runbook gives the query for watching by hand. That is fine at the current table size, and worth adding if builds get long.
- **The comment rule blocks any `--` or `/*`, even inside a string literal** (`declarations.ts:58`), for example in a partial-index predicate. This is deliberately strict and matches D2.
- **The Q1 rehearsal is still pending** until the `auction-infra` change lands. This is correctly called out as outside this PR.
