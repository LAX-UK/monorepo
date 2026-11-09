import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { privateSaleDealPayment, privateSaleDealReminder } from "./schema/private-sale-deal.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0335_private_sale_deal_follow_ups.sql");
const rollback = read("0335_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0335 private sale deal follow-ups", () => {
  it("follows the one before it in the journal, one day later", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0335_private_sale_deal_follow_ups");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(previous?.tag).toBe("0337_shop_print_exception");
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 24 * 60 * 60 * 1000);
  });

  it("only adds nullable columns, a table and a validated check, with a short lock timeout", () => {
    expect(migration).not.toMatch(/\bDROP\b|\bDELETE FROM\b|^UPDATE\b/m);
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    const columns = migration.match(/ADD COLUMN[^;]*;/g)?.join("") ?? "";
    expect(columns).toMatch(/"recorded_by_user_id" text/);
    expect(columns).toMatch(/"bank_reference" text/);
    expect(columns).not.toMatch(/NOT NULL/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "private_sale_deal_reminder"/);
    expect(migration).toMatch(/VALIDATE CONSTRAINT "private_sale_deal_payment_recorded_check"/);
  });

  it("is mirrored by the tables", () => {
    const payment = getTableColumns(privateSaleDealPayment);
    expect(payment.recordedByUserId.name).toBe("recorded_by_user_id");
    expect(payment.recordedByUserId.notNull).toBe(false);
    expect(payment.bankReference.notNull).toBe(false);
    const reminder = getTableColumns(privateSaleDealReminder);
    expect(Object.keys(reminder).sort()).toEqual(["dealId", "id", "kind", "sentAt", "step"]);
  });

  it("is undone by dropping only what it added, with no wrapper", () => {
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "private_sale_deal_reminder"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "bank_reference"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "recorded_by_user_id"/);
    expect(rollback).not.toMatch(/^(BEGIN|COMMIT);/m);
  });
});
