import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runMigrationsPerTransaction } from "./migrate-runner.js";
import { laterRollbackSql } from "./testing/later-rollbacks.js";
import { withTemporaryDatabase } from "./testing/temporary-database.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
const rollbackSql = () =>
  readFile(resolve(import.meta.dirname, "../drizzle/0398_rollback.sql"), "utf8");

describe.skipIf(!url)("migration 0398 demo seed target", { timeout: 180_000 }, () => {
  it("holds one mark at most, for test or local only, rolls back and applies again", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const empty = await pool.query("select 1 from demo_seed_target");
      expect(empty.rowCount).toBe(0);

      await expect(
        pool.query(
          `insert into demo_seed_target (environment, database_name, marked_by)
           values ('production', current_database(), 'x')`,
        ),
      ).rejects.toThrow(/demo_seed_target_environment_check/);
      await pool.query(
        `insert into demo_seed_target (environment, database_name, marked_by)
         values ('test', current_database(), 'operator')`,
      );
      await expect(
        pool.query(
          `insert into demo_seed_target (environment, database_name, marked_by)
           values ('local', current_database(), 'second')`,
        ),
      ).rejects.toThrow(/duplicate key/);
      await expect(
        pool.query(
          `insert into demo_seed_target (id, environment, database_name, marked_by)
           values (false, 'local', current_database(), 'second')`,
        ),
      ).rejects.toThrow(/demo_seed_target_single_row_check/);

      await pool.query(laterRollbackSql(398));
      await pool.query(await rollbackSql());
      const gone = await pool.query("select to_regclass('public.demo_seed_target') as t");
      expect(gone.rows[0]?.t).toBeNull();

      await runMigrationsPerTransaction(pool);
      const again = await pool.query("select count(*)::int as n from demo_seed_target");
      // Reapplied empty: the mark has to be put back by hand.
      expect(again.rows[0]?.n).toBe(0);
    });
  });
});
