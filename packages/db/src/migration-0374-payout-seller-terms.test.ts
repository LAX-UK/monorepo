import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { payout, payoutLine } from "./schema/payouts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0374_payout_seller_terms";
const migration = read(`${TAG}.sql`);
const rollback = read("0374_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

const ADDED_COLUMNS = [
  "seller_terms_id",
  "buyer_refund_pence",
  "hammer_amount",
  "commission_amount",
  "commission_vat_amount",
] as const;

const CONSTRAINTS = [
  "payout_line_seller_terms_id_fkey",
  "payout_line_seller_terms_sale_ck",
  "payout_line_buyer_refund_ck",
  "payout_seller_terms_totals_ck",
] as const;

describe("migration 0374 payout seller terms", () => {
  it("follows the entry before it with the next idx and a later stamp, and precedes later ones", () => {
    const at = journal.entries.findIndex((e) => e.tag === TAG);
    expect(at).toBeGreaterThan(0);
    const entry = journal.entries[at];
    const previous = journal.entries[at - 1];
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    const next = journal.entries[at + 1];
    if (next) expect(next.when).toBeGreaterThan(entry?.when ?? 0);
  });

  it("adds nullable columns idempotently and the rollback removes each of them", () => {
    for (const column of ADDED_COLUMNS) {
      const added = migration
        .split("\n")
        .find((line) => line.includes(`ADD COLUMN IF NOT EXISTS "${column}"`));
      expect(added, column).toBeDefined();
      expect(added).not.toContain("NOT NULL");
      expect(rollback).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    }
    for (const constraint of CONSTRAINTS) {
      expect(migration).toContain(`conname = '${constraint}'`);
      expect(rollback).toContain(`DROP CONSTRAINT IF EXISTS "${constraint}"`);
    }
    expect(rollback).toContain('DROP INDEX IF EXISTS "payout_line_seller_terms_idx"');
  });

  it("is the shape the schema reads", () => {
    expect(payoutLine.sellerTermsId.name).toBe("seller_terms_id");
    expect(payoutLine.buyerRefundPence.name).toBe("buyer_refund_pence");
    expect(payout.hammerAmount.name).toBe("hammer_amount");
    expect(payout.commissionAmount.name).toBe("commission_amount");
    expect(payout.commissionVatAmount.name).toBe("commission_vat_amount");
  });
});
