import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";

const url = process.env.MIGRATION_TEST_DATABASE_URL;

const __dirname = dirname(fileURLToPath(import.meta.url));

describe.skipIf(!url)("migration 0059 user_ui_preference roundtrip", () => {
  it("rollback then forward leaves table", async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      const forward = readFileSync(join(__dirname, "../drizzle/0059_user_ui_preference.sql"), "utf8");
      const rollback = readFileSync(join(__dirname, "../drizzle/0059_rollback.sql"), "utf8");

      await client.query(rollback);
      await client.query(forward);
      await client.query(rollback);
      await client.query(forward);

      const t = await client.query<{ table_name: string }>(
        `select table_name from information_schema.tables
         where table_schema = 'public' and table_name = 'user_ui_preference'`,
      );
      expect(t.rows.length).toBe(1);
    } finally {
      await client.end();
    }
  });
});
