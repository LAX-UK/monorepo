import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";

const url = process.env.MIGRATION_TEST_DATABASE_URL;

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = (file: string) => readFileSync(join(__dirname, "../drizzle", file), "utf8");

describe.skipIf(!url)("migration 0234 atg sale settings roundtrip", () => {
  it("is idempotent, reversible and constrains the settings", async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      const forward = sql("0234_atg_sale_settings.sql");
      const rollback = sql("0234_rollback.sql");

      await client.query(forward);
      await client.query(rollback);
      await client.query(forward);
      await client.query(forward);

      const columns = await client.query<{ column_name: string; column_default: string | null }>(
        `select column_name, column_default from information_schema.columns
         where table_schema = 'public'
           and ((table_name = 'atg_auction_link'
                 and column_name in ('atg_approved_at', 'auction_type', 'distribution', 'settings_updated_at', 'settings_updated_by'))
             or (table_name = 'atg_lot_link' and column_name = 'locked_fields_hash'))
         order by column_name`,
      );
      expect(columns.rows).toEqual([
        { column_name: "atg_approved_at", column_default: null },
        { column_name: "auction_type", column_default: "'Timed'::text" },
        { column_name: "distribution", column_default: "'private_test'::text" },
        { column_name: "locked_fields_hash", column_default: null },
        { column_name: "settings_updated_at", column_default: null },
        { column_name: "settings_updated_by", column_default: null },
      ]);

      const checks = await client.query<{ conname: string }>(
        `select conname from pg_constraint
         where conrelid = 'atg_auction_link'::regclass and contype = 'c' order by conname`,
      );
      expect(checks.rows.map((r) => r.conname)).toEqual([
        "atg_auction_link_auction_type_check",
        "atg_auction_link_distribution_check",
      ]);
    } finally {
      await client.end();
    }
  });
});
