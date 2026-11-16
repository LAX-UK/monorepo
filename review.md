Verdict: SHIP

# Review of PR #1484: online indexes for domain_events (BA-15, CO-3F7)

Branch `db/online-domain-event-indexes` at `9c49aa03`. Migrations 0398 (btree on
`domain_events (event_type, aggregate_id)`) and 0399 (partial expression indexes on the
unapplied-money payload's `shopCheckoutSessionId` and `stripePaymentIntentId`).

Nothing is blocking. Finding 1 must be handled at ship time. Findings 2–6 are follow-ups or
small corrections.

## What I ran

- `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`: all passed.
- PostgreSQL 16 locally, fresh database at the PR head: `db:migrate` passed, and `db:roles` passed ("Application role grants applied").
- `packages/db` vitest (`--maxWorkers=2`, with `MIGRATION_TEST_DATABASE_URL` set): 218 files passed, 3 skipped; 1183 tests passed, 84 skipped. Both `migration-0398-0399-online-indexes*.test.ts` files passed, including the integration test.
- `pnpm --filter @auction/db typecheck` and `pnpm --filter @auction/persistence typecheck`: both clean. `biome check packages/db`: clean.
- `scripts/ci/verify-migration-pairs.mjs`: the matrix audit passes. 0398 and 0399 are not identity pairs, as expected.
- CI check-runs for `9c49aa03` (REST): 39 success, 2 skipped, none failing.
- EXPLAIN ANALYZE on a seeded PG 16 database: 1,026,600 rows, 128 MB heap, 20,500 `payment.unapplied_money_received` rows, 2,600 `email.block_lifted`, 3,500 `payment.captured`. I ran the plans with the PR's indexes in place and again with them dropped in a rolled-back transaction (main's index set). The unapplied-money reader was run through node-pg with **the exact SQL and parameters Drizzle generates** (captured from `DrizzleUnappliedMoneyReader`).
- Commit message and PR body: no `Co-Authored-By`, `Claude-Session` or generated-by lines.

## Findings

1. **Ship-time renumber (not blocking now): three PRs share migration 0398.** This PR, #1482 (`0398_demo_seed_target`) and #1483 (`0398_notice_delivery_preferences`) all add a journal entry with `idx` 390 and `when` 1812628800000, and all add `packages/db/drizzle/0398_rollback.sql`.
   - The runner rejects duplicate ledger timestamps (`packages/db/src/migrate-runner.ts:133`).
   - The rollback deletes its ledger row by `created_at` (`packages/db/drizzle/0398_rollback.sql:12`). If two migrations shared a `when`, this would delete the other migration's row as well.
   - Whichever PR lands second must renumber. That means changing:
     - the file names;
     - the journal `idx`/`when` (`packages/db/drizzle/meta/_journal.json:2728-2740`);
     - both rollbacks' `created_at` (`0398_rollback.sql:12`, `0399_rollback.sql:14`);
     - the test constants `THROUGH_0397`/`WHEN_0398`/`WHEN_0399` and the `laterRollbackSql(398|399)` calls (`packages/db/src/migration-0398-0399-online-indexes.integration.test.ts:14-16`, `:89,91`);
     - the "(0398)"/"(0399)" comments (`packages/db/src/schema/domain-events.ts:57,59`);
     - the "as 0398" cross-reference in the 0399 header (`0399_unapplied_money_shop_payment_idx.sql:14`).

