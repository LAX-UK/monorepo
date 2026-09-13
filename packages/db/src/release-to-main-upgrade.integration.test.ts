import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";
import {
  APPROVED_RELEASE_HEAD,
  RELEASE_TO_MAIN_SQL_MAPPING,
  assertApprovedReleaseHead,
} from "./release-lineage-mapping.js";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const drizzleRoot = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");

function sqlHash(tag: string): string {
  return createHash("sha256")
    .update(readFileSync(join(drizzleRoot, `${tag}.sql`)))
    .digest("hex");
}

describe("release to main lineage adoption", () => {
  it("recognizes only the approved release head", () => {
    expect(() => assertApprovedReleaseHead(APPROVED_RELEASE_HEAD)).not.toThrow();
    expect(() => assertApprovedReleaseHead("0".repeat(40))).toThrow(/fail-closed/);
  });

  it("verifies byte-identical renumbered SQL mapping", () => {
    for (const mapping of RELEASE_TO_MAIN_SQL_MAPPING) {
      expect(sqlHash(mapping.mainTag)).toBe(mapping.sha256);
    }
  });

  it.skipIf(!migrationUrl)(
    "applies main migrations through 0161 on a disposable database",
    async () => {
      if (!migrationUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
      const databaseName = `release_main_${Date.now()}`;
      const adminUrl = new URL(migrationUrl);
      adminUrl.pathname = "/postgres";
      const databaseUrl = new URL(migrationUrl);
      databaseUrl.pathname = `/${databaseName}`;

      const admin = new pg.Client(buildPgConnectionConfig(adminUrl.toString()));
      await admin.connect();
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      await admin.end();

      const pool = new pg.Pool(buildPgConnectionConfig(databaseUrl.toString()));
      try {
        const { runMigrationsPerTransactionThrough } = await import("./migrate-runner.js");
        const journal = JSON.parse(readFileSync(join(drizzleRoot, "meta/_journal.json"), "utf8"));
        const head = journal.entries.at(-1);
        await runMigrationsPerTransactionThrough(pool, head.when);

        const applied = await pool.query<{ count: string }>(
          "select count(*)::text as count from drizzle.__drizzle_migrations",
        );
        expect(Number(applied.rows[0]?.count ?? 0)).toBeGreaterThan(150);

        const userSelect = await pool.query<{ revoked: boolean }>(
          "select not has_table_privilege('api_app', 'public.user', 'SELECT') as revoked",
        );
        expect(userSelect.rows[0]?.revoked).toBe(true);
      } finally {
        await pool.end();
        const drop = new pg.Client(buildPgConnectionConfig(adminUrl.toString()));
        await drop.connect();
        await drop.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
        await drop.end();
      }
    },
  );
});
