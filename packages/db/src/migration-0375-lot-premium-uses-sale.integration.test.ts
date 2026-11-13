import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
/** The rollback's statements without its own BEGIN/COMMIT, so the test's transaction holds them. */
const rollbackBody = read("0375_rollback.sql").replace(/^BEGIN;$|^COMMIT;$/gm, "");
const migration = read("0375_lot_premium_uses_sale.sql");

/** Everything runs inside one transaction that is rolled back at the end. */
describe.skipIf(!url)(
  "migration 0375 lot premium uses the sale's (database)",
  { timeout: 60_000 },
  () => {
    let client: pg.Client;
    let saleId: string;
    let sellerId: string;

    const one = async (text: string, values: unknown[] = []) =>
      (await client.query<{ id: string }>(text, values)).rows[0]?.id as string;

    async function column(table: string) {
      const { rows } = await client.query<{ is_nullable: string; column_default: string | null }>(
        `select is_nullable, column_default from information_schema.columns
        where table_schema = 'public' and table_name = $1 and column_name = 'buyer_premium_rate'`,
        [table],
      );
      return rows[0];
    }

    async function insertLot(rate: string | null): Promise<string> {
      return one(
        `insert into lot (sale_id, title, auction_type, starting_price, current_price, start_time, end_time, seller_legal_entity_id${rate === null ? "" : ", buyer_premium_rate"})
       values ($1, 'Lot', 'english', 0, 0, now(), now() + interval '1 day', $2${rate === null ? "" : ", $3"}) returning id`,
        rate === null ? [saleId, sellerId] : [saleId, sellerId, rate],
      );
    }

    async function rateOf(lotId: string): Promise<string | null> {
      const { rows } = await client.query<{ rate: string | null }>(
        "select buyer_premium_rate::text as rate from lot where id = $1",
        [lotId],
      );
      return rows[0]?.rate ?? null;
    }

    beforeAll(async () => {
      if (!url) return;
      client = new Client(buildPgConnectionConfig(url));
      await client.connect();
      await client.query("begin");
      const userId = `u-${Date.now()}`;
      await client.query(
        `insert into "user" (id, name, email, created_at, updated_at)
       values ($1, 'Seller', $2, now(), now())`,
        [userId, `${userId}@example.test`],
      );
      sellerId = await one(
        `insert into legal_entity (kind, subkind, display_name, created_by_user_id)
       values ('organisation', 'gallery', $1, $2) returning id`,
        [`Seller gallery ${Date.now()}`, userId],
      );
      saleId = await one(
        `insert into sale (title, start_time, end_time, created_by_legal_entity_id, buyer_premium_rate)
       values ('Sale', now(), now() + interval '1 day', $1, 0.2) returning id`,
        [sellerId],
      );
    });

    afterAll(async () => {
      if (!client) return;
      await client.query("rollback");
      await client.end();
    });

    it("leaves the lot rate nullable with no default, and new sales default to 15%", async () => {
      expect(await column("lot")).toEqual({ is_nullable: "YES", column_default: null });
      expect((await column("sale"))?.column_default).toMatch(/^0\.15/);
      expect(await rateOf(await insertLot(null))).toBeNull();
    });

    it("keeps every existing lot's rate through the migration, and the rollback refills only NULLs", async () => {
      await client.query(rollbackBody);
      expect(await column("lot")).toMatchObject({ is_nullable: "NO" });
      // Rows written under the old schema: an explicit 25% and the old 25% default.
      const explicit = await insertLot("0.2500");
      const defaulted = await insertLot(null);
      expect(await rateOf(defaulted)).toBe("0.2500");

      await client.query(migration);
      expect(await rateOf(explicit)).toBe("0.2500");
      expect(await rateOf(defaulted)).toBe("0.2500");
      const usesSale = await insertLot(null);
      expect(await rateOf(usesSale)).toBeNull();

      await client.query(rollbackBody);
      expect(await rateOf(usesSale)).toBe("0.2000");
      expect(await rateOf(explicit)).toBe("0.2500");
      await client.query(migration);
    });
  },
);
