import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0393_collection_storage_terms.sql");
const rollback = read("0393_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0393 collection storage terms", () => {
  it("follows the migration before it in the journal, one day later", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0393_collection_storage_terms");
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 24 * 60 * 60 * 1000);
  });

  it("creates the five new tables and the new columns, with a short lock timeout", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    for (const table of [
      "collection_storage_terms",
      "collection_storage_extension",
      "collection_storage_waiver",
      "collection_storage_audit",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
    }
    expect(migration).toMatch(/"raise_storage_invoices" boolean DEFAULT false NOT NULL/);
    expect(migration).toMatch(/"storage_large" boolean DEFAULT false NOT NULL/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "storage_terms_id" uuid;/);
  });

  it("stops charging being on while the VAT treatment is unchosen", () => {
    expect(migration).toMatch(
      /CHECK \(NOT "raise_storage_invoices" OR "storage_vat_treatment" IS NOT NULL\)/,
    );
  });

  it("moves free_storage_days across without dropping it, and drops the weekly charge", () => {
    expect(migration).toMatch(/WHERE p\."free_storage_days" IS NOT NULL/);
    expect(migration).not.toMatch(/DROP COLUMN IF EXISTS "free_storage_days"/);
    expect(migration).toMatch(/DROP COLUMN IF EXISTS "storage_charge_pence"/);
  });

  it("rolls back by dropping what it added, restoring the weekly charge and the ledger row", () => {
    expect(rollback).toMatch(/ADD COLUMN IF NOT EXISTS "storage_charge_pence" integer/);
    for (const table of [
      "collection_storage_audit",
      "collection_storage_waiver",
      "collection_storage_extension",
      "collection_storage_terms",
    ]) {
      expect(rollback).toContain(`DROP TABLE IF EXISTS "${table}"`);
    }
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "storage_large"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "storage_terms_id"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "raise_storage_invoices"/);
    expect(rollback).toMatch(/__drizzle_migrations WHERE created_at = 1812196800000/);
  });
});