2. **CONCURRENTLY: the PR is correct for this runner; the online path is a manual operator step.** `migrate-runner.ts:68` wraps every migration in `BEGIN … COMMIT`, and there is no per-migration no-transaction marker. Every earlier index migration says so and builds plainly: 0297, 0316, 0321, 0361, 0365, 0384.
   - The PR follows that pattern: `SET LOCAL lock_timeout = '5s'` and `CREATE INDEX IF NOT EXISTS` under a SHARE lock. The integration test asserts that only `ShareLock` is held.
   - It documents the `CREATE INDEX CONCURRENTLY IF NOT EXISTS` statements to run out of band. The test parses and executes those exact header lines, so they cannot drift.
   - The INVALID-index guard works: a failed concurrent build makes the migration stop with no ledger row. The PR body's rollout note covers the `indisvalid` check and the drop-and-rebuild step.
   - Suggestion (non-blocking): put the pre-build step in the deploy runbook or checklist, not only in SQL comments, so the operator sees it at deploy time.
   - Measured build on 1M rows: 1.3 s (PR's number); the indexes built fine here as well.

3. **The INVALID guard checks validity only, not the definition** (`0398_domain_events_event_type_aggregate_idx.sql:26-38`, `0399_unapplied_money_shop_payment_idx.sql:30-45`). A *valid* index already under one of these names with different columns, expression or predicate would be kept silently by `IF NOT EXISTS`. An example is a hand-built index with a typo in the out-of-band statement. Low risk. Optional hardening: also compare `pg_get_indexdef(...)` with the expected definition and raise if they differ.

4. **The 0399 header overclaims for `wasEverUnapplied`** (`packages/db/drizzle/0399_unapplied_money_shop_payment_idx.sql:10-11`). `wasEverUnapplied` ORs `payload->>'stripeChargeId'` (unindexed) with the payment intent (`packages/persistence/src/repositories/drizzle-unapplied-money.reader.ts:75-93`), so the intent index cannot serve it.
   - Measured with the reader's real SQL: **Seq Scan of all 1,026,600 rows, 70–75 ms, both before and after this PR.** This is not a regression, but the comment is wrong.
   - This runs on the refund webhook path.
   - Either correct the comment, or add a third partial index on `payload->>'stripeChargeId'` with the same predicate, as a follow-up, so the query becomes a BitmapOr.
   - `listOpen`'s intent filter does use the new intent index: 0.05 ms, verified.

5. **The expression match works only because node-pg plans every query custom.** The reader passes the JSON key as a bind parameter: `field = (name) => sql\`${domainEvent.payload}->>${name}\`` (`drizzle-unapplied-money.reader.ts:21`). The generated SQL is `"payload"->>$2 = $3 or "payload"->>$4 = $5`.
   - With node-pg's unnamed statements, PG plans each execution with the values folded to constants. The plan is then a **BitmapOr of `…_session_idx` + `…_intent_idx`**: 4–5 buffers, 0.02–0.035 ms for both hit and miss. With no payment intent, it is an Index Scan on `…_session_idx` (0.017 ms). So the operator (`->>`), type (`text`) and keys match the index exactly.
   - Under a generic plan (`plan_cache_mode = force_generic_plan`, or a future named or pooled prepared statement), the key is not known at plan time. The plan then falls back to `event_type_idx` and filters 20,500 rows (9 ms). No named prepares exist in the repo today.
   - Suggestion (non-blocking): emit these key names as SQL literals so the match does not depend on plan mode. Related: the integration test (`migration-0398-0399-online-indexes.integration.test.ts:141`) says "as the Drizzle reader writes it" but hard-codes literal keys. To cover this, the test should run the reader's actual SQL, or at least `payload->>$n`.

6. **Disk and write cost; no read regressions found.**
   - On the 1M-row seed the composite index is **37 MB**. That compares with `domain_events_aggregate_idx` at 12 MB (it deduplicates better), `event_type_idx` at 6.6 MB, and 22 MB for the pkey. The PR measured 48 MB on its seed.
   - The two partial indexes are about 0.9 MB each and only take inserts of the unapplied-money type.
   - Every `domain_events` insert now maintains one more full btree.
   - `domain_events_event_type_idx` (`packages/db/src/schema/domain-events.ts:34`) is now a leading prefix of the new index. It is a follow-up candidate to drop, to win back write cost and space. Check its readers' plans first.
   - Before/after, warm, from my runs:

   | Query | main | PR |
   |---|---|---|
   | `findLatestLift` (`email.block_lifted` + aggregate_id, order by occurred_at limit 1) | Bitmap on `event_type_idx`, 2,599 rows filtered, 0.27 ms | Index Scan `event_type_aggregate_id_idx`, 0.04 ms |
   | bid-invoice facts `payment.captured` + aggregate_id | Bitmap on `event_type_idx`, 3,499 filtered, 0.46 ms | Index Scan new idx, 0.02 ms |
   | `payment.captured` + `aggregate_id IN (3)` | Bitmap, 3,497 filtered, 0.53 ms | Index Scan new idx, 0.03 ms |
   | aggregate_type + aggregate_id + event_type (blocked-capture shape) | `aggregate_idx`, 0.07 ms | new idx, 0.04 ms |
   | aggregate_type + aggregate_id (timeline/export shape) | `aggregate_idx`, 0.05 ms | `aggregate_idx`, 0.09 ms (same plan) |
   | `event_type = X order by id limit 50` | pkey walk, 0.44 ms | pkey walk, 0.47 ms (same plan) |
   | `existsForShopPayment` miss (reader SQL) | dedupe-key walk; PR measured 6.6 ms | BitmapOr, 0.019 ms |

   - Btree over pg_trgm is the right choice: every reader of the pair uses `=` or `IN`, and the one ILIKE (audit-log search) ORs columns from joined tables, so no index on `domain_events` can serve it.

## Checks that passed

- **Rollbacks:** plain `DROP INDEX IF EXISTS` inside `BEGIN/COMMIT` with `lock_timeout`, with the `DROP INDEX CONCURRENTLY` pre-step in each header (`0398_rollback.sql:4-6`, `0399_rollback.sql:4-7`). This is required here, not a gap. `packages/db/src/testing/later-rollbacks.ts` strips `BEGIN/COMMIT` and runs rollbacks inside the caller's transaction, where `DROP INDEX CONCURRENTLY` is illegal; 0384_rollback.sql does the same. The order (0399 before 0398) and the ledger-row deletes are right.
- **Rollback tests:** the integration test uses `laterRollbackSql(399)`/`laterRollbackSql(398)` from `packages/db/src/testing/later-rollbacks.ts` before each rollback. It then reapplies and checks the indexes and ledger again.
- **Journal:** the two entries come after 0397, with `idx` 390/391 and `when` 1812628800000 < 1812715200000, both later than 0397's 1812542400000. Subject to the renumber in finding 1.
- **Grants and roles:** indexes need no grants. `db:roles` passes after migrating, and the integration test compares `information_schema.role_table_grants` on `domain_events` before and after.
- **Schema parity:** `schema/domain-events.ts:57-65` declares the same three indexes, with the same expressions and predicates as the SQL.
- **Attribution:** no `Co-Authored-By`, `Claude-Session` or generated-by lines in commit `9c49aa03`'s message or in the PR body.
