import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { PAYMENT_REFUND_SOURCES } from "./schema/payment-refund.js";
import { stripeRefundWatch } from "./schema/stripe-refund-watch.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe.each(["0375_stripe_refund_watch", "0376_payment_transfer_received_intent"])(
  "migration %s",
  (tag) => {
    it("is journalled once, after the entry before it in both idx and time", () => {
      const index = journal.entries.findIndex((e) => e.tag === tag);
      expect(index).toBeGreaterThan(0);
      const entry = journal.entries[index];
      const previous = journal.entries[index - 1];
      expect(journal.entries.filter((e) => e.idx === entry?.idx)).toHaveLength(1);
      expect(entry?.idx).toBeGreaterThan(previous?.idx ?? Number.MAX_SAFE_INTEGER);
      expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.MAX_SAFE_INTEGER);
    });

    it("takes a short lock timeout and removes no data", () => {
      const sql = read(`${tag}.sql`);
      expect(sql).toMatch(/SET LOCAL lock_timeout = '5s'/);
      expect(sql).not.toMatch(/\bDELETE\b|\bUPDATE\b|\bDROP TABLE\b|\bDROP COLUMN\b/);
    });
  },
);

describe("migration 0375 stripe refund watch", () => {
  const migration = read("0375_stripe_refund_watch.sql");
  const rollback = read("0375_rollback.sql");

  it("creates every column the schema declares", () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "stripe_refund_watch"/);
    for (const column of Object.values(getTableColumns(stripeRefundWatch))) {
      expect(migration).toContain(`"${column.name}"`);
    }
  });

  it("allows a negative buyer refund row only as a refund_reversal, checked on every row", () => {
    expect(migration).toContain(
      `CHECK ("amount_pence" > 0 OR ("source" = 'refund_reversal' AND "amount_pence" < 0)) NOT VALID`,
    );
    expect(migration).toContain(`VALIDATE CONSTRAINT "payment_refund_amount_positive"`);
    expect(migration).toContain(`VALIDATE CONSTRAINT "payment_refund_source_ck"`);
    const sources = migration.slice(migration.indexOf('"payment_refund_source_ck" CHECK'));
    for (const source of PAYMENT_REFUND_SOURCES) expect(sources).toContain(`'${source}'`);
  });

  it("adds the seller's refund lines up with their sign in the backfill", () => {
    expect(migration).toContain(`round(-SUM(l."amount") * 100)::bigint AS "line_pence"`);
    expect(migration).not.toContain("abs(");
    expect(migration).toContain("REVOKE ALL ON FUNCTION payment_refund_backfill_from_payout_lines");
  });

  it("is undone only once no compensating row would be lost, restoring the previous rules", () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
    expect(rollback).toContain(`WHERE "source" = 'refund_reversal'`);
    expect(rollback).toContain(`CHECK ("amount_pence" > 0)`);
    expect(rollback).toContain(`SUM(round(abs(l."amount") * 100))::bigint AS "line_pence"`);
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "stripe_refund_watch"/);
  });
});

describe("migration 0376 transfer received intent", () => {
  it("adds one nullable column and drops only it on rollback", () => {
    expect(read("0376_payment_transfer_received_intent.sql")).toContain(
      `ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "transfer_received_payment_intent_id" text;`,
    );
    expect(read("0376_rollback.sql")).toContain(
      `ALTER TABLE "payment" DROP COLUMN IF EXISTS "transfer_received_payment_intent_id";`,
    );
  });
});
