import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";

const url = process.env.MIGRATION_TEST_DATABASE_URL;

const __dirname = dirname(fileURLToPath(import.meta.url));

describe.skipIf(!url)("migration 0041 org onboarding roundtrip", () => {
  it("rollback then forward leaves label column and progress table", async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      const forward = readFileSync(join(__dirname, "../drizzle/0041_org_onboarding.sql"), "utf8");
      const rollback = readFileSync(join(__dirname, "../drizzle/0041_rollback.sql"), "utf8");

      await client.query(rollback);
      await client.query(forward);
      await client.query(rollback);
      await client.query(forward);

      const labelCol = await client.query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = 'legal_entity_document' and column_name = 'label'`,
      );
      expect(labelCol.rows.length).toBe(1);

      const progressTable = await client.query<{ table_name: string }>(
        `select table_name from information_schema.tables
         where table_schema = 'public' and table_name = 'legal_entity_onboarding_progress'`,
      );
      expect(progressTable.rows.length).toBe(1);
    } finally {
      await client.end();
    }
  });
});
