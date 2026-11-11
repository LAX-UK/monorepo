import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { API_PAYMENT_TRANSFER_REFERENCE_TABLES, WORKER_READ_TABLES } from "./migrate-roles.js";
import { paymentTransferReference } from "./schema/payment-transfer-reference.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0355_payment_transfer_reference.sql");
const rollback = read("0355_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0355 payment transfer reference", () => {
  it("follows every earlier entry with a unique idx and a later timestamp", () => {
    const index = journal.entries.findIndex(
      (entry) => entry.tag === "0355_payment_transfer_reference",
    );
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    const next = journal.entries[index + 1];
    expect(entry?.when).toBe(1805702400000);
    expect(entry?.idx).toBeGreaterThan(previous?.idx ?? Number.POSITIVE_INFINITY);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    if (next) expect(next.when).toBeGreaterThan(entry?.when ?? Number.POSITIVE_INFINITY);
  });

  it("only adds a table and a per-customer index, idempotently", () => {
    expect(migration).not.toMatch(/\bDROP\b/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "payment_transfer_reference"/);
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS "payment_transfer_reference_customer_idx"\s+ON "payment_transfer_reference" \("stripe_customer_id"/,
    );
  });

  it("has a rollback that drops the index and the table", () => {
    expect(rollback).toMatch(/DROP INDEX IF EXISTS "payment_transfer_reference_customer_idx"/);
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "payment_transfer_reference"/);
  });

  it("matches the schema; the worker never reads it, and the API role may only insert and read", () => {
    const columns = getTableColumns(paymentTransferReference);
    expect(Object.keys(columns).sort()).toEqual(
      [
        "createdAt",
        "memberPaymentIds",
        "paymentGroupId",
        "paymentId",
        "privateSaleDealId",
        "privateSaleDealPaymentId",
        "reference",
        "stripeCustomerId",
        "stripePaymentIntentId",
      ].sort(),
    );
    expect(columns.reference.notNull).toBe(true);
    expect(columns.paymentId.notNull).toBe(false);
    expect(WORKER_READ_TABLES).not.toContain("payment_transfer_reference");
    expect(API_PAYMENT_TRANSFER_REFERENCE_TABLES).toContain("payment_transfer_reference");
  });
});
