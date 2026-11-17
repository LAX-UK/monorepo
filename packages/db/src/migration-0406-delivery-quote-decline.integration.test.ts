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
/** The journal time of 0405, the migration before 0406. */
const THROUGH_0405 = 1813233600000;
/** This migration's journal time, which its rollback removes from the ledger. */
const WHEN_0406 = 1813320000000;
const CHECK_VIOLATION = "23514";

const rollbackSql = () =>
  readFile(resolve(import.meta.dirname, "../drizzle/0406_rollback.sql"), "utf8");

/** A user, a buying account, an ended lot and a quote in `status` for it. */
async function seed(pool: pg.Pool) {
  const userId = `u-0406-${randomUUID().slice(0, 8)}`;
  const entityId = randomUUID();
  const lotId = randomUUID();
  await pool.query(
    `insert into "user" (id, name, email, email_verified, created_at, updated_at)
     values ($1, 'Probe', $2, true, now(), now())`,
    [userId, `${userId}@integration.test`],
  );
  await pool.query(
    `insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
     values ($1, 'Buyer', 'individual', 'private_collector', $2, 'approved')`,
    [entityId, userId],
  );
  await pool.query(
    `insert into lot (id, seller_legal_entity_id, title, auction_type, starting_price,
       current_price, start_time, end_time, status)
     values ($1, $2, 'Lot 0406', 'english', 100, 100, now() - interval '30 days',
       now() - interval '20 days', 'ended')`,
    [lotId, entityId],
  );
  const quote = async (status: string) => {
    const { rows } = await pool.query<{ id: string }>(
      `insert into delivery_quote (lot_id, buyer_legal_entity_id, status, destination, amount)
       values ($1, $2, $3, 'Lyon, France', $4) returning id`,
      [lotId, entityId, status, status === "quoted" ? "180.00" : null],
    );
    return rows[0]?.id as string;
  };
  return { userId, quote };
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
        where table_name = 'delivery_quote' and column_name = 'decline_reason'`,
    )
  ).rowCount === 1;

describe.skipIf(!url)("migration 0406 delivery quote decline", { timeout: 180_000 }, () => {
  it("keeps existing quotes, holds the reason rules, rolls back and applies again", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, THROUGH_0405);
      const { userId, quote } = await seed(pool);
      const existing = await quote("withdrawn");

      await runMigrationsPerTransaction(pool);

      // A quote from before the migration keeps its state and has no reason.
      const before = await pool.query(
        "select status, decline_reason from delivery_quote where id = $1",
        [existing],
      );
      expect(before.rows[0]).toEqual({ status: "withdrawn", decline_reason: null });

      // A reason goes only on a withdrawn quote, trimmed, at most 500 characters.
      const open = await quote("quoted");
      const setReason = (id: string, status: string, reason: string) =>
        pool.query("update delivery_quote set status = $2, decline_reason = $3 where id = $1", [
          id,
          status,
          reason,
        ]);
      expect(await sqlState(setReason(open, "quoted", "We don't ship there"))).toBe(
        CHECK_VIOLATION,
      );
      expect(await sqlState(setReason(open, "withdrawn", ""))).toBe(CHECK_VIOLATION);
      expect(await sqlState(setReason(open, "withdrawn", " padded "))).toBe(CHECK_VIOLATION);
      expect(await sqlState(setReason(open, "withdrawn", "x".repeat(501)))).toBe(CHECK_VIOLATION);
      expect(await sqlState(setReason(open, "withdrawn", "We don't ship to Lyon"))).toBeUndefined();

      // The buyer's notice for it is an allowed type.
      await pool.query(
        `insert into notification (user_id, type, title, message)
         values ($1, 'delivery_quote_declined', 't', 'm')`,
        [userId],
      );

      await pool.query(laterRollbackSql(406));
      await pool.query(await rollbackSql());

      expect(await hasColumn(pool)).toBe(false);
      const kept = await pool.query("select status from delivery_quote where id = $1", [open]);
      expect(kept.rows).toEqual([{ status: "withdrawn" }]);
      const notices = await pool.query(
        "select 1 from notification where type = 'delivery_quote_declined'",
      );
      expect(notices.rowCount).toBe(0);
      expect(
        await sqlState(
          pool.query(
            `insert into notification (user_id, type, title, message)
             values ($1, 'delivery_quote_declined', 't', 'm')`,
            [userId],
          ),
        ),
      ).toBe(CHECK_VIOLATION);
      const ledger = await pool.query(
        "select 1 from drizzle.__drizzle_migrations where created_at = $1",
        [WHEN_0406],
      );
      expect(ledger.rowCount).toBe(0);

      await runMigrationsPerTransaction(pool);
      expect(await hasColumn(pool)).toBe(true);
    });
  });
});
