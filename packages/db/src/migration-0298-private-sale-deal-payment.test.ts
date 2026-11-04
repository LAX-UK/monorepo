import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { payoutLine } from "./schema/payouts.js";
import { privateSaleDeal, privateSaleDealPayment } from "./schema/private-sale-deal.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0298_private_sale_deal_payment.sql");
const rollback = read("0298_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0298 private sale deal payment", () => {
  it("is journalled after the deal migration", () => {
    const entry = journal.entries.find((e) => e.tag === "0298_private_sale_deal_payment");
    const previous = journal.entries.find((e) => e.tag === "0295_private_sale_deal");
    expect(entry?.idx).toBe(298);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("is additive and idempotent", () => {
    expect(migration).not.toMatch(/\bDROP TABLE\b/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "private_sale_deal_payment"/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "invoice_reference"/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "private_sale_deal_id"/);
  });

  it("creates every column the schema declares", () => {
    for (const column of Object.values(getTableColumns(privateSaleDealPayment))) {
      expect(migration, column.name).toContain(`"${column.name}"`);
    }
    expect(migration).toContain(`"${getTableColumns(privateSaleDeal).invoiceReference.name}"`);
    expect(migration).toContain(`"${getTableColumns(payoutLine).privateSaleDealId.name}"`);
  });

  it("allows one live payment per deal and one sale line per deal", () => {
    expect(migration).toMatch(
      /"private_sale_deal_payment_live_uidx"[^;]*WHERE "status" IN \('open', 'processing', 'paid'\)/,
    );
    expect(migration).toMatch(/"payout_line_sale_deal_uidx"[^;]*"kind" = 'sale'/);
  });

  it("keeps a line to one subject and widens the payment requirement for deals only", () => {
    expect(migration).toMatch(/OR "private_sale_deal_id" IS NOT NULL/);
    expect(migration).toMatch(/"payment_id" IS NULL AND "kind" = 'sale'/);
  });

  it("rolls back what it added and restores the previous line check", () => {
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "private_sale_deal_payment";/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "private_sale_deal_id"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "invoice_reference"/);
    expect(rollback).toMatch(/"kind" IN \('refund', 'dispute', 'chargeback', 'reversal'\)/);
  });
});
