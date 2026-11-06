import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { buildPgConnectionConfig } from "../src/ssl.js";

/**
 * Runs backfill-bid-invoices.sql in one transaction against DATABASE_URL, then reports how many
 * payments are still without an invoice. Safe to run again.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const sql = await readFile(resolve(import.meta.dirname, "backfill-bid-invoices.sql"), "utf8");
  const client = new pg.Client(buildPgConnectionConfig(url));
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query(sql);
    await client.query("COMMIT");
    const left = await client.query<{ n: string }>(
      "select count(*)::text as n from payment where invoice_id is null and amount > 0",
    );
    console.log(`payments without an invoice: ${left.rows[0]?.n}`);
    if (left.rows[0]?.n !== "0") process.exitCode = 1;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
