import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { shopHomeCover } from "./schema/shop-commerce.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0373_shop_home_cover";
const migration = read(`${TAG}.sql`);
const rollback = read("0373_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0373 shop home cover", () => {
  it("is journalled once, after the entry before it in both idx and time", () => {
    const index = journal.entries.findIndex((e) => e.tag === TAG);
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(journal.entries.filter((e) => e.idx === entry?.idx)).toHaveLength(1);
    expect(entry?.idx).toBeGreaterThan(previous?.idx ?? Number.MAX_SAFE_INTEGER);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.MAX_SAFE_INTEGER);
  });

  it("only adds the table, with a short lock timeout", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).not.toMatch(/\bDROP\b|\bALTER TABLE\b|\bDELETE\b|\bUPDATE\b/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "shop_home_cover"/);
  });

  it("keeps one row and sane values with table checks", () => {
    for (const rule of [
      "shop_home_cover_single_row",
      "shop_home_cover_size",
      "shop_home_cover_focal_range",
      "shop_home_cover_alt_length",
    ]) {
      expect(migration).toContain(`CONSTRAINT "${rule}" CHECK`);
    }
  });

  it("creates every column the schema declares", () => {
    for (const column of Object.values(getTableColumns(shopHomeCover))) {
      expect(migration).toContain(`"${column.name}"`);
    }
  });

  it("is undone by dropping only the table", () => {
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "shop_home_cover"/);
    expect(rollback.match(/DROP TABLE/g)).toHaveLength(1);
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
  });
});
