import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0343_collection_visit_cap.sql");
const rollback = read("0343_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0343 collection visit cap", () => {
  it("follows the migration before it in the journal, one day later", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0343_collection_visit_cap");
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    // Whatever is last on main when this lands.
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 24 * 60 * 60 * 1000);
  });

  it("only adds one defaulted column and its check, with a short lock timeout", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS "max_active_visits" smallint DEFAULT 5 NOT NULL/,
    );
    expect(migration).toMatch(/CHECK \("max_active_visits" BETWEEN 1 AND 20\)/);
    expect(migration).not.toMatch(/\bTRUNCATE\b|DELETE FROM|UPDATE "|DROP COLUMN|DROP TABLE/);
  });

  it("rolls back by dropping the check and the column", () => {
    expect(rollback).toMatch(/DROP CONSTRAINT IF EXISTS "collection_place_visit_cap_check"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "max_active_visits"/);
  });
});
