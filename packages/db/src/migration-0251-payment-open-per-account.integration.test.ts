import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) =>
  readFileSync(join(drizzleDir, name), "utf8").replaceAll("--> statement-breakpoint", "");

const LOT = "51000000-0000-4000-8000-000000000001";
const ACCOUNT = "51000000-0000-4000-8000-0000000000a1";
const SELLER = "51000000-0000-4000-8000-0000000000b1";

/**
 * Runs in one transaction that is always rolled back. Foreign keys are switched off inside it so
 * the probe can hold payments for a lot and accounts that do not exist.
 */
describe.skipIf(!migrationUrl)(
  "migration 0251 open payment per account",
  { timeout: 30_000 },
  () => {
    let client: pg.Client;

    async function pay(id: string, buyer: string, status: string, minutesAgo: number) {
      await client.query(
        `insert into payment (id, lot_id, buyer_id, buyer_legal_entity_id, seller_legal_entity_id,
         amount, platform_fee, status, created_at)
       values ($1, $2, $3, $4, $5, 100, 5, $6, now() - make_interval(mins => $7))`,
        [id, LOT, buyer, ACCOUNT, SELLER, status, minutesAgo],
      );
    }

    async function statuses(): Promise<Record<string, string>> {
      const rows = await client.query("select id, status from payment where lot_id = $1", [LOT]);
      return Object.fromEntries(rows.rows.map((row) => [row.id, row.status]));
    }

    beforeAll(async () => {
      client = new pg.Client(buildPgConnectionConfig(migrationUrl as string));
      await client.connect();
    });

    afterAll(async () => {
      await client.query("rollback");
      await client.end();
    });

    beforeEach(async () => {
      await client.query("rollback");
      await client.query("begin");
      await client.query("set local session_replication_role = replica");
      await client.query(`drop index if exists "payment_lot_buyer_open_account_unique"`);
    });

    it("keeps the payment furthest along and cancels stale duplicates, then builds the index", async () => {
      const captured = "51000000-0000-4000-8000-000000000c01";
      const olderPending = "51000000-0000-4000-8000-000000000c02";
      const newerPending = "51000000-0000-4000-8000-000000000c03";
      await pay(captured, "member-a", "captured", 60);
      await pay(olderPending, "member-b", "pending", 30);
      await pay(newerPending, "member-c", "requires_manual_review", 5);

      await client.query(read("0251_payment_open_per_account.sql"));

      expect(await statuses()).toEqual({
        [captured]: "captured",
        [olderPending]: "cancelled",
        [newerPending]: "cancelled",
      });
      const index = await client.query(
        `select 1 from pg_indexes where indexname = 'payment_lot_buyer_open_account_unique'`,
      );
      expect(index.rowCount).toBe(1);
    });

    it("keeps the newest of two pending payments", async () => {
      const older = "51000000-0000-4000-8000-000000000d01";
      const newer = "51000000-0000-4000-8000-000000000d02";
      await pay(older, "member-a", "pending", 30);
      await pay(newer, "member-b", "pending", 5);

      await client.query(read("0251_payment_open_per_account.sql"));

      expect(await statuses()).toEqual({ [older]: "cancelled", [newer]: "pending" });
    });

    it("then refuses a second open payment for the same lot and account", async () => {
      await client.query(read("0251_payment_open_per_account.sql"));
      await pay("51000000-0000-4000-8000-000000000e01", "member-a", "pending", 1);
      await expect(
        pay("51000000-0000-4000-8000-000000000e02", "member-b", "pending", 0),
      ).rejects.toThrow(/payment_lot_buyer_open_account_unique/);
    });

    it("runs twice without harm", async () => {
      await client.query(read("0251_payment_open_per_account.sql"));
      await client.query(read("0251_payment_open_per_account.sql"));
    });
  },
);
