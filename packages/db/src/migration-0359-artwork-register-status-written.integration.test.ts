import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) =>
  readFileSync(join(drizzleDir, name), "utf8")
    .replaceAll("--> statement-breakpoint", "")
    .replace("SET LOCAL lock_timeout = '30s';", "");

const REF_KIND: Record<string, string> = {
  bid_sale: "bid_lot",
  private_sale: "private_sale",
  lax_art: "shop_artwork",
};

/**
 * Runs against a database migrated to the head, inside one transaction that is always rolled
 * back: it steps 0359 back, seeds registers whose Status LAX wrote before the column existed, then
 * applies it again and checks the backfill.
 */
describe.skipIf(!migrationUrl)(
  "migration 0359 artwork register status written",
  { timeout: 30_000 },
  () => {
    let client: pg.Client;
    let seq = 0;

    async function addRegister(status: string | null, offerState?: string): Promise<string> {
      seq += 1;
      const row = await client.query(
        `insert into artwork_register
           (zoho_product_id, stock_code, kind, title, artist_name, artist_code, catalogue_status, offer_state, offer_ref_kind, offer_ref_id)
         values ($1, $2, 'original', 't', 'a', 'AAA', $3, coalesce($4, 'held'), $5, $6) returning id`,
        [
          `bf-${seq}`,
          `LAX-ORI-AAA-ART${seq}-26-${String(seq).padStart(4, "0")}`,
          status,
          offerState ?? null,
          offerState && offerState in REF_KIND ? REF_KIND[offerState] : null,
          offerState && offerState in REF_KIND ? `ref-${seq}` : null,
        ],
      );
      return row.rows[0].id;
    }

    async function writeback(id: string, to: string, at: string, field = "catalogueStatus") {
      await client.query(
        `insert into artwork_register_event (register_id, type, actor, payload, created_at)
         values ($1, 'zoho_writeback_recorded', 'system', $2::jsonb, $3)`,
        [id, JSON.stringify({ field, from: "Available", to }), at],
      );
    }

    async function written(id: string): Promise<string | null> {
      const row = await client.query(
        "select catalogue_status_written as w from artwork_register where id = $1",
        [id],
      );
      return row.rows[0].w;
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
      await client.query(read("0359_rollback.sql"));
    });

    it("seeds the Status LAX last wrote, so it no longer reads as a staff edit", async () => {
      const id = await addRegister("In Auction");
      await writeback(id, "Available", "2026-10-01T00:00:00Z");
      await writeback(id, "In Auction", "2026-10-02T00:00:00Z");
      await client.query(read("0359_artwork_register_status_written.sql"));
      expect(await written(id)).toBe("In Auction");
    });

    it("leaves a register empty when the latest write is no longer what Zoho shows", async () => {
      const id = await addRegister("Sold");
      await writeback(id, "In Auction", "2026-10-02T00:00:00Z");
      await client.query(read("0359_artwork_register_status_written.sql"));
      expect(await written(id)).toBeNull();
    });

    it("ignores a register LAX never wrote and other writeback fields", async () => {
      const never = await addRegister("Available");
      const other = await addRegister("Available");
      await writeback(other, "Available", "2026-10-02T00:00:00Z", "somethingElse");
      await client.query(read("0359_artwork_register_status_written.sql"));
      expect(await written(never)).toBeNull();
      expect(await written(other)).toBeNull();
    });

    it("seeds In Auction and Withdrawn that LAX wrote without an event, but not Sold or Reserved", async () => {
      const auction = await addRegister("In Auction", "bid_sale");
      const withdrawn = await addRegister("Withdrawn", "withdrawn");
      const staffSold = await addRegister("Sold", "sold");
      const staffReserved = await addRegister("Reserved", "private_sale");
      const mismatch = await addRegister("In Auction", "lax_art");
      await client.query(read("0359_artwork_register_status_written.sql"));
      expect(await written(auction)).toBe("In Auction");
      expect(await written(withdrawn)).toBe("Withdrawn");
      expect(await written(staffSold)).toBeNull();
      expect(await written(staffReserved)).toBeNull();
      expect(await written(mismatch)).toBeNull();
    });

    it("is idempotent and never overwrites a value already recorded", async () => {
      const seeded = await addRegister("In Auction");
      await writeback(seeded, "In Auction", "2026-10-02T00:00:00Z");
      const kept = await addRegister("In Auction");
      await writeback(kept, "In Auction", "2026-10-02T00:00:00Z");
      await client.query(read("0359_artwork_register_status_written.sql"));
      await client.query(
        "update artwork_register set catalogue_status_written = 'Withdrawn' where id = $1",
        [kept],
      );
      await client.query(read("0359_artwork_register_status_written.sql"));
      expect(await written(seeded)).toBe("In Auction");
      expect(await written(kept)).toBe("Withdrawn");
    });
  },
);
