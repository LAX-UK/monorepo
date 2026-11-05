import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0303_zoho_listing_sync_run.sql");
const rollback = read("0303_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0303 Zoho listing sync run", () => {
  it("is journal entry 303, after the entry before it", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0303_zoho_listing_sync_run");
    expect(journal.entries[at]?.idx).toBe(303);
    expect(journal.entries[at]?.when).toBeGreaterThan(
      journal.entries[at - 1]?.when ?? Number.POSITIVE_INFINITY,
    );
  });

  it("creates the run table with its mode check and drops it again", () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "zoho_listing_sync_run"');
    expect(migration).toMatch(/"mode" IN \('dry_run', 'live'\)/);
    expect(rollback).toContain('DROP TABLE IF EXISTS "zoho_listing_sync_run"');
  });

  it("is additive", () => {
    expect(migration).not.toMatch(/\bDROP (TABLE|COLUMN)\b/);
  });
});
