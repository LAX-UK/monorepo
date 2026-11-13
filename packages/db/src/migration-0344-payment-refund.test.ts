import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  API_DENY_TABLES,
  API_PAYMENT_REFUND_TABLES,
  PAYMENT_REFUND_BACKFILL_FUNCTION,
  PAYMENT_REFUND_BACKFILL_ROLES,
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

  it("only adds a table, its indexes and the backfill function, with a short lock timeout", () => {
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
      `CHECK ("source" IN ('card_webhook', 'group_webhook', 'staff', 'blocked_capture', 'payout_topup'))`,
    );
    // `refund_reversal` came later, with 0376 (see its own test).
    for (const source of PAYMENT_REFUND_SOURCES.filter((s) => s !== "refund_reversal")) {
      expect(migration).toContain(`'${source}'`);
    }
  });

  it("records each refund once, whoever reports it", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "payment_refund_idempotency_key_uidx" ON "payment_refund" ("idempotency_key")',
    );
  });

  describe("the backfill from refund payout lines", () => {
    const step = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION"));

    it("is a function a later migration can call again, and runs once here", () => {
      expect(migration).toContain(
        "CREATE OR REPLACE FUNCTION payment_refund_backfill_from_payout_lines(only_payment_id uuid DEFAULT NULL) RETURNS integer",
      );
      expect(migration).toContain('only_payment_id IS NULL OR l."payment_id" = only_payment_id');
      expect(migration).toMatch(/^SELECT payment_refund_backfill_from_payout_lines\(\);$/m);
      expect(rollback).toContain(
        "DROP FUNCTION IF EXISTS payment_refund_backfill_from_payout_lines(uuid)",
      );
    });

    it("sums the refund lines of a payment, in pence, and never matches on a line's event id", () => {
      expect(step).toContain(`l."kind" = 'refund'`);
      expect(step).toContain('l."payment_id" IS NOT NULL');
      expect(step).toContain('SUM(round(abs(l."amount") * 100))');
      expect(step).toContain('GROUP BY l."payment_id"');
      expect(step).not.toContain("source_event_id");
      expect(step).not.toContain("NOT EXISTS");
    });

    it("adds only what the payment's refund lines hold above its recorded refunds", () => {
      expect(step).toContain('SUM(r."amount_pence")');
      expect(step).toContain(`r."currency" = 'GBP'`);
      expect(step).toContain('t."line_pence" - t."recorded_pence" > 0');
      expect(step).toContain(`'payout_topup'`);
    });

    it("keys the top-up by payment and refund line total, so a re-run or a race adds it once", () => {
      expect(step).toContain(`'payout_ledger_topup:' || t."payment_id" || ':' || t."line_pence"`);
      expect(step).toContain('ON CONFLICT ("idempotency_key") DO NOTHING');
    });

    it("can be called by the roles that need it only", () => {
      expect(migration).toContain(
        "REVOKE ALL ON FUNCTION payment_refund_backfill_from_payout_lines(uuid) FROM PUBLIC",
      );
      expect([...PAYMENT_REFUND_BACKFILL_ROLES]).toEqual(["api_app", "worker_app"]);
      expect(PAYMENT_REFUND_BACKFILL_FUNCTION).toBe(
        "payment_refund_backfill_from_payout_lines(uuid)",
      );
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
        "stripeRefundId",
      ].sort(),
    );
    for (const [name, column] of Object.entries(columns)) {
      expect(column.notNull).toBe(name !== "stripeRefundId");
    }
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
    expect(migration).toContain('"stripe_refund_id" text,');
  });
});
