import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { artworkRegister } from "./schema/artwork-register.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0362_artwork_register_zoho_price.sql");
const rollback = read("0362_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0362 artwork register Zoho price", () => {
  it("follows the previous entry with a higher idx and a later timestamp", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0362_artwork_register_zoho_price");
    expect(index).toBeGreaterThan(0);
    expect(journal.entries[index]?.idx).toBeGreaterThan(
      journal.entries[index - 1]?.idx ?? Number.MAX_SAFE_INTEGER,
    );
    expect(journal.entries[index]?.when).toBeGreaterThan(journal.entries[index - 1]?.when ?? 0);
    const next = journal.entries[index + 1];
    if (next) expect(next.when).toBeGreaterThan(journal.entries[index]?.when ?? 0);
  });

  it("adds one nullable column idempotently and backfills nobody", () => {
    expect(migration).toContain(
      'ALTER TABLE "artwork_register" ADD COLUMN IF NOT EXISTS "zoho_price" numeric(12, 2);',
    );
    expect(migration).not.toMatch(/\bNOT NULL\b|\bUPDATE\b|\bDELETE\b|\bDROP\b/);
    expect(rollback).toContain('DROP COLUMN IF EXISTS "zoho_price"');
  });

  it("is the column the schema reads, holding pounds as text", () => {
    const column = getTableColumns(artworkRegister).zohoPrice;
    expect(column.name).toBe("zoho_price");
    expect(column.notNull).toBe(false);
    expect(column.dataType).toBe("string");
  });
});
