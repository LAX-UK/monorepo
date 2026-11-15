import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WORKER_SHOP_INVOICE_READ_COLUMNS } from "./migrate-roles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const statements = (sql: string) => sql.replace(/^--.*$/gm, "");
const migration = statements(read("0394_books_payout_bills.sql"));
const rollback = statements(read("0394_rollback.sql"));
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const TAG = "0394_books_payout_bills";

/** api_app's rule as a migration defines it; comments and the blank lines they leave do not count. */
const fn = (sql: string) => {
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION "accounting_document_api_requeue_only"');
  return sql
    .slice(start, sql.indexOf("$fn$;", start) + 5)
    .replace(/^\s*--.*$/gm, "")
    .replace(/\n\s*\n/g, "\n");
};

describe("migration 0394 Books payout bills", () => {
  it("is journalled right after 0392, in a journal that stays ordered", () => {
    const at = journal.entries.findIndex((e) => e.tag === TAG);
    const entry = journal.entries[at];
    const previous = journal.entries[at - 1];
    expect(previous?.tag).toBe("0392_collection_notification_types");
    expect(entry?.idx).toBe((previous?.idx ?? Number.NaN) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    expect(new Set(journal.entries.map((e) => e.idx)).size).toBe(journal.entries.length);
    const whens = journal.entries.map((e) => e.when);
    expect(new Set(whens).size).toBe(whens.length);
  });

  it("adds the bill_payment kind (BPAY, no VAT) and changes no table, grant or other kind", () => {
    expect(migration.indexOf("SET LOCAL lock_timeout = '5s'")).toBeLessThan(
      migration.indexOf("ALTER TABLE"),
    );
    expect(migration).not.toMatch(/CREATE TABLE|GRANT|DROP TABLE|ADD COLUMN/);
    expect(migration).toMatch(
      /CHECK \("kind" IN \('invoice', 'payment', 'credit_note', 'bill', 'contact', 'expense', 'transfer',\s*'bill_payment'\)\)/,
    );
    expect(migration).toContain("(INV|PAY|CN|BILL|CON|EXP|TRF|BPAY)");
    expect(migration).toContain("WHEN 'bill_payment' THEN 'BPAY'");
    expect(migration).toContain(
      `("kind" NOT IN ('payment', 'expense', 'transfer', 'bill_payment') OR "vat_pence" = 0)`,
    );
  });

  it("keeps 0388's api_app rule word for word, refusing any parked payout document first", () => {
    const gate =
      /IF OLD\."needs_review_reason" IN \('accounting_parked_seller_payout_treatment',\s*'accounting_parked_artist_payout_treatment', 'accounting_parked_payout_lines_unmapped',\s*'accounting_parked_payout_paid_outside_stripe'\) THEN\s*RAISE EXCEPTION [^;]+;\s*END IF;\s*/;
    expect(fn(migration)).toMatch(gate);
    // It is the first refusal: before api_app's other checks run.
    expect(fn(migration).search(gate)).toBeLessThan(
      fn(migration).indexOf("accounting_parked_refund_outside_stripe"),
    );
    expect(fn(migration).replace(gate, "")).toBe(
      fn(statements(read("0388_accounting_shop_refunds.sql"))),
    );
  });

  it("rolls back: cancels unsent bill payments, payout bills and vendor contacts, restores 0386's checks NOT VALID, keeps the refusal", () => {
    const cancelled =
      /WHERE "state" IN \('pending', 'failed'\)\s+AND \("kind" IN \('bill_payment', 'bill'\)\s+OR \("kind" = 'contact' AND "lax_reference" LIKE 'LAX-%-CON-vendor-%'\)\)/g;
    // Once for the history rows and once for the state change.
    expect(rollback.match(cancelled)).toHaveLength(2);
    expect(rollback).not.toMatch(/CREATE|DROP TABLE|DROP FUNCTION/);
    expect(rollback.match(/NOT VALID/g)).toHaveLength(3);
    expect(rollback).not.toContain("BPAY");
    const when = journal.entries.find((e) => e.tag === TAG)?.when;
    expect(rollback).toContain(`created_at = ${when}`);
    expect(rollback.match(/DELETE FROM/g)).toHaveLength(1);
  });

  it("lets the worker read an artist payout's figures, never the reference staff wrote", () => {
    const ledger = WORKER_SHOP_INVOICE_READ_COLUMNS.find(([t]) => t === "shop_payout_ledger");
    const columns = (ledger?.[1] ?? []) as readonly string[];
    expect(columns).toEqual(
      expect.arrayContaining([
        "gross_pence",
        "deductions_pence",
        "net_pence",
        "paid_by_subject_id",
      ]),
    );
    expect(columns).not.toContain("paid_reference");
  });
});
