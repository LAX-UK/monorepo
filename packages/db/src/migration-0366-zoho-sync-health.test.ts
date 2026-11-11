import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0366_zoho_sync_health.sql");
const rollback = read("0366_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0366 Zoho sync health", () => {
  it("is journal entry 349, after the entry before it", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0366_zoho_sync_health");
    expect(journal.entries[at]?.idx).toBe(349);
    expect(journal.entries[at]?.when).toBeGreaterThan(
      journal.entries[at - 1]?.when ?? Number.POSITIVE_INFINITY,
    );
  });

  it("creates the one-row health table and the newest-result index, and drops both again", () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "zoho_sync_health"');
    expect(migration).toContain(`CHECK ("id" = 'zoho')`);
    expect(migration).toContain('"zoho_artwork_sync_outcome_product_recorded_idx"');
    expect(rollback).toContain('DROP TABLE IF EXISTS "zoho_sync_health"');
    expect(rollback).toContain(
      'DROP INDEX IF EXISTS "zoho_artwork_sync_outcome_product_recorded_idx"',
    );
  });

  it("is additive", () => {
    expect(migration).not.toMatch(/\bDROP (TABLE|COLUMN)\b/);
  });
});
