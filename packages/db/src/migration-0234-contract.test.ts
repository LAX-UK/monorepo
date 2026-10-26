import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { API_DENY_TABLES, API_READ_TABLES, WORKER_FULL_TABLES } from "./migrate-roles.js";
import { atgAuctionLink, atgLotLink } from "./schema/atg-sync.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(join(__dirname, "../drizzle/0234_atg_sale_settings.sql"), "utf8");
const rollback = readFileSync(join(__dirname, "../drizzle/0234_rollback.sql"), "utf8");
const journal = JSON.parse(
  readFileSync(join(__dirname, "../drizzle/meta/_journal.json"), "utf8"),
) as { entries: { tag: string; when: number }[] };

describe("migration 0234 atg sale settings contract", () => {
  it("is additive and idempotent", () => {
    expect(migration).not.toMatch(/\bDROP\b/);
    expect(migration.match(/ADD COLUMN IF NOT EXISTS/g)).toHaveLength(5);
    expect(migration.match(/EXCEPTION WHEN duplicate_object THEN NULL/g)).toHaveLength(2);
  });

  it("adds only columns declared in the Drizzle schema, and the rollback drops each", () => {
    const added = [...migration.matchAll(/ADD COLUMN IF NOT EXISTS "(\w+)"/g)].map((m) => m[1]);
    const declared = [
      ...Object.values(getTableColumns(atgAuctionLink)),
      ...Object.values(getTableColumns(atgLotLink)),
    ].map((c) => c.name);
    for (const column of added) {
      expect(declared, column).toContain(column);
      expect(rollback, column).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    }
  });

  it("follows 0233 in the journal with a later stamp", () => {
    const entries = journal.entries;
    const at = entries.findIndex((e) => e.tag === "0234_atg_sale_settings");
    expect(entries[at - 1]?.tag).toBe("0233_shop_order_reference_and_progress");
    expect(entries[at]?.when).toBe(1795593600000);
    expect(entries[at]?.when).toBeGreaterThan(entries[at - 1]?.when ?? Number.POSITIVE_INFINITY);
  });

  it("lets the API write the settings and the worker keep full DML on both link tables", () => {
    for (const table of ["atg_auction_link", "atg_lot_link"]) {
      expect(WORKER_FULL_TABLES).toContain(table);
      expect(API_DENY_TABLES as readonly string[]).not.toContain(table);
      expect(API_READ_TABLES as readonly string[]).not.toContain(table);
    }
  });
});
