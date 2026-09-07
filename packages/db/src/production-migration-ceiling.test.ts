import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCTION_MIGRATION_THROUGH,
  PRODUCTION_MIGRATION_CEILING_BY_TAG,
  PRODUCTION_MIGRATION_THROUGH_ENV,
  PRODUCTION_MIGRATION_THROUGH_TAGS,
  resolveProductionMigrationCeiling,
  resolveProductionMigrationThrough,
} from "./production-migration-ceiling.js";

const journal = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../drizzle/meta/_journal.json"), "utf8"),
) as { entries: { tag: string; when: number }[] };

const migrateProd = readFileSync(resolve(import.meta.dirname, "migrate-prod.ts"), "utf8");
const migrateLocal = readFileSync(resolve(import.meta.dirname, "migrate.ts"), "utf8");

describe("production migration ceiling", () => {
  it("defaults production migrate through 0159", () => {
    const ceiling = resolveProductionMigrationCeiling({});

    expect(DEFAULT_PRODUCTION_MIGRATION_THROUGH).toBe("0159");
    expect(ceiling).toEqual({
      tag: "0159",
      folderMillis: PRODUCTION_MIGRATION_CEILING_BY_TAG["0159"].folderMillis,
    });
    expect(resolveProductionMigrationThrough({}, null)).toEqual(ceiling);
    expect(
      resolveProductionMigrationThrough(
        {},
        PRODUCTION_MIGRATION_CEILING_BY_TAG["0159"].folderMillis - 1,
      ),
    ).toEqual(ceiling);
    expect(
      resolveProductionMigrationThrough(
        { [PRODUCTION_MIGRATION_THROUGH_ENV]: "0159" },
        PRODUCTION_MIGRATION_CEILING_BY_TAG["0161"].folderMillis,
      ),
    ).toEqual(ceiling);
  });

  it("accepts staged promotion after the prior cutover is applied", () => {
    expect(
      resolveProductionMigrationThrough(
        { [PRODUCTION_MIGRATION_THROUGH_ENV]: "0160" },
        PRODUCTION_MIGRATION_CEILING_BY_TAG["0159"].folderMillis,
      ),
    ).toEqual({
      tag: "0160",
      folderMillis: PRODUCTION_MIGRATION_CEILING_BY_TAG["0160"].folderMillis,
    });
    expect(
      resolveProductionMigrationThrough(
        { [PRODUCTION_MIGRATION_THROUGH_ENV]: " 0161 " },
        PRODUCTION_MIGRATION_CEILING_BY_TAG["0160"].folderMillis,
      ),
    ).toEqual({
      tag: "0161",
      folderMillis: PRODUCTION_MIGRATION_CEILING_BY_TAG["0161"].folderMillis,
    });
  });

  it("fails closed on missing prior stage and invalid values", () => {
    expect(() =>
      resolveProductionMigrationThrough({ [PRODUCTION_MIGRATION_THROUGH_ENV]: "0160" }, null),
    ).toThrow(/until 0159 is already applied/);
    expect(() =>
      resolveProductionMigrationThrough(
        { [PRODUCTION_MIGRATION_THROUGH_ENV]: "0160" },
        PRODUCTION_MIGRATION_CEILING_BY_TAG["0159"].folderMillis - 1,
      ),
    ).toThrow(/until 0159 is already applied/);
    expect(() =>
      resolveProductionMigrationThrough(
        { [PRODUCTION_MIGRATION_THROUGH_ENV]: "0161" },
        PRODUCTION_MIGRATION_CEILING_BY_TAG["0159"].folderMillis,
      ),
    ).toThrow(/until 0160 is already applied/);
    expect(() =>
      resolveProductionMigrationCeiling({ [PRODUCTION_MIGRATION_THROUGH_ENV]: "" }),
    ).toThrow(/Invalid PRODUCTION_MIGRATION_THROUGH/);
    expect(() =>
      resolveProductionMigrationCeiling({ [PRODUCTION_MIGRATION_THROUGH_ENV]: "0162" }),
    ).toThrow(/Allowed values/);
    expect(() =>
      resolveProductionMigrationCeiling({ [PRODUCTION_MIGRATION_THROUGH_ENV]: "all" }),
    ).toThrow(/Allowed values/);
    expect(() =>
      resolveProductionMigrationCeiling({
        [PRODUCTION_MIGRATION_THROUGH_ENV]: "0160_revoke_worker_user_reads",
      }),
    ).toThrow(/Allowed values/);
  });

  it("binds ceiling stamps to the journal and the production entrypoint", () => {
    for (const tag of PRODUCTION_MIGRATION_THROUGH_TAGS) {
      const entry = journal.entries.find((item) => item.tag.startsWith(`${tag}_`));
      expect(entry?.when).toBe(PRODUCTION_MIGRATION_CEILING_BY_TAG[tag].folderMillis);
    }

    expect(migrateProd).toContain("resolveProductionMigrationThrough");
    expect(migrateProd).toContain("readLastAppliedFolderMillis");
    expect(migrateProd).toContain("runMigrationsPerTransactionThrough");
    expect(migrateProd).not.toMatch(/runMigrationsPerTransaction\(/);
    expect(migrateLocal).toContain("runMigrationsPerTransaction(");
    expect(migrateLocal).not.toContain("PRODUCTION_MIGRATION_THROUGH");
  });
});
