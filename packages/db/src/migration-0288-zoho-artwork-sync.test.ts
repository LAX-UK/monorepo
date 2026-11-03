import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0288_zoho_artwork_sync.sql");
const rollback = read("0288_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0288 Zoho artwork sync", () => {
  it("is journal entry 288, after the entry before it", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0288_zoho_artwork_sync");
    expect(journal.entries[at]?.idx).toBe(288);
    expect(journal.entries[at]?.when).toBeGreaterThan(
      journal.entries[at - 1]?.when ?? Number.POSITIVE_INFINITY,
    );
  });

  it("creates both tables and drops them again", () => {
    for (const table of ["zoho_artwork_sync_state", "zoho_artwork_sync_outcome"]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
      expect(rollback).toContain(`DROP TABLE IF EXISTS "${table}"`);
    }
  });

  it("allows one outcome per Product per pass", () => {
    expect(migration).toContain('("run_id", "zoho_product_id")');
    expect(migration).toContain("CREATE UNIQUE INDEX");
  });

  it("limits modes and outcomes to the values the sync writes", () => {
    expect(migration).toContain(`"mode" IN ('dry_run', 'live')`);
    expect(migration).toContain(
      `"outcome" IN ('create', 'update', 'conflict', 'unchanged', 'stale', 'skipped')`,
    );
  });
});
