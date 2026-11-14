import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { API_DENY_TABLES } from "./migrate-roles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migrationFile = read("0385_stripe_fees_payouts_books.sql");
const migration = migrationFile.replace(/^--.*$/gm, "");
const rollback = read("0385_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const TAG = "0385_stripe_fees_payouts_books";
const TABLES = [
  "accounting_stripe_account",
  "accounting_stripe_cursor",
  "accounting_stripe_balance_txn",
  "accounting_reconciliation_report",
];

describe("migration 0385 Stripe fees and payouts to Books", () => {
  it("is journalled last, after 0384, in a journal that stays ordered", () => {
    const entry = journal.entries.find((e) => e.tag === TAG);
    const previous = journal.entries.find((e) => e.tag === "0384_unapplied_money_dedupe_key_uid");
    expect(entry?.idx).toBe((previous?.idx ?? Number.NaN) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    expect(journal.entries.at(-1)?.tag).toBe(TAG);
  });

  it("adds the two kinds to the kind, reference and totals checks, under the lock timeout", () => {
    expect(migration.indexOf("SET LOCAL lock_timeout = '5s'")).toBeLessThan(
      migration.indexOf("ALTER TABLE"),
    );
    expect(migration).toMatch(
      /"kind" IN \('invoice', 'payment', 'credit_note', 'bill', 'contact', 'expense', 'transfer'\)/,
    );
    expect(migration).toContain("(INV|PAY|CN|BILL|CON|EXP|TRF)");
    expect(migration).toContain(
      `"kind" NOT IN ('payment', 'expense', 'transfer') OR "vat_pence" = 0`,
    );
    // No grant in the migration (db:roles owns them); the definer function is taken from PUBLIC.
    expect(migration).not.toMatch(/\bGRANT\b/);
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public."accounting_stripe_shop_order"(text) FROM PUBLIC;',
    );
  });

  it("makes the balance transaction rows append-only and keyed on the Stripe ids", () => {
    expect(migration).toMatch(/PRIMARY KEY \("stripe_account_id", "balance_transaction_id"\)/);
    expect(migration).toMatch(/BEFORE UPDATE OR DELETE ON "accounting_stripe_balance_txn"/);
    // Any Stripe id as the source: a narrower rule would stall the account on one odd value.
    expect(migration).toContain(`"source_id" IS NULL OR "source_id" ~ '^[A-Za-z0-9_]{1,255}$'`);
  });

  it("keeps every new table from api_app", () => {
    for (const table of TABLES) expect(API_DENY_TABLES as readonly string[]).toContain(table);
  });

  it("has a rollback in one transaction that cancels the new kinds with history before dropping", () => {
    expect(rollback).toMatch(/^BEGIN;$/m);
    expect(rollback).toMatch(/^COMMIT;$/m);
    expect(rollback.indexOf('INSERT INTO "accounting_document_event"')).toBeLessThan(
      rollback.indexOf('UPDATE "accounting_document"'),
    );
    expect(rollback.indexOf('UPDATE "accounting_document"')).toBeLessThan(
      rollback.indexOf("DROP TABLE"),
    );
    for (const table of TABLES) expect(rollback).toContain(`DROP TABLE IF EXISTS "${table}"`);
    const when = journal.entries.find((e) => e.tag === TAG)?.when;
    expect(rollback).toContain(
      `DELETE FROM drizzle.__drizzle_migrations WHERE created_at = ${when};`,
    );
  });
});
