import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";

const url = process.env.MIGRATION_TEST_DATABASE_URL;

const __dirname = dirname(fileURLToPath(import.meta.url));

const sql = (file: string) => readFileSync(join(__dirname, "../drizzle", file), "utf8");

// One file, so the ATG migrations run in order and leave the shared CI database fully migrated
// for the integration tests that use these tables.
describe.skipIf(!url)("ATG migrations 0132-0133 roundtrip", () => {
  async function withClient(run: (client: pg.Client) => Promise<void>) {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      await run(client);
    } finally {
      await client.end();
    }
  }

  it("0132: rollback then forward leaves both tables", async () => {
    await withClient(async (client) => {
      const forward = sql("0132_atg_sync_links.sql");
      const rollback = sql("0132_rollback.sql");

      await client.query(rollback);
      await client.query(forward);
      await client.query(rollback);
      await client.query(forward);
      await client.query(forward);
      await client.query(sql("0133_atg_sale_settings.sql"));

      const t = await client.query<{ table_name: string }>(
        `select table_name from information_schema.tables
         where table_schema = 'public' and table_name in ('atg_auction_link', 'atg_lot_link')
         order by table_name`,
      );
      expect(t.rows.map((r) => r.table_name)).toEqual(["atg_auction_link", "atg_lot_link"]);
    });
  });

  it("0133: is idempotent, reversible and constrains the settings", async () => {
    await withClient(async (client) => {
      const forward = sql("0133_atg_sale_settings.sql");
      const rollback = sql("0133_rollback.sql");

      await client.query(forward);
      await client.query(rollback);
      await client.query(forward);
      await client.query(forward);

      const columns = await client.query<{ column_name: string; column_default: string | null }>(
        `select column_name, column_default from information_schema.columns
         where table_schema = 'public'
           and ((table_name = 'atg_auction_link'
                 and column_name in ('auction_type', 'distribution', 'settings_updated_at', 'settings_updated_by'))
             or (table_name = 'atg_lot_link' and column_name = 'locked_fields_hash'))
         order by column_name`,
      );
      expect(columns.rows).toEqual([
        { column_name: "auction_type", column_default: "'Timed'::text" },
        { column_name: "distribution", column_default: "'private_test'::text" },
        { column_name: "locked_fields_hash", column_default: null },
        { column_name: "settings_updated_at", column_default: null },
        { column_name: "settings_updated_by", column_default: null },
      ]);

      const checks = await client.query<{ conname: string; def: string }>(
        `select conname, pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'atg_auction_link'::regclass and contype = 'c' order by conname`,
      );
      expect(checks.rows.map((r) => r.conname)).toEqual([
        "atg_auction_link_auction_type_check",
        "atg_auction_link_distribution_check",
      ]);
      expect(checks.rows[0]?.def).not.toContain("Catalogue");
    });
  });
});
