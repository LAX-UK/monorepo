import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { lot } from "./schema/lots.js";
import { sale } from "./schema/sales.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0380_lot_premium_uses_sale";
const migration = read(`${TAG}.sql`);
const rollback = read("0380_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const index = journal.entries.findIndex((e) => e.tag === TAG);
const entry = journal.entries[index];

describe("migration 0380 lot premium uses the sale's", () => {
  it("is journalled once, right after the previous migration, with a later timestamp", () => {
    expect(index).toBeGreaterThan(0);
    expect(journal.entries.filter((e) => e.tag === TAG)).toHaveLength(1);
    expect(entry?.idx).toBe((journal.entries[index - 1]?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(
      journal.entries[index - 1]?.when ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it("makes the lot rate nullable with no default", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toContain('ALTER COLUMN "buyer_premium_rate" DROP NOT NULL');
    expect(migration).toContain('ALTER COLUMN "buyer_premium_rate" DROP DEFAULT');
    expect(migration).toContain(
      'ALTER TABLE "sale" ALTER COLUMN "buyer_premium_rate" SET DEFAULT 0.15',
    );
    expect(migration).not.toMatch(/\bDELETE\b|DROP COLUMN|DROP TABLE/);
    // The only insert keeps the cleared rates, outside the application schema.
    expect([...migration.matchAll(/\bINSERT INTO "([^"]+)"\."([^"]+)"/g)].map((m) => m[1])).toEqual(
      ["drizzle"],
    );
    expect(migration.match(/\bINSERT\b/g)).toHaveLength(1);
  });

  it("keeps, then clears, the rate of every lot in a sale with bands, invoiced or not", () => {
    const keep = migration.slice(
      migration.indexOf('INSERT INTO "drizzle"."lot_premium_rate_before_0380"'),
    );
    const insert = keep.slice(0, keep.indexOf(";") + 1);
    expect(insert).toContain('jsonb_array_length(s."buyer_premium_tiers") > 0');
    expect(insert).toContain('l."buyer_premium_rate" IS NOT NULL');
    // No invoice guard: a voided invoice re-prices the lot from its rate (buyer default).
    expect(insert).not.toMatch(/bid_invoice/);
    const updates = [...migration.matchAll(/UPDATE "lot"[\s\S]*?;/g)].map((m) => m[0]);
    expect(updates).toHaveLength(1);
    const update = updates[0] ?? "";
    expect(update).toContain('SET "buyer_premium_rate" = NULL');
    expect(update).toContain('FROM "drizzle"."lot_premium_rate_before_0380"');
    expect(migration.indexOf("DROP NOT NULL")).toBeLessThan(migration.indexOf(update));
    expect(migration.indexOf(insert)).toBeLessThan(migration.indexOf(update));
    expect(migration).not.toMatch(/UPDATE "bid_invoice"/);
  });

  it("matches the Drizzle schema", () => {
    const rate = getTableColumns(lot).buyerPremiumRate;
    expect(rate.notNull).toBe(false);
    expect(rate.hasDefault).toBe(false);
    expect(getTableColumns(sale).buyerPremiumRate.default).toBe("0.15");
  });

  it("rolls back in one transaction, restoring the kept rates, then filling the remaining NULLs", () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    const restore = rollback.indexOf('SET "buyer_premium_rate" = b."buyer_premium_rate"');
    expect(restore).toBeGreaterThan(0);
    expect(restore).toBeLessThan(rollback.indexOf("COALESCE("));
    expect(rollback.indexOf('DROP TABLE "drizzle"."lot_premium_rate_before_0380"')).toBeGreaterThan(
      rollback.indexOf("SET NOT NULL"),
    );
    expect(rollback).toMatch(/COMMIT;/);
    expect(rollback).toMatch(/WHERE l\."buyer_premium_rate" IS NULL;/);
    expect(rollback).toContain('ALTER COLUMN "buyer_premium_rate" SET NOT NULL');
    expect(rollback).toContain(
      'ALTER TABLE "lot" ALTER COLUMN "buyer_premium_rate" SET DEFAULT 0.25',
    );
    expect(rollback).toContain(
      'ALTER TABLE "sale" ALTER COLUMN "buyer_premium_rate" SET DEFAULT 0.25',
    );
  });

  it("removes exactly its own ledger row, keyed on the journalled timestamp", () => {
    const deletes = [
      ...rollback.matchAll(/DELETE FROM drizzle\.__drizzle_migrations WHERE created_at = (\d+);/g),
    ];
    expect(deletes).toHaveLength(1);
    expect(Number(deletes[0]?.[1])).toBe(entry?.when);
  });
});
