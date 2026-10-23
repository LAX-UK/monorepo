import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { readUserReadCutover } from "./applied-user-read-cutover.js";
import { applyApplicationRoleGrants } from "./migrate-roles.js";
import {
  APPROVED_RELEASE_HEAD,
  RELEASE_TO_MAIN_SQL_MAPPING,
  assertApprovedReleaseHead,
  planReleaseLedgerNormalization,
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

  describe("ledger normalization plan", () => {
    const journal = JSON.parse(readFileSync(join(drizzleRoot, "meta/_journal.json"), "utf8")) as {
      entries: { tag: string; when: number }[];
    };
    const mainWhenByTag = new Map(journal.entries.map((entry) => [entry.tag, entry.when]));
    const productionLedger = RELEASE_TO_MAIN_SQL_MAPPING.map((mapping) => ({
      createdAt: mapping.releaseWhen,
      hash: mapping.sha256,
    }));

    it("covers release 0128 through 0133", () => {
      expect(RELEASE_TO_MAIN_SQL_MAPPING.map((mapping) => mapping.releaseTag.slice(0, 4))).toEqual([
        "0128",
        "0129",
        "0130",
        "0131",
        "0132",
        "0133",
      ]);
    });

    it("keeps the release ATG row at its stamp", () => {
      const step = planReleaseLedgerNormalization(productionLedger, mainWhenByTag).find(
        (candidate) => candidate.releaseTag === "0132_atg_sync_links",
      );
      expect(step).toMatchObject({
        action: "keep",
        fromWhen: 1788000007500,
        toWhen: 1788000007500,
      });
    });

    it("drops release 0133 so it cannot shadow main 0132, leaving main 0222 to apply", () => {
      const step = planReleaseLedgerNormalization(productionLedger, mainWhenByTag).find(
        (candidate) => candidate.releaseTag === "0133_two_factor_lockout_columns",
      );
      expect(step).toMatchObject({
        action: "replace",
        mainTag: "0222_two_factor_lockout_columns",
        fromWhen: 1788000008000,
        toWhen: null,
      });
      expect(mainWhenByTag.get("0132_domain_event_delivery")).toBe(1788000008000);
    });

    it("relabels release 0128 to 0131 onto main's renumbered stamps", () => {
      const relabelled = planReleaseLedgerNormalization(productionLedger, mainWhenByTag).filter(
        (step) => step.action === "relabel",
      );
      expect(relabelled.map((step) => step.toWhen)).toEqual([
        mainWhenByTag.get("0135_marketing_attribution"),
        mainWhenByTag.get("0137_user_category_interests"),
        mainWhenByTag.get("0138_buyer_interest_categories"),
        mainWhenByTag.get("0139_complete_buyer_interest_categories"),
      ]);
    });

    it("fails closed on a missing or divergent production row", () => {
      expect(() =>
        planReleaseLedgerNormalization(productionLedger.slice(0, 4), mainWhenByTag),
      ).toThrow(/no row at 1788000007500/);
      const divergent = productionLedger.map((row) =>
        row.createdAt === 1788000008000 ? { ...row, hash: "other" } : row,
      );
      expect(() => planReleaseLedgerNormalization(divergent, mainWhenByTag)).toThrow(
        /does not hold the 0133_two_factor_lockout_columns hash/,
      );
    });
  });

  it.skipIf(!migrationUrl)(
    "applies main migrations through 0161 on a disposable database",
    async () => {
      if (!migrationUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
      const databaseName = `release_main_${randomUUID().replaceAll("-", "")}`;
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

        await applyApplicationRoleGrants(databaseUrl.toString());

        const cutover = await readUserReadCutover(pool);
        expect(cutover.apiUserSelectRevoked).toBe(true);

        const userSelect = await pool.query<{ revoked: boolean }>(
          `select not has_table_privilege('api_app', 'public."user"', 'SELECT') as revoked`,
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
    120_000,
  );
});
