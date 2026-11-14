import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0316_shop_order_created_id_idx.sql");
const rollback = read("0316_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0316 shop order list keyset index", () => {
  it("is journalled after the previous migration", () => {
    const entry = journal.entries.find((e) => e.tag === "0316_shop_order_created_id_idx");
    const previous = journal.entries.find((e) => e.tag === "0315_payment_checkout_session");
    expect(entry?.idx).toBe(311);
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

  it("runs the rollback in its own transaction, so its SET LOCAL takes effect", () => {
    // SET LOCAL outside a transaction only warns and does nothing: the rollback runs by hand
    // (psql), not in the transactional runner, so it must open and close its own.
    expect(rollback).toMatch(/^BEGIN;$/m);
    expect(rollback).toMatch(/^COMMIT;$/m);
    const begin = rollback.indexOf("BEGIN;");
    const setLocal = rollback.indexOf("SET LOCAL lock_timeout");
    const drop = rollback.indexOf("DROP INDEX");
    const commit = rollback.lastIndexOf("COMMIT;");
    expect(begin).toBeGreaterThan(-1);
    expect(begin).toBeLessThan(setLocal);
    expect(setLocal).toBeLessThan(drop);
    expect(drop).toBeLessThan(commit);
  });

  it("rolls back by dropping the index", () => {
    expect(rollback).toMatch(/DROP INDEX IF EXISTS "shop_order_created_id_idx"/);
  });
});
