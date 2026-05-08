import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";

/** CI sets this alongside DATABASE_URL so local runs without Postgres skip cleanly. */
const url = process.env.MIGRATION_TEST_DATABASE_URL;

const __dirname = dirname(fileURLToPath(import.meta.url));

describe.skipIf(!url)("migration 0030 payout statement columns", () => {
  it("applies and rolls back SQL companion", async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      const up = readFileSync(join(__dirname, "../drizzle/0030_payout_statement_url.sql"), "utf8");
      const down = readFileSync(join(__dirname, "../drizzle/0030_rollback.sql"), "utf8");

      await client.query(down);
      await client.query(up);

      const cols = await client.query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = 'payout'
         and column_name in ('statement_url','statement_generation_error')`,
      );
      expect(cols.rows.map((r) => r.column_name).sort()).toEqual([
        "statement_generation_error",
        "statement_url",
      ]);

      await client.query(down);
      const after = await client.query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = 'payout'
         and column_name in ('statement_url','statement_generation_error')`,
      );
      expect(after.rows.length).toBe(0);

      await client.query(up);
    } finally {
      await client.end();
    }
  });
});
