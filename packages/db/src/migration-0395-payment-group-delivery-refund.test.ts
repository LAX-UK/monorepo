import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0395_payment_group_delivery_refund";
const migration = read(`${TAG}.sql`);
const rollback = read("0395_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0395 courier refund requests", () => {
  it("is journalled after the migration before it, in a journal that stays ordered", () => {
    const at = journal.entries.findIndex((e) => e.tag === TAG);
    const previous = journal.entries[at - 1];
    expect(at).toBeGreaterThan(0);
    expect(journal.entries[at]?.idx).toBeGreaterThan(previous?.idx ?? Number.POSITIVE_INFINITY);
    expect(journal.entries[at]?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("only adds the table, under a lock timeout, with a positive amount and the three statuses", () => {
    expect(migration.indexOf("SET LOCAL lock_timeout")).toBeLessThan(
      migration.indexOf('CREATE TABLE IF NOT EXISTS "payment_group_delivery_refund"'),
    );
    expect(migration).toContain('CHECK ("amount_pence" > 0)');
    expect(migration).toContain("CHECK (\"status\" IN ('pending', 'succeeded', 'failed'))");
    expect(migration).toMatch(
      /UNIQUE INDEX IF NOT EXISTS "payment_group_delivery_refund_stripe_uidx"/,
    );
    const statements = migration
      .split("--> statement-breakpoint")
      .map((part) => part.replace(/^--.*$/gm, "").trim());
    expect(statements.map((statement) => statement.split(/\s+/).slice(0, 2).join(" "))).toEqual([
      "SET LOCAL",
      "CREATE TABLE",
      "CREATE INDEX",
      "CREATE UNIQUE",
    ]);
  });

  it("rolls back only when no request is recorded, and removes its ledger row", () => {
    expect(rollback.indexOf("RAISE EXCEPTION")).toBeLessThan(
      rollback.indexOf('DROP TABLE IF EXISTS "payment_group_delivery_refund"'),
    );
    const entry = journal.entries.find((e) => e.tag === TAG);
    expect(rollback).toContain(`created_at = ${entry?.when}`);
    expect(rollback.trim().startsWith("--")).toBe(true);
    expect(rollback).toMatch(/BEGIN;[\s\S]*COMMIT;\s*$/);
  });
});
