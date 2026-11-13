import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0374_accounting_reference_per_target";
const migration = read(`${TAG}.sql`);
const rollback = read("0374_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const index = journal.entries.findIndex((e) => e.tag === TAG);
const entry = journal.entries[index];

describe("migration 0374 accounting reference per target", () => {
  it("is journalled once, right after the previous migration, with a later timestamp", () => {
    expect(index).toBeGreaterThan(0);
    expect(journal.entries.filter((e) => e.tag === TAG)).toHaveLength(1);
    expect(entry?.idx).toBe((journal.entries[index - 1]?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(
      journal.entries[index - 1]?.when ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it("adds the per-target key before it drops the per-reference index", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    const added = migration.indexOf('ADD CONSTRAINT "accounting_document_reference_target_uq"');
    const dropped = migration.indexOf('DROP INDEX IF EXISTS "accounting_document_reference_uid"');
    expect(added).toBeGreaterThan(0);
    expect(dropped).toBeGreaterThan(added);
    expect(migration).toMatch(
      /UNIQUE NULLS NOT DISTINCT \("product", "legal_entity", "lax_reference", "target_provider", "target_mode"\)/,
    );
    expect(migration).not.toMatch(/\bDELETE\b|\bUPDATE\b|\bINSERT\b|DROP TABLE|DISABLE TRIGGER/);
  });

  it("rolls back by restoring the per-reference index and never deletes documents", () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
    expect(rollback).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "accounting_document_reference_uid"',
    );
    expect(rollback).toContain(
      'DROP CONSTRAINT IF EXISTS "accounting_document_reference_target_uq"',
    );
    expect(rollback).not.toMatch(/DELETE FROM "?accounting_document/);
  });

  it("removes exactly its own ledger row, keyed on the journalled timestamp", () => {
    const deletes = [
      ...rollback.matchAll(/DELETE FROM drizzle\.__drizzle_migrations WHERE created_at = (\d+);/g),
    ];
    expect(deletes).toHaveLength(1);
    expect(Number(deletes[0]?.[1])).toBe(entry?.when);
  });
});
