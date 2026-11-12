import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  accountingDocument,
  accountingDocumentEvent,
  accountingSourceSetting,
} from "./schema/accounting.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0368_accounting_tables";
const migration = read(`${TAG}.sql`);
const rollback = read("0368_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0368 accounting tables", () => {
  it("follows the previous entry with a higher idx and a later timestamp", () => {
    const index = journal.entries.findIndex((e) => e.tag === TAG);
    expect(index).toBeGreaterThan(0);
    expect(journal.entries[index]?.idx).toBeGreaterThan(
      journal.entries[index - 1]?.idx ?? Number.MAX_SAFE_INTEGER,
    );
    expect(journal.entries[index]?.when).toBeGreaterThan(journal.entries[index - 1]?.when ?? 0);
  });

  it("creates the three tables idempotently and the rollback drops them", () => {
    for (const table of [
      "accounting_document",
      "accounting_document_event",
      "accounting_source_setting",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
      expect(rollback).toContain(`DROP TABLE IF EXISTS "${table}"`);
    }
    expect(rollback).toContain('DROP FUNCTION IF EXISTS "accounting_document_event_append_only"');
  });

  it("seeds today's reality: Bid on Xero, Shop and lax.art on none, Books off everywhere", () => {
    expect(migration).toContain("('bid', 'live', 'off')");
    expect(migration).toContain("('shop', 'off', 'off')");
    expect(migration).toContain("('lax_art', 'off', 'off')");
    // Only Bid's Xero column is live in the seed: Books is off in every row.
    expect(migration.match(/^\s+\('(?:bid|shop|lax_art)', '\w+', '(\w+)'\)/gm)).toHaveLength(3);
    expect(migration).not.toMatch(/^\s+\('(?:bid|shop|lax_art)', '\w+', '(?!off')\w+'\)/m);
  });

  it("is the shape the schema reads", () => {
    expect(getTableName(accountingDocument)).toBe("accounting_document");
    expect(getTableName(accountingDocumentEvent)).toBe("accounting_document_event");
    expect(getTableName(accountingSourceSetting)).toBe("accounting_source_setting");
    const documentColumns = Object.values(getTableColumns(accountingDocument)).map((c) => c.name);
    for (const column of documentColumns) expect(migration).toContain(`"${column}"`);
    const settingColumns = Object.values(getTableColumns(accountingSourceSetting)).map(
      (c) => c.name,
    );
    for (const column of settingColumns) expect(migration).toContain(`"${column}"`);
  });
});
