import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) => readFileSync(join(drizzleDir, name), "utf8");
const TAG = "0408_item_submission_soft_delete";
/** The migration before this one. */
const PREVIOUS = "0407_consignor_agreement";
const migration = read(`${TAG}.sql`);
const rollback = read("0408_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0408 item submission soft delete", () => {
  it("is the next journal entry, and its rollback removes its own ledger row", () => {
    const entry = journal.entries.find((e) => e.tag === TAG);
    const previous = journal.entries.find((e) => e.tag === PREVIOUS);
    expect(entry?.idx).toBe((previous?.idx ?? Number.NaN) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    expect(rollback).toContain(`WHERE created_at = ${entry?.when};`);
  });

  it("adds a nullable deleted_at with no default, under a lock timeout", () => {
    expect(migration.indexOf("SET LOCAL lock_timeout")).toBeLessThan(
      migration.indexOf("ALTER TABLE"),
    );
    expect(migration).toContain(
      'ALTER TABLE "item_submission" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;',
    );
    // Nothing is rewritten or scanned under the lock: no NOT NULL, default, update, delete or index.
    expect(migration).not.toMatch(
      /NOT NULL;|DEFAULT|\bUPDATE\b|\bDELETE\b|DROP COLUMN|DROP TABLE|CREATE INDEX|VALIDATE/,
    );
  });

  it("lets only a draft be deleted, checked for new rows without a scan", () => {
    expect(migration).toMatch(/"deleted_at" IS NULL OR "status" = 'draft'\s*\) NOT VALID;/);
  });

  it("rolls back by removing deleted drafts, then the check and the column, in one transaction", () => {
    // Re-runnable: the delete only runs while the column exists.
    expect(rollback).toContain("column_name = 'deleted_at'");
    const removeRows = rollback.indexOf(
      `EXECUTE 'DELETE FROM "item_submission" WHERE "deleted_at" IS NOT NULL'`,
    );
    const dropColumn = rollback.indexOf('DROP COLUMN IF EXISTS "deleted_at"');
    expect(removeRows).toBeGreaterThan(-1);
    expect(dropColumn).toBeGreaterThan(removeRows);
    expect(rollback).toContain('DROP CONSTRAINT IF EXISTS "item_submission_deleted_draft_check"');
    expect(rollback.indexOf("SET LOCAL lock_timeout")).toBeLessThan(removeRows);
    expect(rollback).toMatch(/^BEGIN;$/m);
    expect(rollback).toMatch(/^COMMIT;$/m);
  });
});
