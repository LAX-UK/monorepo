import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WORKER_SHOP_INVOICE_READ_COLUMNS } from "./migrate-roles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const statements = (sql: string) => sql.replace(/^--.*$/gm, "");
const migration = statements(read("0389_shop_original_sale_books_invoice.sql"));
const rollback = statements(read("0389_rollback.sql"));
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const TAG = "0389_shop_original_sale_books_invoice";

describe("migration 0389 Shop originals invoiced in Books", () => {
  it("is journalled after 0386, in a journal that stays ordered", () => {
    const entry = journal.entries.find((e) => e.tag === TAG);
    const previous = journal.entries.find((e) => e.tag === "0386_stripe_fees_payouts_books");
    expect(entry?.idx).toBeGreaterThan(previous?.idx ?? Number.POSITIVE_INFINITY);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
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

  it("rolls back every object it adds, and its ledger row", () => {
    for (const name of [
      `DROP TRIGGER IF EXISTS "shop_original_sale_invoice_number_trg"`,
      `DROP FUNCTION IF EXISTS "shop_original_sale_assign_invoice_number"()`,
      `DROP INDEX IF EXISTS "shop_original_sale_payment_link_uid"`,
      `DROP INDEX IF EXISTS "shop_original_sale_invoice_number_uid"`,
      `DROP COLUMN IF EXISTS "invoice_issuer"`,
    ]) {
      expect(rollback).toContain(name);
    }
    const when = journal.entries.find((e) => e.tag === TAG)?.when;
    expect(rollback).toContain(`WHERE created_at = ${when}`);
    // The counter is never wound back: a number once taken is never issued again.
    expect(rollback).not.toContain("shop_invoice_counter");
  });
});
