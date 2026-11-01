import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { LATE_REGISTERED_FOLDER_MILLIS } from "./late-registered-migrations.js";
import { WORKER_FULL_TABLES } from "./migrate-roles.js";
import { RELEASE_LINEAGE_ADOPTIONS } from "./release-lineage-mapping.js";
import { atgAuctionLink, atgLotLink } from "./schema/atg-sync.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TAG = "0131a_atg_sync_links";
const migrationBytes = readFileSync(join(__dirname, `../drizzle/${TAG}.sql`));
const migration = migrationBytes.toString("utf8");
const rollback = readFileSync(join(__dirname, "../drizzle/0131a_rollback.sql"), "utf8");
const settingsMigration = readFileSync(
  join(__dirname, "../drizzle/0234_atg_sale_settings.sql"),
  "utf8",
);

function columnNames(table: typeof atgAuctionLink | typeof atgLotLink): string[] {
  return Object.values(getTableColumns(table)).map((c) => c.name);
}

describe("migration 0131a atg sync links contract", () => {
  it("is additive and idempotent", () => {
    expect(migration).not.toMatch(/\b(ALTER TABLE|DROP)\b/);
    expect(migration.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(2);
    expect(migration.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(2);
  });

  it("is byte-identical to release 0132_atg_sync_links so production's ledger hash matches", () => {
    const mapping = RELEASE_LINEAGE_ADOPTIONS.find(
      (candidate) => candidate.releaseTag === "0132_atg_sync_links",
    );
    expect(mapping?.mainTag).toBe(TAG);
    expect(createHash("sha256").update(migrationBytes).digest("hex")).toBe(mapping?.sha256);
  });

  it.each([
    ["atg_auction_link", atgAuctionLink],
    ["atg_lot_link", atgLotLink],
  ] as const)(
    "creates or adds (0234) every %s column declared in the Drizzle schema",
    (tableName, table) => {
      const block = migration.split(`CREATE TABLE IF NOT EXISTS "${tableName}"`)[1]?.split(");")[0];
      expect(block).toBeDefined();
      for (const column of columnNames(table)) {
        const added = settingsMigration.includes(
          `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${column}"`,
        );
        expect(added || block?.includes(`"${column}"`), `${tableName}.${column}`).toBe(true);
      }
    },
  );

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

  it("is registered between main 0131 and 0132 at release's stamp, as a late-registered migration", () => {
    const journal = JSON.parse(
      readFileSync(join(__dirname, "../drizzle/meta/_journal.json"), "utf8"),
    ) as { entries: { tag: string; when: number }[] };
    const tags = journal.entries.map((e) => e.tag);
    const at = tags.indexOf(TAG);
    expect(tags[at - 1]).toBe("0131_stripe_connect_requirements_errors");
    expect(tags[at + 1]).toBe("0132_domain_event_delivery");
    expect(journal.entries[at]?.when).toBe(1788000007500);
    expect(LATE_REGISTERED_FOLDER_MILLIS.has(1788000007500)).toBe(true);
    expect(LATE_REGISTERED_FOLDER_MILLIS.size).toBe(1);
  });

  it("grants worker_app full DML on both link tables", () => {
    expect(WORKER_FULL_TABLES).toContain("atg_auction_link");
    expect(WORKER_FULL_TABLES).toContain("atg_lot_link");
  });
});
