import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBuyerPremium, standardBuyerPremiumBands } from "@auction/validators";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
/** The rollback's statements without its own BEGIN/COMMIT, so the test's transaction holds them. */
const rollbackBody = read("0380_rollback.sql").replace(/^BEGIN;$|^COMMIT;$/gm, "");
const migration = read("0380_lot_premium_uses_sale.sql");

/** Everything runs inside one transaction that is rolled back at the end. */
describe.skipIf(!url)(
  "migration 0380 lot premium uses the sale's (database)",
  { timeout: 60_000 },
  () => {
    let client: pg.Client;
    let saleId: string;
    let bandedSaleId: string;
    let sellerId: string;
    let userId: string;

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

    async function insertLot(
      rate: string | null,
      opts: { sale?: string; status?: "active" | "ended"; sold?: boolean } = {},
    ): Promise<string> {
      const sold = opts.sold === true;
      const cols = ["sale_id", "seller_legal_entity_id", "status"];
      const values: unknown[] = [opts.sale ?? saleId, sellerId, opts.status ?? "draft"];
      if (rate !== null) {
        cols.push("buyer_premium_rate");
        values.push(rate);
      }
      if (sold) {
        cols.push("winner_id", "buyer_legal_entity_id");
        values.push(userId, sellerId);
      }
      const params = values.map((_, i) => `$${i + 1}`).join(", ");
      return one(
        `insert into lot (title, auction_type, starting_price, current_price, start_time, end_time, ${cols.join(", ")})
       values ('Lot', 'english', 0, ${sold ? "600000" : "0"}, now(), now() + interval '1 day', ${params}) returning id`,
        values,
      );
    }

    async function invoice(lotId: string, voided = false): Promise<void> {
      await client.query(
        `insert into bid_invoice (lot_id, buyer_legal_entity_id, seller_legal_entity_id, total_pence, raised_at, due_at, voided_at)
       values ($1, $2, $2, 66000000, now(), now() + interval '7 days', ${voided ? "now()" : "null"})`,
        [lotId, sellerId],
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
      userId = `u-${Date.now()}`;
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
      bandedSaleId = await one(
        `insert into sale (title, start_time, end_time, created_by_legal_entity_id, buyer_premium_rate, buyer_premium_tiers)
       values ('Banded sale', now(), now() + interval '1 day', $1, 0.25, $2) returning id`,
        [sellerId, JSON.stringify(standardBuyerPremiumBands())],
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

    it("keeps the rate of lots in a flat-rate sale, and the rollback refills only NULLs", async () => {
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

    it("puts every lot in a sale with bands back on the bands, invoiced or not; the rollback restores the exact rates", async () => {
      await client.query(rollbackBody);
      const sale = { buyerPremiumRate: "0.2500", buyerPremiumTiers: standardBuyerPremiumBands() };
      // Rows as the old schema left them: the old 25% default, and one explicit 30%.
      const banded = { sale: bandedSaleId, status: "ended" as const, sold: true };
      const active = await insertLot("0.2500", { sale: bandedSaleId, status: "active" });
      const explicit = await insertLot("0.3000", { sale: bandedSaleId });
      const soldNotInvoiced = await insertLot("0.2500", banded);
      const voidedOnly = await insertLot("0.2500", banded);
      await invoice(voidedOnly, true);
      const invoiced = await insertLot("0.2500", banded);
      await invoice(invoiced);
      const flat = await insertLot("0.2500", { status: "active" });
      const invoiceTotals = async () =>
        (
          await client.query<{ total: string }>(
            "select total_pence::text as total from bid_invoice where lot_id = any($1) order by lot_id, raised_at",
            [[voidedOnly, invoiced]],
          )
        ).rows.map((r) => r.total);
      const totalsBefore = await invoiceTotals();

      await client.query(migration);

      for (const lotId of [active, explicit, soldNotInvoiced, voidedOnly, invoiced]) {
        const lotRate = await rateOf(lotId);
        expect(lotRate).toBeNull();
        const { source, policy } = resolveBuyerPremium({ lotRate, sale });
        expect(source).toBe("sale_bands");
        // £600,000: 15% of £500,000 + 10% of £100,000, not the old 25% default.
        expect(policy.computePremiumMinor(60_000_000)).toBe(8_500_000);
      }
      expect(await rateOf(flat)).toBe("0.2500");
      // Raised invoices are frozen.
      expect(await invoiceTotals()).toEqual(totalsBefore);

      // The rollback gives every cleared lot back the exact rate it held, and drops the kept rates.
      await client.query(rollbackBody);
      expect(await column("lot")).toMatchObject({ is_nullable: "NO" });
      for (const lotId of [active, soldNotInvoiced, voidedOnly, invoiced, flat]) {
        expect(await rateOf(lotId)).toBe("0.2500");
      }
      expect(await rateOf(explicit)).toBe("0.3000");
      const kept = await client.query(
        "select to_regclass('drizzle.lot_premium_rate_before_0380') is not null as present",
      );
      expect(kept.rows[0]?.present).toBe(false);
      await client.query(migration);
      expect(await rateOf(invoiced)).toBeNull();
    });
  },
);
