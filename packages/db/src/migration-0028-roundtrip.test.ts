import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";

const url = process.env.MIGRATION_TEST_DATABASE_URL;

const __dirname = dirname(fileURLToPath(import.meta.url));

describe.skipIf(!url)("migration 0028 legal_entity_final_cutover roundtrip", () => {
  it("rollback then forward leaves schema consistent (legacy columns absent after forward)", async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      const forward = readFileSync(
        join(__dirname, "../drizzle/0028_legal_entity_final_cutover.sql"),
        "utf8",
      );
      const rollback = readFileSync(join(__dirname, "../drizzle/0028_rollback.sql"), "utf8");

      await client.query(rollback);
      await client.query(forward);
      await client.query(rollback);
      await client.query(forward);

      const legacyCols = await client.query<{ table_name: string; column_name: string }>(
        `select table_name, column_name from information_schema.columns
         where table_schema = 'public'
           and (
             (table_name = 'lot' and column_name = 'seller_id')
             or (table_name = 'item_submission' and column_name = 'seller_id')
             or (table_name = 'payment' and column_name = 'seller_id')
             or (table_name = 'sale' and column_name = 'created_by')
           )`,
      );
      expect(legacyCols.rows.length).toBe(0);

      const notNull = await client.query<{ table_name: string; column_name: string }>(
        `select table_name, column_name from information_schema.columns
         where table_schema = 'public' and is_nullable = 'NO'
           and (
             (table_name = 'lot' and column_name = 'seller_legal_entity_id')
             or (table_name = 'item_submission' and column_name = 'legal_entity_id')
             or (table_name = 'payment' and column_name in ('buyer_legal_entity_id','seller_legal_entity_id'))
             or (table_name = 'sale' and column_name = 'created_by_legal_entity_id')
           )`,
      );
      expect(notNull.rows.length).toBe(5);
    } finally {
      await client.end();
    }
  });
});
