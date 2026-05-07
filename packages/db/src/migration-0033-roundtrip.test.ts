import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";

const url = process.env.MIGRATION_TEST_DATABASE_URL;

const __dirname = dirname(fileURLToPath(import.meta.url));

describe.skipIf(!url)("migration 0033 lot voided + archived_seller columns", () => {
  it("applies and rolls back column SQL companion", async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      const up = readFileSync(join(__dirname, "../drizzle/0033_lot_voided_archived_seller.sql"), "utf8");
      const down = readFileSync(join(__dirname, "../drizzle/0033_rollback.sql"), "utf8");

      await client.query(down);
      await client.query(up);

      const cols = await client.query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = 'lot'
         and column_name in ('voided_reason','archived_seller')`,
      );
      expect(cols.rows.map((r) => r.column_name).sort()).toEqual(["archived_seller", "voided_reason"]);

      await client.query(down);
      const after = await client.query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = 'lot'
         and column_name in ('voided_reason','archived_seller')`,
      );
      expect(after.rows.length).toBe(0);

      await client.query(up);
    } finally {
      await client.end();
    }
  });
});
