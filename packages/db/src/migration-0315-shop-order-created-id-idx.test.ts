import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0315_shop_order_created_id_idx.sql");
const rollback = read("0315_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0315 shop order list keyset index", () => {
  it("is journalled after the previous migration", () => {
    const entry = journal.entries.find((e) => e.tag === "0315_shop_order_created_id_idx");
    const previous = journal.entries.find((e) => e.tag === "0314_artwork_register_zoho_images");
    expect(entry?.idx).toBe(310);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("indexes (created_at, id) without CONCURRENTLY, which the transactional runner rejects", () => {
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS "shop_order_created_id_idx" ON "shop_order" USING btree \("created_at","id"\)/,
    );
    expect(migration).not.toMatch(/CREATE INDEX CONCURRENTLY/);
    expect(migration).not.toMatch(/\bDROP (TABLE|COLUMN)\b/);
  });

  it("keeps the lock wait short", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(rollback).toMatch(/SET LOCAL lock_timeout = '5s'/);
  });

  it("rolls back by dropping the index", () => {
    expect(rollback).toMatch(/DROP INDEX IF EXISTS "shop_order_created_id_idx"/);
  });
});
