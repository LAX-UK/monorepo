import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { paymentGroupDelivery } from "./schema/payment-group.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0325_payment_group_delivery.sql");
const rollback = read("0325_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0325 payment group delivery", () => {
  it("is a journal entry after the one before it, in order", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0325_payment_group_delivery");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
  });

  it("only adds a table, with a short lock timeout", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "payment_group_delivery"/);
    expect(migration).toMatch(/CHECK \("amount" > 0\)/);
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN)|ALTER TABLE/);
  });

  it("holds each quote in one payment only", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "payment_group_delivery_quote_uidx"\s+ON "payment_group_delivery" \("delivery_quote_id"\)/,
    );
  });

  it("has a rollback that refuses to lose a charge and then drops the table", () => {
    expect(rollback).toMatch(/IF EXISTS \(SELECT 1 FROM "payment_group_delivery"\)/);
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "payment_group_delivery"/);
  });

  it("matches the schema", () => {
    const columns = getTableColumns(paymentGroupDelivery);
    expect(columns.paymentGroupId.notNull).toBe(true);
    expect(columns.deliveryQuoteId.notNull).toBe(true);
    expect(columns.lotId.notNull).toBe(true);
    expect(columns.amount.notNull).toBe(true);
  });
});
