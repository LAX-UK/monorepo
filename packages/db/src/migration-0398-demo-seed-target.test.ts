import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0398_demo_seed_target.sql");
const rollback = read("0398_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0398 demo seed target", () => {
  it("is the last entry, after 0397, and its rollback removes its own ledger row", () => {
    const entry = journal.entries.find((e) => e.tag === "0398_demo_seed_target");
    const previous = journal.entries.find((e) => e.tag === "0397_enquiry_inbound_replies");
    expect(entry).toBeDefined();
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    expect(rollback).toContain(`created_at" = ${entry?.when}`);
  });

  it("creates the table empty: no database is marked by the migration itself", () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "demo_seed_target"');
    expect(migration).not.toMatch(/INSERT INTO/i);
    expect(migration).toContain("\"environment\" IN ('test', 'local')");
    expect(migration).toContain('CHECK ("id")');
  });

  it("has a rollback that drops the table", () => {
    expect(rollback).toContain('DROP TABLE IF EXISTS "demo_seed_target"');
    expect(rollback).toContain('DELETE FROM drizzle."__drizzle_migrations"');
  });
});
