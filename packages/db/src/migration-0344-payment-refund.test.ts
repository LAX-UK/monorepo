import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  API_DENY_TABLES,
  API_PAYMENT_REFUND_TABLES,
  SHOP_COMMERCE_TABLES,
  WORKER_PAYMENT_REFUND_TABLES,
} from "./migrate-roles.js";
import { PAYMENT_REFUND_SOURCES, paymentRefund } from "./schema/payment-refund.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0344_payment_refund.sql");
const rollback = read("0344_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0344 payment refund", () => {
  it("follows an earlier migration in the journal, with the next index and a later time", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0344_payment_refund");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(Number(previous?.tag.slice(0, 4))).toBeLessThan(344);
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 86_400_000);
  });

  it("only adds a table and its indexes, with a short lock timeout", () => {
    expect(migration).not.toMatch(
      /\bDROP (TABLE|COLUMN)\b|\bALTER TABLE\b|^UPDATE\b|\bDELETE FROM\b/m,
    );
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "payment_refund"/);
  });

  it("keeps a refund to a payment, a positive amount, a currency code and a known source", () => {
    expect(migration).toContain('FOREIGN KEY ("payment_id") REFERENCES "payment" ("id")');
    expect(migration).toContain('CHECK ("amount_pence" > 0)');
    expect(migration).toContain(`CHECK ("currency" ~ '^[A-Z]{3}$')`);
    expect(migration).toContain(
      `CHECK ("source" IN ('card_webhook', 'group_webhook', 'staff', 'blocked_capture'))`,
    );
    for (const source of PAYMENT_REFUND_SOURCES) expect(migration).toContain(`'${source}'`);
  });

  it("records each refund once, whoever reports it", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "payment_refund_idempotency_key_uidx" ON "payment_refund" ("idempotency_key")',
    );
  });

  describe("the backfill from refund payout lines", () => {
    const step = migration.slice(migration.indexOf('INSERT INTO "payment_refund"'));

    it("copies only refund lines that name a payment, in pence", () => {
      expect(step).toContain(`l."kind" = 'refund'`);
      expect(step).toContain('l."payment_id" IS NOT NULL');
      expect(step).toContain('round(abs(l."amount") * 100)::integer');
      expect(step).toContain('round(abs(l."amount") * 100) > 0');
    });

    it("keys each row by its line, so running it again changes nothing", () => {
      expect(step).toContain(`'backfill:payout_line:' || l."id"`);
      expect(step).toContain('ON CONFLICT ("idempotency_key") DO NOTHING');
    });

    it("reads the source from the event id the line was written for", () => {
      expect(step).toContain(`LIKE 'evt\\_%:%' THEN 'group_webhook'`);
      expect(step).toContain(`LIKE 'evt\\_%' THEN 'card_webhook'`);
      expect(step).toContain("ELSE 'staff'");
    });

    it("never changes the ledger it copies from", () => {
      expect(migration).not.toMatch(/(UPDATE|DELETE FROM|ALTER TABLE) "payout_line"/);
    });
  });

  it("is mirrored by the schema", () => {
    expect(getTableName(paymentRefund)).toBe("payment_refund");
    const columns = getTableColumns(paymentRefund);
    expect(Object.keys(columns).sort()).toEqual(
      [
        "amountPence",
        "createdAt",
        "currency",
        "id",
        "idempotencyKey",
        "paymentId",
        "source",
      ].sort(),
    );
    for (const column of Object.values(columns)) expect(column.notNull).toBe(true);
  });

  it("is open to the Bid API and the refund reconcile job for insert and read, and to Shop for nothing", () => {
    expect([...API_PAYMENT_REFUND_TABLES]).toEqual(["payment_refund"]);
    expect([...WORKER_PAYMENT_REFUND_TABLES]).toEqual(["payment_refund"]);
    expect([...SHOP_COMMERCE_TABLES]).not.toContain("payment_refund");
    expect([...API_DENY_TABLES]).not.toContain("payment_refund");
  });

  it("is undone by dropping the table", () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
    expect(rollback).toMatch(/lock_timeout = '5s'/);
    expect(rollback).toContain('DROP TABLE IF EXISTS "payment_refund"');
  });
});
