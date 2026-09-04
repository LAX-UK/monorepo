import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { buildPgConnectionConfig } from "../ssl.js";

const { Client } = pg;

async function main(): Promise<void> {
  const migration = process.argv[2];
  const connectionString = process.env.MIGRATION_TEST_DATABASE_URL;
  if (!migration) throw new Error("migration name argument is required");
  if (!/^\d{4}_[a-z0-9_]+$/.test(migration)) throw new Error("invalid migration name");
  if (!connectionString) throw new Error("MIGRATION_TEST_DATABASE_URL is required");

  const drizzleDir = resolve(import.meta.dirname, "../../drizzle");
  const [forward, rollback] = await Promise.all([
    readFile(resolve(drizzleDir, `${migration}.sql`), "utf8"),
    readFile(resolve(drizzleDir, `${migration.slice(0, 4)}_rollback.sql`), "utf8"),
  ]);
  const client = new Client(buildPgConnectionConfig(connectionString));
  await client.connect();
  try {
    await client.query("begin");
    await client.query(rollback.replaceAll("--> statement-breakpoint", ""));
    await client.query(forward.replaceAll("--> statement-breakpoint", ""));
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
  console.log(`${migration} forward/rollback pair verified`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
