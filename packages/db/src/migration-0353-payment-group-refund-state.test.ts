import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { paymentGroup, paymentGroupDelivery } from "./schema/payment-group.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0353_payment_group_refund_state.sql");
const rollback = read("0353_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0353 payment group refund state", () => {
  it("is the last journal entry, later than the one before it", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0353_payment_group_refund_state");
    const next = journal.entries[index + 1];
    if (next) expect(next.when).toBeGreaterThan(journal.entries[index]?.when ?? 0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(entry?.idx).toBe(347);
    expect(entry?.when).toBe(1805529600000);
    expect(entry?.idx).toBeGreaterThan(previous?.idx ?? 0);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
  });

  it("only adds defaulted columns and checks, with a short lock timeout", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toMatch(
      /"payment_group_delivery" ADD COLUMN IF NOT EXISTS "refunded_pence" integer DEFAULT 0 NOT NULL/,
    );
    expect(migration).toMatch(
      /"payment_group" ADD COLUMN IF NOT EXISTS "refund_unattributed_pence" integer DEFAULT 0 NOT NULL/,
    );
    expect(migration).toMatch(
      /CHECK \("payment_group_delivery"\."refunded_pence" >= 0\)[^;]*NOT VALID;/,
    );
    expect(migration).toMatch(/VALIDATE CONSTRAINT "payment_group_refund_unattributed_check"/);
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN)|CREATE TABLE|GRANT|REVOKE/);
  });

  it("has a rollback that drops both checks and both columns", () => {
    expect(rollback).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(rollback).toMatch(/DROP CONSTRAINT IF EXISTS "payment_group_refund_unattributed_check"/);
    expect(rollback).toMatch(
      /DROP CONSTRAINT IF EXISTS "payment_group_delivery_refunded_pence_check"/,
    );
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "refund_unattributed_pence"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "refunded_pence"/);
  });

  it("matches the schema", () => {
    const delivery = getTableColumns(paymentGroupDelivery);
    expect(delivery.refundedPence.notNull).toBe(true);
    expect(delivery.refundedPence.default).toBe(0);
    const group = getTableColumns(paymentGroup);
    expect(group.refundUnattributedPence.notNull).toBe(true);
    expect(group.refundUnattributedPence.default).toBe(0);
  });
});
