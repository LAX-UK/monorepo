import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";

const url = process.env.MIGRATION_TEST_DATABASE_URL;

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = (file: string) => readFileSync(join(__dirname, "../drizzle", file), "utf8");

describe.skipIf(!url)("migration 0242 payout reversal lines", () => {
  it("lets a reversal line go without a payment, and rolls back to the earlier rule", async () => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const definition = async () => {
      const { rows } = await client.query<{ def: string }>(
        `select pg_get_constraintdef(oid) as def from pg_constraint
         where conname = 'payout_line_payment_required'`,
      );
      return rows[0]?.def ?? "";
    };
    try {
      await client.query("begin");
      await client.query(sql("0242_payout_line_reversal_payment.sql"));
      expect(await definition()).toContain("'reversal'");

      await client.query(sql("0242_rollback.sql"));
      const rolledBack = await definition();
      expect(rolledBack).not.toContain("'reversal'");
      expect(rolledBack).toContain("'chargeback'");

      await client.query(sql("0242_payout_line_reversal_payment.sql"));
      expect(await definition()).toContain("'reversal'");
    } finally {
      await client.query("rollback");
      await client.end();
    }
  });
});
