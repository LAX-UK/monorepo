import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type pg from "pg";
import { describe, expect, it } from "vitest";
import {
  runMigrationsPerTransaction,
  runMigrationsPerTransactionThrough,
} from "./migrate-runner.js";
import { withTemporaryDatabase } from "./testing/temporary-database.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
/** The journal time of 0392, the migration before 0393. */
const THROUGH_0392 = 1812110400000;

/** 0394 is rolled back first (newest first), as a real rollback of 0393 would be. */
const rollbackSql = async () =>
  (
    await Promise.all(
      ["0394_rollback.sql", "0393_rollback.sql"].map((name) =>
        readFile(resolve(import.meta.dirname, "../drizzle", name), "utf8"),
      ),
    )
  ).join("\n");

async function seedPlace(
  pool: pg.Pool,
  userId: string,
  entityId: string,
  freeDays: number | null,
  chargePence: number | null,
): Promise<string> {
  const venue = await pool.query<{ id: string }>(
    `insert into venue (legal_entity_id, name, address_line1, city, postcode, country)
     values ($1, $2, '1 Test Street', 'London', 'W1W 6YW', 'GB') returning id`,
    [entityId, `Gallery ${randomUUID()}`],
  );
  const venueId = venue.rows[0]?.id as string;
  await pool.query(
    `insert into collection_place (venue_id, free_storage_days, storage_charge_pence, updated_by_user_id)
     values ($1, $2, $3, $4)`,
    [venueId, freeDays, chargePence, userId],
  );
  return venueId;
}

describe.skipIf(!url)("migration 0393 collection storage terms", { timeout: 180_000 }, () => {
  it("moves free days across, keeps the old columns, rolls back and applies again", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, THROUGH_0392);
      const userId = `u-${randomUUID()}`;
      await pool.query(
        `insert into "user" (id, name, email, created_at, updated_at) values ($1, 'Staff', $2, now(), now())`,
        [userId, `${userId}@example.test`],
      );
      const entity = await pool.query<{ id: string }>(
        `insert into legal_entity (kind, subkind, display_name, created_by_user_id)
         values ('organisation', 'gallery', 'Gallery', $1) returning id`,
        [userId],
      );
      const entityId = entity.rows[0]?.id as string;
      const normal = await seedPlace(pool, userId, entityId, 21, 2500);
      const long = await seedPlace(pool, userId, entityId, 200, null);
      const unset = await seedPlace(pool, userId, entityId, null, null);

      await runMigrationsPerTransaction(pool);

      const terms = await pool.query<{ venue_id: string; free_days: number; rate: number }>(
        "select venue_id, free_days, standard_daily_pence as rate from collection_storage_terms",
      );
      const byVenue = new Map(terms.rows.map((r) => [r.venue_id, r]));
      expect(byVenue.get(normal)).toMatchObject({ free_days: 21, rate: 0 });
      expect(byVenue.get(long)?.free_days).toBe(90);
      expect(byVenue.has(unset)).toBe(false);

      // Every moved place has a first audit row, with the original value in "before".
      const audit = await pool.query<{ venue_id: string; before: { freeStorageDays: number } }>(
        `select venue_id, before from collection_storage_audit where action = 'terms_migrated'`,
      );
      expect(audit.rows).toHaveLength(2);
      expect(audit.rows.find((r) => r.venue_id === long)?.before.freeStorageDays).toBe(200);

      // The old columns stay, so the release still running can select them.
      const kept = await pool.query<{
        storage_charge_pence: number | null;
        free_storage_days: number;
      }>(
        "select storage_charge_pence, free_storage_days from collection_place where venue_id = $1",
        [normal],
      );
      expect(kept.rows[0]).toEqual({ storage_charge_pence: 2500, free_storage_days: 21 });

      // Charging needs a VAT treatment, in the database too.
      await expect(
        pool.query(
          "update collection_place set raise_storage_invoices = true where venue_id = $1",
          [normal],
        ),
      ).rejects.toThrow(/charging_needs_vat/);

      // Rolling back removes the new objects and the ledger row, and leaves the old data alone.
      await pool.query(await rollbackSql());
      const tables = await pool.query(
        `select 1 from information_schema.tables where table_name like 'collection_storage_%'`,
      );
      expect(tables.rowCount).toBe(0);
      const left = await pool.query<{
        storage_charge_pence: number | null;
        free_storage_days: number;
      }>(
        "select storage_charge_pence, free_storage_days from collection_place where venue_id = $1",
        [normal],
      );
      expect(left.rows[0]).toEqual({ storage_charge_pence: 2500, free_storage_days: 21 });

      await runMigrationsPerTransaction(pool);
      const again = await pool.query("select 1 from collection_storage_terms");
      expect(again.rowCount).toBe(2);
    });
  });
});
