import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ACCOUNTING_STRIPE_SHOP_ORDER_ROLES,
  WORKER_SHOP_INVOICE_READ_COLUMNS,
} from "./migrate-roles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const statements = (sql: string) => sql.replace(/^--.*$/gm, "");
const migration = statements(read("0389_shop_original_sale_books_invoice.sql"));
const rollback = statements(read("0389_rollback.sql"));
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const TAG = "0389_shop_original_sale_books_invoice";
const PREVIOUS_TAG = "0388_accounting_shop_refunds";

describe("migration 0389 Shop originals invoiced in Books", () => {
  it("is journalled right after the migration before it, in a journal that stays ordered", () => {
    const at = journal.entries.findIndex((e) => e.tag === TAG);
    const entry = journal.entries[at];
    const previous = journal.entries[at - 1];
    expect(previous?.tag).toBe(PREVIOUS_TAG);
    expect(entry?.idx).toBe((previous?.idx ?? Number.NaN) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    expect(TAG.slice(0, 4)).toBe(String(Number(PREVIOUS_TAG.slice(0, 4)) + 1).padStart(4, "0"));
  });

  it("adds no grant (db:roles owns them), under the lock timeout", () => {
    expect(migration.indexOf("SET LOCAL lock_timeout = '5s'")).toBeLessThan(
      migration.indexOf("ALTER TABLE"),
    );
    expect(migration).not.toMatch(/\bGRANT\b/);
  });

  it("lets the worker read the sale's columns for the books, never the Stripe ids", () => {
    const sale = WORKER_SHOP_INVOICE_READ_COLUMNS.find(([table]) => table === "shop_original_sale");
    expect(sale?.[1]).toContain("invoice_number");
    expect(sale?.[1]).not.toContain("stripe_payment_link_id");
    expect(sale?.[1]).not.toContain("stripe_invoice_id");
  });

  it("lets the worker read whom the invoice goes to, and attribute a charge only by function", () => {
    const sale = WORKER_SHOP_INVOICE_READ_COLUMNS.find(([table]) => table === "shop_original_sale");
    expect(sale?.[1]).toEqual(
      expect.arrayContaining(["invoice_recipient_email", "invoice_recipient_name"]),
    );
    expect(sale?.[1]).not.toContain("stripe_checkout_session_id");
    expect(sale?.[1]).not.toContain("stripe_payment_intent_id");
    expect(ACCOUNTING_STRIPE_SHOP_ORDER_ROLES).toEqual(["worker_app"]);
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public."accounting_stripe_shop_original_sale"(text) FROM PUBLIC',
    );
    expect(migration).toMatch(/accounting_stripe_shop_original_sale[\s\S]*SECURITY DEFINER/);
  });

  it("rolls back only its behaviour, keeping every column and the data in it, and its ledger row", () => {
    for (const name of [
      `DROP TRIGGER IF EXISTS "shop_original_sale_invoice_number_trg"`,
      `DROP FUNCTION IF EXISTS "shop_original_sale_assign_invoice_number"()`,
      `DROP FUNCTION IF EXISTS "accounting_stripe_shop_original_sale"(text)`,
    ]) {
      expect(rollback).toContain(name);
    }
    // Which sales Books invoices, their links, numbers and payments outlive a rollback.
    expect(rollback).not.toMatch(/DROP COLUMN|DROP INDEX|DROP CONSTRAINT/);
    const when = journal.entries.find((e) => e.tag === TAG)?.when;
    expect(rollback).toContain(`WHERE created_at = ${when}`);
    // The counter is never wound back: a number once taken is never issued again.
    expect(rollback).not.toContain("shop_invoice_counter");
  });
});
