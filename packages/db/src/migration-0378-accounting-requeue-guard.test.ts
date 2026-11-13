import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0378_accounting_requeue_guard";
const migration = read(`${TAG}.sql`);
const rollback = read("0378_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const index = journal.entries.findIndex((e) => e.tag === TAG);
const entry = journal.entries[index];

describe("migration 0378 accounting requeue guard", () => {
  it("is journalled once, right after the previous migration, with a later timestamp", () => {
    expect(index).toBeGreaterThan(0);
    expect(journal.entries.filter((e) => e.tag === TAG)).toHaveLength(1);
    expect(entry?.idx).toBe((journal.entries[index - 1]?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(
      journal.entries[index - 1]?.when ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it("guards documents on UPDATE and history on INSERT, for the Bid API role only", () => {
    expect(migration).toMatch(/BEFORE UPDATE ON "accounting_document"\s/);
    expect(migration).toMatch(/BEFORE INSERT ON "accounting_document_event"\s/);
    expect(migration.match(/IF current_user <> 'api_app' THEN\s+RETURN NEW;/g)).toHaveLength(2);
    // A NULL in a rule must refuse, not slip through as "not false".
    expect(migration.match(/IF NOT COALESCE\(\(/g)).toHaveLength(2);
    expect(migration.match(/ERRCODE = 'insufficient_privilege'/g)).toHaveLength(2);
    expect(migration).not.toMatch(/SECURITY DEFINER/);
    expect(migration).not.toMatch(/\bDELETE FROM\b|\bUPDATE "|\bINSERT INTO\b|DROP TABLE|GRANT/);
  });

  it("allows only the requeue move and a requeue history row naming who asked", () => {
    expect(migration).toContain(`AND NEW."state" = 'pending'`);
    expect(migration).toContain(`AND NEW."attempts" = OLD."attempts"`);
    expect(migration).toContain(
      `AND NEW."provider_id" IS NULL AND NEW."provider_number" IS NULL AND NEW."pdf_ref" IS NULL`,
    );
    expect(migration).toContain(`NEW."action" = 'requeue'`);
    expect(migration).toContain(`AND NEW."detail" - 'requestedBy' = '{}'::jsonb`);
  });

  it("rolls back by dropping its triggers and functions, and removes exactly its ledger row", () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
    for (const name of [
      "accounting_document_api_requeue_only",
      "accounting_document_event_api_requeue_only",
    ]) {
      expect(rollback).toContain(`DROP TRIGGER IF EXISTS "${name}"`);
      expect(rollback).toContain(`DROP FUNCTION IF EXISTS "${name}"()`);
    }
    expect(rollback).not.toMatch(/DELETE FROM "?accounting_document/);
    const deletes = [
      ...rollback.matchAll(/DELETE FROM drizzle\.__drizzle_migrations WHERE created_at = (\d+);/g),
    ];
    expect(deletes).toHaveLength(1);
    expect(Number(deletes[0]?.[1])).toBe(entry?.when);
  });
});
