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
    expect(migration).not.toMatch(/\bDELETE\b|\bINSERT\b|DROP COLUMN|DROP TABLE/);
  });

  it("clears the rate only of uninvoiced lots in a sale with bands, after dropping NOT NULL", () => {
    const updates = [...migration.matchAll(/UPDATE "lot"[\s\S]*?;/g)].map((m) => m[0]);
    expect(updates).toHaveLength(1);
    const update = updates[0] ?? "";
    expect(update).toContain('SET "buyer_premium_rate" = NULL');
    expect(update).toContain('jsonb_array_length(s."buyer_premium_tiers") > 0');
    expect(update).toMatch(/NOT EXISTS \(\s*SELECT 1 FROM "bid_invoice"[\s\S]*"voided_at" IS NULL/);
    expect(migration.indexOf("DROP NOT NULL")).toBeLessThan(migration.indexOf(update));
  });

  it("matches the Drizzle schema", () => {
    const rate = getTableColumns(lot).buyerPremiumRate;
    expect(rate.notNull).toBe(false);
    expect(rate.hasDefault).toBe(false);
    expect(getTableColumns(sale).buyerPremiumRate.default).toBe("0.15");
  });

  it("rolls back in one transaction, filling only the lots that use their sale's premium", () => {
    expect(rollback).toMatch(/^BEGIN;/m);
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
