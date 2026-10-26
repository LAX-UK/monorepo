import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { WORKER_FULL_TABLES } from "./migrate-roles.js";
import { atgAuctionLink, atgLotLink } from "./schema/atg-sync.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(join(__dirname, "../drizzle/0132_atg_sync_links.sql"), "utf8");
const rollback = readFileSync(join(__dirname, "../drizzle/0132_rollback.sql"), "utf8");
const settingsMigration = readFileSync(
  join(__dirname, "../drizzle/0133_atg_sale_settings.sql"),
  "utf8",
);
const settingsRollback = readFileSync(join(__dirname, "../drizzle/0133_rollback.sql"), "utf8");
const journal = JSON.parse(
  readFileSync(join(__dirname, "../drizzle/meta/_journal.json"), "utf8"),
) as { entries: { tag: string; when: number }[] };

function columnNames(table: typeof atgAuctionLink | typeof atgLotLink): string[] {
  return Object.values(getTableColumns(table)).map((c) => c.name);
}

describe("migrations 0132-0133 atg sync links contract", () => {
  it("is additive and idempotent", () => {
    expect(migration).not.toMatch(/\b(ALTER TABLE|DROP)\b/);
    expect(migration.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(2);
    expect(migration.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(2);
  });

  it.each([
    ["atg_auction_link", atgAuctionLink],
    ["atg_lot_link", atgLotLink],
  ] as const)("creates every %s column declared in the Drizzle schema", (tableName, table) => {
    const block = migration.split(`CREATE TABLE IF NOT EXISTS "${tableName}"`)[1]?.split(");")[0];
    expect(block).toBeDefined();
    for (const column of columnNames(table)) {
      const added = settingsMigration.includes(
        `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${column}"`,
      );
      expect(added || block?.includes(`"${column}"`), `${tableName}.${column}`).toBe(true);
    }
  });

  it("0133 is additive and idempotent, and its rollback drops what it adds", () => {
    expect(settingsMigration).not.toMatch(/\bDROP\b/);
    const added = [...settingsMigration.matchAll(/ADD COLUMN IF NOT EXISTS "(\w+)"/g)].map(
      (m) => m[1],
    );
    expect(added).toHaveLength(5);
    expect(settingsMigration.match(/EXCEPTION WHEN duplicate_object THEN NULL/g)).toHaveLength(2);
    for (const column of added) {
      expect(settingsRollback, column).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    }
  });

  it("cascades link rows with their sale and lot", () => {
    expect(migration).toContain('REFERENCES "public"."sale"("id") ON DELETE cascade');
    expect(migration).toContain('REFERENCES "public"."lot"("id") ON DELETE cascade');
    expect(migration).toContain(
      'REFERENCES "public"."atg_auction_link"("sale_id") ON DELETE cascade',
    );
  });

  it("rolls back child table first", () => {
    expect(rollback.indexOf('"atg_lot_link"')).toBeLessThan(rollback.indexOf('"atg_auction_link"'));
  });

  it("sorts before main's 0132_domain_event_delivery (1788000008000) so main's migrations still apply after an upgrade", () => {
    const links = journal.entries.find((e) => e.tag === "0132_atg_sync_links");
    const settings = journal.entries.find((e) => e.tag === "0133_atg_sale_settings");
    expect(links?.when).toBeGreaterThan(1788000007000);
    expect(settings?.when).toBeGreaterThan(links?.when ?? Number.POSITIVE_INFINITY);
    expect(settings?.when).toBeLessThan(1788000008000);
  });

  it("grants worker_app full DML on both link tables", () => {
    expect(WORKER_FULL_TABLES).toContain("atg_auction_link");
    expect(WORKER_FULL_TABLES).toContain("atg_lot_link");
  });
});
