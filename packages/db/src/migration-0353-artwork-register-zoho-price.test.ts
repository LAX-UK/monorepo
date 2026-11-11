import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { artworkRegister } from "./schema/artwork-register.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0353_artwork_register_zoho_price.sql");
const rollback = read("0353_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0353 artwork register Zoho price", () => {
  it("is journalled as entry 347, right after 0352, with a later timestamp", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0353_artwork_register_zoho_price");
    expect(journal.entries[index]?.idx).toBe(347);
    expect(journal.entries[index - 1]?.tag).toBe("0352_account_time_zone");
    expect(journal.entries[index]?.when).toBeGreaterThan(journal.entries[index - 1]?.when ?? 0);
    expect(index).toBe(journal.entries.length - 1);
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
