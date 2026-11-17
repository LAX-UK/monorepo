Verdict: FIX FIRST

# Review of PR #1534: Database: online index pre-step for production migrations

Reviewed head `431e31e2` against section A of `docs/design/overnight-decision-pack-2026-11-17.md` (approved D1–D7, Q1 yes, Q2 no timeout in code, Q3 out of scope). The PR branch was not changed.

## What I ran

- `pnpm turbo run build --filter=@auction/db...`, then `db:migrate` and `db:roles` against a local Postgres 16 set up like the CI `auction_ci` database (`MIGRATION_TEST_DATABASE_URL` set).
- `vitest run` for all of `packages/db`: 242 files passed, 2 skipped (1378 tests passed, 75 skipped). The new suites all ran: `online-index.integration.test.ts` (4), `step.test.ts` (11), `declarations.test.ts` (21), `declarations.contract.test.ts` (7). The existing `migration-0399-0400-online-indexes` tests also passed.
- Parser probe (a throwaway test, not committed). All of these were rejected: a second statement after `;`, `;` inside a string literal, `$$;$$`, a `/* */` comment, a trailing `--` comment, a leading `--` line hiding a `DROP TABLE`, plain `CREATE INDEX`, missing `IF NOT EXISTS`, `DROP INDEX`, `ALTER TABLE`, and `\;`. Quoted and unquoted names come out case-correct.
- Mutation checks (whether the tests fail when the code is removed):

  | Mutation | Result |
  |---|---|
  | Drop the index even when it is valid | caught |
  | Remove `lock_timeout` | caught |
  | Ignore a pre-existing INVALID index | caught |
  | Ignore the ledger | caught |
  | Remove the comment check | **not caught** (see finding 3) |
  | Remove the step call from `migrate-prod.ts` and rebuild `dist` | **not caught** (see finding 2) |

## Findings that must be fixed

### 1. The test environment deploy never runs the step (approved Q1 not met)

Locations: `packages/db/src/migrate-prod.ts:38`, `docs/runbooks/online-index-builds.md:3`, the PR body ("Production and test deploys use the same `migrate-prod.ts` entry point").

The test environment's App Platform migrate job runs `node packages/db/dist/migrate.js`, not `migrate-prod.js`. The repo enforces this in `scripts/ci/verify-staging-migrate-contract.mjs:23-28`, which fails if the test job uses `migrate-prod.js`. The PR wires the step into `migrate-prod.ts` only. `packages/db/src/migrate.ts` is unchanged.

So the test deploy applies 0399/0400 with the plain transactional `CREATE INDEX`, and the planned rehearsal (looking for `lax-online-index` in `pg_stat_activity` on the test deploy) will never show the step. The only test-side caller of `migrate-prod` is the manual `identity-migration-maintenance-test.yml` workflow. That is a `workflow_dispatch`, not the deploy. The runbook and the PR body state the opposite, so whoever runs the rehearsal will be misled.

Fix: run the same step from `migrate.ts` when an explicit opt-in is set, for example `ONLINE_INDEX_STEP=1` set only on the test migrate job (ceiling `null`, the whole journal). Local and CI do not set it, so they stay unchanged (D6). Add a test for the opt-in, and correct the runbook line 3 and the PR body. If the infra change has to land separately in the infra repo, say so in the PR and the runbook, and treat it as a blocker for the Q1 rehearsal.

### 2. The `migrate-prod` integration test passes without the step

Location: `packages/db/src/online-index/online-index.integration.test.ts:218`.

The test "migrate-prod exits non-zero before any migration when an INVALID index is in the way" matches stderr against `/exists but is INVALID/`. The 0399 migration's own guard raises the same words (`packages/db/drizzle/0399_domain_events_event_type_aggregate_idx.sql:35`). The runner also fails at 0399, so the ledger stays empty either way.

I removed the `runPendingOnlineIndexBuilds` call from `migrate-prod.ts` and rebuilt `dist`. The test still passed. Nothing in the suite therefore proves that `migrate-prod` runs the step, or that it runs before the runner (D3).

