import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { runMigrationsPerTransaction } from "./migrate-runner.js";
import { buildPgConnectionConfig } from "./ssl.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;

const __dirname = dirname(fileURLToPath(import.meta.url));

describe.skipIf(!url)("migration 0059 user_ui_preference roundtrip", () => {
  it("rollback then forward leaves table", async () => {
    if (!url) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
    const databaseName = `migration_0059_${randomUUID().replaceAll("-", "")}`;
    const adminUrl = new URL(url);
    adminUrl.pathname = "/postgres";
    const databaseUrl = new URL(url);
    databaseUrl.pathname = `/${databaseName}`;

    const admin = new pg.Client(buildPgConnectionConfig(adminUrl.toString()));
    await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    await admin.end();

    const client = new pg.Client(buildPgConnectionConfig(databaseUrl.toString()));
    await client.connect();
    try {
      const pool = new pg.Pool(buildPgConnectionConfig(databaseUrl.toString()));
      try {
        await runMigrationsPerTransaction(pool);
      } finally {
        await pool.end();
      }

      const forward = readFileSync(
        join(__dirname, "../drizzle/0059_user_ui_preference.sql"),
        "utf8",
      );
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
      const drop = new pg.Client(buildPgConnectionConfig(adminUrl.toString()));
      await drop.connect();
      await drop.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      await drop.end();
    }
  });
});
