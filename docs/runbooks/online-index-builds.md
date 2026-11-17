# Online index builds

The production migrate (`pnpm db:migrate:prod`, the App Platform `PRE_DEPLOY` job on production and on the test environment) builds declared indexes with `CREATE INDEX CONCURRENTLY` before the transactional migration runner. Writers keep inserting while the index builds; nobody has to run anything in psql before the deploy.

Code: [`packages/db/src/online-index/`](../../packages/db/src/online-index/). Declarations: [`packages/db/drizzle/online/`](../../packages/db/drizzle/online/). Design: section A of the 2026-11-17 overnight decision pack (BA-15 follow-up).

## How it works

1. `migrate-prod.ts` resolves the production ceiling, then opens one extra connection in autocommit mode (`application_name = lax-online-index`).
2. For every migration that is **not in the ledger yet** and is **within the ceiling**, it reads `drizzle/online/<migration tag>.sql`, if there is one, and runs each statement in order:
   - table not created yet (a pending migration creates it): skipped, and the migration builds the index in its own transaction;
   - index already exists and is valid: skipped (`already built`);
   - index exists but is **INVALID**: the step stops and the deploy fails. It does not drop it, because a failed build and a build still running in another session look the same in `pg_index`;
   - otherwise: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...`, logged with its duration.
3. Session settings: `lock_timeout = '5s'` (a concurrent build only needs short locks at its start and end), `statement_timeout = 0` (no limit in code; the pre-deploy job timeout is the limit).
4. If a build fails, the step drops the INVALID index **that build created** (`DROP INDEX CONCURRENTLY IF EXISTS`), never a valid index and never one that existed before, and exits non-zero. No migration has run at that point.
5. The transactional runner then applies the migrations as before. Each migration keeps its plain `CREATE INDEX IF NOT EXISTS` and its INVALID guard, so it finds the index and records the ledger row without rebuilding it. Local and CI (`pnpm db:migrate`) do not run the step and behave exactly as before.

A rerun is safe at any point: valid indexes are skipped, and migrations already in the ledger are not considered.

## Adding an index to a hot table

1. Write the migration as before: plain `CREATE INDEX IF NOT EXISTS`, preceded by a `DO` block that raises if an index of that name exists but is INVALID (see `0399_domain_events_event_type_aggregate_idx.sql`). In the header, refer to this runbook instead of repeating psql instructions.
2. Add `packages/db/drizzle/online/<migration tag>.sql` (the full journal tag, for example `0399_domain_events_event_type_aggregate_idx.sql`) with the same statements written as `CREATE [UNIQUE] INDEX CONCURRENTLY IF NOT EXISTS`, separated by `--> statement-breakpoint` lines.
   - Nothing else is allowed in the file: no comments, no `SET`, no other DDL, no semicolons inside a statement. The step and the unit tests reject anything else.
   - `src/online-index/declarations.contract.test.ts` checks that the migration creates the same index with the same definition text (whitespace aside) and has the INVALID guard for it.
3. Do not add a new numbered migration or touch the journal for the declaration itself.

Only migrations from 0399 onwards have declarations (0399 and 0400). Earlier index migrations were not retrofitted.

## Watching a build

During the pre-deploy job:

```sql
-- The build and what it is waiting for.
SELECT pid, state, wait_event_type, wait_event, now() - query_start AS running, query
  FROM pg_stat_activity
 WHERE application_name = 'lax-online-index';

-- Progress: phase, blocks and tuples done.
SELECT p.pid, c.relname AS index, p.phase,
       p.blocks_done, p.blocks_total, p.tuples_done, p.tuples_total,
       p.lockers_done, p.lockers_total, p.current_locker_pid
  FROM pg_stat_progress_create_index p
  LEFT JOIN pg_class c ON c.oid = p.index_relid;
```

A concurrent build waits for every transaction that was open when it started. If `phase` is `waiting for old snapshots` or `waiting for writers before build` for long, find the blocker:

```sql
SELECT pid, application_name, state, now() - xact_start AS open_for, query
  FROM pg_stat_activity
 WHERE xact_start IS NOT NULL
 ORDER BY xact_start
 LIMIT 10;
```

End that session only if it is safe to do so (a stuck report or an idle-in-transaction connection), with `SELECT pg_cancel_backend(<pid>)`.

A concurrent build reads the table twice, so it takes roughly twice the I/O of a plain build. At today's sizes (`domain_events` builds took about 1.3 s per million rows) this is negligible; check the table size before adding an index to a much larger table.

## When the deploy fails

The job log names the index and the cause. No migration was applied and the live release keeps serving.

- **`exists but is INVALID`.** An earlier build failed, or a build is still running in another session. Check `pg_stat_progress_create_index` first. If nothing is building it, drop it outside a transaction and redeploy:

  ```sql
  DROP INDEX CONCURRENTLY IF EXISTS "<index name>";
  ```

- **`canceling statement due to lock timeout`.** The build could not get its short lock within 5 s (a long transaction on the table). Find the blocker as above and redeploy. The step has already dropped any INVALID index it left; the log says so.
- **`could not create unique index`** (a `UNIQUE` declaration over duplicate data). Fix the data or the migration; the INVALID index has been dropped.
- **`could not drop the INVALID index ... drop it by hand`.** Run the `DROP INDEX CONCURRENTLY IF EXISTS` above, then redeploy.
- **The job hit its timeout.** The build session ends with the job and leaves an INVALID index. Drop it as above. To finish a very long build by hand instead, run the declaration's statements in psql (autocommit, outside a transaction), wait for them to finish, and redeploy: the step and the migration then find the valid index and skip it.

## Rolling back

An index built by the step is the same index the migration would have built. Roll back with the migration's `_rollback.sql` as described in [migration-rollback.md](./migration-rollback.md). To avoid the brief ACCESS EXCLUSIVE lock of a plain `DROP INDEX`, run `DROP INDEX CONCURRENTLY IF EXISTS` outside a transaction first, as the rollback headers describe.

To disable the step for one deploy, revert the declaration file in that release. The migration then builds the index with a plain `CREATE INDEX` (a short write pause on the table, as before).
