import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0311_artwork_register_print_code.sql");
const rollback = read("0311_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0311 artwork register print code", () => {
  it("is journal entry 311, later than the entry before it", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0311_artwork_register_print_code");
    expect(journal.entries[at]?.idx).toBe(311);
    expect(journal.entries[at]?.when).toBeGreaterThan(
      journal.entries[at - 1]?.when ?? Number.POSITIVE_INFINITY,
    );
  });

  it("accepts ORI, PRI and PRT in the stock code check", () => {
    expect(migration).toContain("^LAX-(ORI|PRI|PRT)-");
  });

  it("rolls back to ORI and PRI, refusing while a PRT code exists", () => {
    expect(rollback).toContain("RAISE EXCEPTION");
    expect(rollback).toContain("LIKE 'LAX-PRT-%'");
    expect(rollback.slice(rollback.lastIndexOf("ADD CONSTRAINT"))).toContain("^LAX-(ORI|PRI)-");
  });
});
