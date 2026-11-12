import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0359_reminder_candidate_indexes.sql");
const rollback = read("0359_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0359 reminder candidate indexes", () => {
  it("is journalled right after the previous migration, with a later timestamp", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0359_reminder_candidate_indexes");
    expect(index).toBeGreaterThan(0);
    expect(journal.entries[index]?.idx).toBe((journal.entries[index - 1]?.idx ?? 0) + 1);
    expect(journal.entries[index]?.when).toBeGreaterThan(journal.entries[index - 1]?.when ?? 0);
  });

  it("only adds indexes", () => {
    expect(migration.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(3);
    expect(migration).not.toMatch(/\bINSERT\b|\bUPDATE\b|\bDROP\b|\bALTER\b/);
  });

  it("rolls back by dropping each index", () => {
    expect(rollback.match(/DROP INDEX IF EXISTS/g)).toHaveLength(3);
  });
});
