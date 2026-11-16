import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  runMigrationsPerTransaction,
  runMigrationsPerTransactionThrough,
} from "./migrate-runner.js";
import { laterRollbackSql } from "./testing/later-rollbacks.js";
import { withTemporaryDatabase } from "./testing/temporary-database.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
/** The journal time of 0402, the migration before 0403. */
const THROUGH_0402 = 1812974400000;

const rollbackSql = () =>
  readFile(resolve(import.meta.dirname, "../drizzle/0403_rollback.sql"), "utf8");

const hasColumn = async (pool: { query: (sql: string) => Promise<{ rowCount: number | null }> }) =>
  (
    await pool.query(
      `select 1 from information_schema.columns
        where table_name = 'notification_outbox' and column_name = 'last_attempt_at'`,
    )
  ).rowCount === 1;

describe.skipIf(!url)(
  "migration 0403 notification outbox retry backoff",
  { timeout: 180_000 },
  () => {
    it("keeps staged rows, records attempt times, rolls back and applies again", async () => {
      await withTemporaryDatabase(async (pool) => {
        await runMigrationsPerTransactionThrough(pool, THROUGH_0402);
        await pool.query(
          `insert into "user" (id, email, name, created_at, updated_at)
         values ('u-0403', 'outbox-0403@example.test', 'Probe', now(), now())`,
        );
        await pool.query(
          `insert into notification_outbox (idempotency_key, user_id, payload, state, attempts)
         values ('k-0403', 'u-0403', '{"type":"outbid"}', 'pending', 2)`,
        );

        await runMigrationsPerTransaction(pool);

        // A row from before the migration has no attempt time and stays claimable.
        const before = await pool.query<{ attempts: number; last_attempt_at: Date | null }>(
          "select attempts, last_attempt_at from notification_outbox where idempotency_key = 'k-0403'",
        );
        expect(before.rows[0]).toEqual({ attempts: 2, last_attempt_at: null });
        await pool.query(
          "update notification_outbox set last_attempt_at = now() where idempotency_key = 'k-0403'",
        );

        await pool.query(laterRollbackSql(403));
        await pool.query(await rollbackSql());

        expect(await hasColumn(pool)).toBe(false);
        const kept = await pool.query<{ attempts: number }>(
          "select attempts from notification_outbox where idempotency_key = 'k-0403'",
        );
        expect(kept.rows).toEqual([{ attempts: 2 }]);
        const ledger = await pool.query(
          "select 1 from drizzle.__drizzle_migrations where created_at = 1813060800000",
        );
        expect(ledger.rowCount).toBe(0);

        await runMigrationsPerTransaction(pool);
        expect(await hasColumn(pool)).toBe(true);
      });
    });
  },
);
