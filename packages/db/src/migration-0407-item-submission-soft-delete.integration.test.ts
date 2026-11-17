import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type pg from "pg";
import { describe, expect, it } from "vitest";
import {
  runMigrationsPerTransaction,
  runMigrationsPerTransactionThrough,
} from "./migrate-runner.js";
import { laterRollbackSql } from "./testing/later-rollbacks.js";
import { withTemporaryDatabase } from "./testing/temporary-database.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
/** The journal time of 0406, the migration before 0407. */
const THROUGH_0406 = 1813320000000;
/** This migration's journal time, which its rollback removes from the ledger. */
const WHEN_0407 = 1813406400000;
const CHECK_VIOLATION = "23514";

const rollbackSql = () =>
  readFile(resolve(import.meta.dirname, "../drizzle/0407_rollback.sql"), "utf8");

/** A seller account and a submission of it in `status`. */
async function seed(pool: pg.Pool) {
  const userId = `u-0407-${randomUUID().slice(0, 8)}`;
  const entityId = randomUUID();
  await pool.query(
    `insert into "user" (id, name, email, email_verified, created_at, updated_at)
     values ($1, 'Probe', $2, true, now(), now())`,
    [userId, `${userId}@integration.test`],
  );
  await pool.query(
    `insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
     values ($1, 'Seller', 'individual', 'private_collector', $2, 'approved')`,
    [entityId, userId],
  );
  return async (status: string) => {
    const { rows } = await pool.query<{ id: string }>(
      `insert into item_submission (legal_entity_id, title, status, submitted_by_user_id)
       values ($1, 'Work 0407', $2, $3) returning id`,
      [entityId, status, userId],
    );
    return rows[0]?.id as string;
  };
}

async function sqlState(run: Promise<unknown>): Promise<string | undefined> {
  try {
    await run;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

const hasColumn = async (pool: pg.Pool) =>
  (
    await pool.query(
      `select 1 from information_schema.columns
        where table_name = 'item_submission' and column_name = 'deleted_at'`,
    )
  ).rowCount === 1;

describe.skipIf(!url)("migration 0407 item submission soft delete", { timeout: 180_000 }, () => {
  it("keeps existing submissions, deletes only drafts, rolls back and applies again", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, THROUGH_0406);
      const submission = await seed(pool);
      const existing = await submission("submitted");

      await runMigrationsPerTransaction(pool);

      // A submission from before the migration keeps its state and is not deleted.
      const before = await pool.query(
        "select status, deleted_at from item_submission where id = $1",
        [existing],
      );
      expect(before.rows[0]).toEqual({ status: "submitted", deleted_at: null });

      // Only a draft can carry deleted_at, and a deleted draft cannot be sent.
      const markDeleted = (id: string) =>
        pool.query("update item_submission set deleted_at = now() where id = $1", [id]);
      expect(await sqlState(markDeleted(existing))).toBe(CHECK_VIOLATION);
      const draft = await submission("draft");
      const kept = await submission("draft");
      expect(await sqlState(markDeleted(draft))).toBeUndefined();
      expect(
        await sqlState(
          pool.query("update item_submission set status = 'submitted' where id = $1", [draft]),
        ),
      ).toBe(CHECK_VIOLATION);

      await pool.query(laterRollbackSql(407));
      await pool.query(await rollbackSql());

      expect(await hasColumn(pool)).toBe(false);
      // The deleted draft is gone for good; every other submission stays as it was.
      const rows = await pool.query<{ id: string; status: string }>(
        "select id, status from item_submission where id = any($1::uuid[]) order by status",
        [[existing, draft, kept]],
      );
      expect(rows.rows).toEqual([
        { id: kept, status: "draft" },
        { id: existing, status: "submitted" },
      ]);
      const ledger = await pool.query(
        "select 1 from drizzle.__drizzle_migrations where created_at = $1",
        [WHEN_0407],
      );
      expect(ledger.rowCount).toBe(0);

      await runMigrationsPerTransaction(pool);
      expect(await hasColumn(pool)).toBe(true);
    });
  });
});
