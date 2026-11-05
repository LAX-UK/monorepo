import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0300_sale_test_flag.sql");
const rollback = read("0300_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0300 sale test flag", () => {
  it("is journaled after the entry before it", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0300_sale_test_flag");
    expect(at).toBeGreaterThan(0);
    expect(journal.entries[at]?.when).toBeGreaterThan(
      journal.entries[at - 1]?.when ?? Number.POSITIVE_INFINITY,
    );
  });

  it("adds a non-null boolean that defaults to false, so existing sales stay public", () => {
    expect(migration).toContain(
      'ADD COLUMN IF NOT EXISTS "is_test" boolean DEFAULT false NOT NULL',
    );
  });

  it("rolls back by dropping the column, refusing while a test sale exists", () => {
    expect(rollback).toContain('DROP COLUMN IF EXISTS "is_test"');
    expect(rollback).toContain("RAISE EXCEPTION");
  });
});
