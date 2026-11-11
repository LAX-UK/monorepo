import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { privateSaleDeal } from "./schema/private-sale-deal.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0357_private_sale_deal_artwork_unlinked_reason";
const migration = read(`${TAG}.sql`);
const rollback = read("0357_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0357 private sale deal artwork unlinked reason", () => {
  it("sits after the migration before it, in time, and before whatever follows", () => {
    const index = journal.entries.findIndex((e) => e.tag === TAG);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    const next = journal.entries[index + 1];
    expect(index).toBeGreaterThan(0);
    expect(Number(previous?.tag.slice(0, 4))).toBeLessThan(357);
    expect(entry?.idx).toBeGreaterThan(previous?.idx ?? 0);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
    // Other migrations may land after this one; they must be later still.
    if (next) expect(next.when).toBeGreaterThan(entry?.when ?? 0);
  });

  it("adds one nullable column and a check on its two values, with a short lock timeout", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toContain(
      'ALTER TABLE "private_sale_deal" ADD COLUMN IF NOT EXISTS "artwork_unlinked_reason" text;',
    );
    expect(migration).toContain("'sellers_own_work', 'in_zoho_not_linked'");
    expect(migration).toMatch(/NOT VALID/);
    // Safe to apply again after a partial apply: the constraint is only added when it is missing.
    expect(migration).toMatch(
      /IF NOT EXISTS \(\s*SELECT 1 FROM pg_constraint\s+WHERE conname = 'private_sale_deal_artwork_unlinked_reason_check'/,
    );
    expect(migration).toMatch(
      /VALIDATE CONSTRAINT "private_sale_deal_artwork_unlinked_reason_check"/,
    );
    expect(migration).not.toMatch(/NOT NULL|DROP /);
  });

  it("is mirrored by the schema", () => {
    expect(getTableName(privateSaleDeal)).toBe("private_sale_deal");
    expect(getTableColumns(privateSaleDeal).artworkUnlinkedReason.notNull).toBe(false);
    const checks = getTableConfig(privateSaleDeal).checks.map((c) => c.name);
    expect(checks).toContain("private_sale_deal_artwork_unlinked_reason_check");
  });

  it("is undone by the rollback, constraint first", () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    const constraint = rollback.indexOf("DROP CONSTRAINT IF EXISTS");
    const column = rollback.indexOf('DROP COLUMN IF EXISTS "artwork_unlinked_reason"');
    expect(constraint).toBeGreaterThan(-1);
    expect(column).toBeGreaterThan(constraint);
    expect(rollback).toMatch(/COMMIT;/);
  });
});