Fix: assert on the step's own message, for example `/Online index 0399_[^:]+: .* exists but is INVALID/`, or on `OnlineIndexBuildError`. Also add a success case: with a writer transaction open, `dist/migrate-prod.js` logs `Online index ...: built in` before the runner's ledger rows appear.

## Smaller findings (not blocking)

3. **The comment rule has no test of its own.** Location: `packages/db/src/online-index/declarations.ts:58`. The two comment cases in `declarations.test.ts:52-53` are already rejected by the prefix regex. A trailing comment such as `CREATE INDEX CONCURRENTLY IF NOT EXISTS a ON t (x) -- c` is caught only by line 58, and no test covers it. This is not exploitable: any `;` is still rejected, so no second statement can follow. Add the trailing-comment case so that D2 ("anything else is a lint failure") is pinned.
4. **A narrow race between the "before" check and the build.** Location: `packages/db/src/online-index/step.ts:97` and `:112`. If another session starts a concurrent build of the same name between the `before` lookup and this build, and this build then fails (for example on `lock_timeout`), `after` is the other session's in-progress INVALID index, and the step drops it. This needs a manual concurrent build during the deploy, so it is unlikely. One option is to also compare the index OID or `pg_stat_progress_create_index.pid` before dropping. Otherwise, document it in the runbook ("do not build by hand while a deploy runs").
5. **Declaration file name.** The design text gives `online/0399.sql` as an example, but D2 says `<migration-tag>.sql`. The PR uses the full journal tag and fails on a stray file name. That matches D2 and is fine.

## Checked and fine

- **Declarations allow only `CREATE [UNIQUE] INDEX CONCURRENTLY IF NOT EXISTS`** (`declarations.ts:22-25`, `:56-84`). Comments, any `;` other than one trailing, empty chunks, other DDL, duplicate names and `ON ONLY` are all rejected. `--> statement-breakpoint` is the only separator.
- **No SQL injection from file names.** A file name has to equal a journal tag (`declarations.ts:136-143`) and is used only as a map key and in log text. The table goes to `to_regclass($1)` as a parameter. Catalog lookups are parameterised. The DROP uses `quoteIdent` on the catalog schema and the parsed name, with `"` doubled (`step.ts:41-43`, `:113`).
- **Outside any transaction, before the runner** (`migrate-prod.ts:32-42`): a dedicated autocommit `pg.Client`, closed in `finally`, called before `runMigrationsPerTransactionThrough`.
- **Session settings, D4** (`step.ts:16-20`): `lock_timeout = '5s'`, `statement_timeout = 0`, `application_name = 'lax-online-index'`, both on connect and via `SET`. No other timeout in code (Q2).
- **Failure cleanup, D5** (`step.ts:96-125`):
  - a valid index is skipped;
  - a pre-existing INVALID index is refused, not dropped;
  - only an INVALID index that appeared during this run's build is dropped, with `DROP INDEX CONCURRENTLY IF EXISTS`;
  - a failed drop is reported;
  - `OnlineIndexBuildError` reaches `main().catch`, which exits 1 before the runner.
- **Ceiling and ledger:** the same `ceiling.folderMillis` as the runner. A declaration above the ceiling is skipped, and the integration test covers it.
- **Idempotent rerun:** covered by the integration test (`already built`, same OIDs, the runner adopts, then `nothing to build`).
- **D6 and D7:**
  - the 0399/0400 migrations are unchanged and keep the plain `IF NOT EXISTS` and the INVALID guard;
  - declarations exist only for 0399 and 0400;
  - there is no new numbered migration and no journal change;
  - the contract test compares the definition text with the migration.
- **D1 and Q3:** no trigram index, and no audit-log search change.
- **Design:** declarations, step and wiring are separate modules. `OnlineIndexClient` is a narrow injected interface, and `step.test.ts` uses a fake client. Logger and clock are injectable.
