import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0371_reminder_candidate_indexes";
const migration = read(`${TAG}.sql`);
const rollback = read("0371_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const index = journal.entries.findIndex((e) => e.tag === TAG);
const entry = journal.entries[index];

describe("migration 0371 reminder candidate indexes", () => {
  it("is journalled right after the previous migration, with a later timestamp", () => {
    expect(index).toBeGreaterThan(0);
    expect(entry?.idx).toBe((journal.entries[index - 1]?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(journal.entries[index - 1]?.when ?? 0);
  });

  it("only adds indexes", () => {
    expect(migration.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(3);
    expect(migration).not.toMatch(/\bINSERT\b|\bUPDATE\b|\bDROP\b|\bALTER\b/);
  });

  it("rolls back by dropping each index", () => {
    expect(rollback.match(/DROP INDEX IF EXISTS/g)).toHaveLength(3);
  });

  it("removes exactly its own ledger row, keyed on the journalled timestamp", () => {
    const deletes = [
      ...rollback.matchAll(/DELETE FROM drizzle\.__drizzle_migrations WHERE created_at = (\d+);/g),
    ];
    expect(deletes).toHaveLength(1);
    expect(Number(deletes[0]?.[1])).toBe(entry?.when);
  });
});
