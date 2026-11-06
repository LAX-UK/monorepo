import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { WORKER_INVOICE_RAISE_INSERT_TABLES } from "./migrate-roles.js";
import { bidInvoice, bidInvoiceLine } from "./schema/bid-invoice.js";
import { payment } from "./schema/payments.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0319_bid_invoice.sql");
const rollback = read("0319_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0319 bid invoices", () => {
  it("is the last journal entry, one day after the entry before it", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0319_bid_invoice");
    expect(index).toBe(journal.entries.length - 1);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
  });

  it("only adds: two tables, a nullable payment column and their indexes", () => {
    expect(migration).not.toMatch(/\bDROP\b/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "bid_invoice"/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "bid_invoice_line"/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "invoice_id" uuid;/);
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
  });

  it("stores whole pence in pounds sterling and one live invoice per lot and buyer", () => {
    expect(migration).toMatch(/"total_pence" bigint NOT NULL/);
    expect(migration).toMatch(/"currency" = 'GBP'/);
    expect(migration).toMatch(/"total_pence" > 0/);
    expect(migration).toMatch(/"amount_pence" >= 0/);
    expect(migration).toMatch(
      /UNIQUE INDEX IF NOT EXISTS "bid_invoice_lot_buyer_live_uidx"[^;]*WHERE "voided_at" IS NULL/,
    );
  });

  it("has a rollback that removes what it added, children first", () => {
    expect(rollback.indexOf('DROP COLUMN IF EXISTS "invoice_id"')).toBeGreaterThan(-1);
    expect(rollback.indexOf('DROP TABLE IF EXISTS "bid_invoice_line"')).toBeLessThan(
      rollback.indexOf('DROP TABLE IF EXISTS "bid_invoice";'),
    );
  });

  it("matches the schema", () => {
    expect(Object.keys(getTableColumns(bidInvoice)).sort()).toEqual(
      [
        "id",
        "lotId",
        "buyerLegalEntityId",
        "sellerLegalEntityId",
        "currency",
        "totalPence",
        "raisedAt",
        "dueAt",
        "pricingPolicyId",
        "number",
        "source",
        "voidedAt",
        "createdAt",
      ].sort(),
    );
    expect(Object.keys(getTableColumns(bidInvoiceLine)).sort()).toEqual(
      ["id", "invoiceId", "position", "kind", "label", "ratePercent", "amountPence"].sort(),
    );
    expect(getTableColumns(payment).invoiceId.notNull).toBe(false);
  });

  it("keeps the re-runnable backfill script identical to the migration's backfill", () => {
    const script = read("../scripts/backfill-bid-invoices.sql");
    const fromMigration = migration.slice(migration.indexOf("-- Backfill: one invoice per lot"));
    const normalise = (text: string) =>
      text.replaceAll("--> statement-breakpoint", "").replace(/\s+/g, " ").trim();
    expect(normalise(script)).toContain(normalise(fromMigration));
    expect(script).toMatch(/Safe to re-run/);
  });

  it("links a payment to any invoice for its lot and account, not only backfilled ones", () => {
    const update = migration.slice(migration.lastIndexOf('UPDATE "payment" p'));
    expect(update).not.toMatch(/legacy_backfill/);
  });

  it("lets the worker raise invoices, with inserts only", () => {
    expect(WORKER_INVOICE_RAISE_INSERT_TABLES).toContain("bid_invoice");
    expect(WORKER_INVOICE_RAISE_INSERT_TABLES).toContain("bid_invoice_line");
  });
});
