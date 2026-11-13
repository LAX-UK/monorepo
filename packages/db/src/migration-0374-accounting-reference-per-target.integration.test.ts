import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
const { Client } = pg;

const BASE = {
  product: "bid",
  legal_entity: "london_auction_xchange",
  kind: "contact",
  lax_reference: "LAX-BID-CON-0374",
  source_event_ref: "evt-0374",
  payload: "{}",
  net_pence: 0,
  vat_pence: 0,
  gross_pence: 0,
};

type Row = Record<string, unknown>;

/** Every probe runs inside one transaction that is rolled back at the end. */
describe.skipIf(!url)(
  "migration 0374 accounting reference per target (database)",
  { timeout: 30_000 },
  () => {
    let client: pg.Client;

    async function accepts(row: Row): Promise<boolean> {
      const columns = Object.keys(row);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      await client.query("savepoint probe");
      try {
        await client.query(
          `insert into accounting_document (${columns.map((c) => `"${c}"`).join(", ")}) values (${placeholders})`,
          Object.values(row),
        );
        await client.query("release savepoint probe");
        return true;
      } catch {
        await client.query("rollback to savepoint probe");
        return false;
      }
    }

    beforeAll(async () => {
      if (!url) return;
      client = new Client(buildPgConnectionConfig(url));
      await client.connect();
      await client.query("begin");
    });
    afterAll(async () => {
      if (!client) return;
      await client.query("rollback");
      await client.end();
    });

    it("keeps one document per reference and target, and one with no target", async () => {
      const dryRun = { ...BASE, target_provider: "books", target_mode: "dry_run" };
      const testOrg = { ...BASE, target_provider: "books", target_mode: "test_org" };
      expect(await accepts(dryRun)).toBe(true);
      expect(await accepts(dryRun)).toBe(false);
      expect(await accepts(testOrg)).toBe(true);
      expect(await accepts({ ...BASE, target_provider: "xero", target_mode: "live" })).toBe(true);
      expect(await accepts(BASE)).toBe(true);
      expect(await accepts(BASE)).toBe(false);
    });

    it("no longer has the per-reference index", async () => {
      const found = await client.query(
        "select 1 from pg_indexes where indexname = 'accounting_document_reference_uid'",
      );
      expect(found.rowCount).toBe(0);
    });
  },
);
