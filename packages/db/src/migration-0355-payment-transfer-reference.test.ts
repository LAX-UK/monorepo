import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { WORKER_READ_TABLES } from "./migrate-roles.js";
import { paymentTransferReference } from "./schema/payment-transfer-reference.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0355_payment_transfer_reference.sql");
const rollback = read("0355_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0355 payment transfer reference", () => {
  it("is the last journal entry, after 0351", () => {
    const last = journal.entries[journal.entries.length - 1];
    expect(last?.tag).toBe("0355_payment_transfer_reference");
    expect(last?.idx).toBe(349);
    expect(last?.when).toBe(1805702400000);
    expect(journal.entries[journal.entries.length - 2]?.tag).toBe(
      "0351_payment_checkout_session_parameters",
    );
  });

  it("only adds a table and a case-insensitive reference index, idempotently", () => {
    expect(migration).not.toMatch(/\bDROP\b/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "payment_transfer_reference"/);
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS "payment_transfer_reference_reference_idx"\s+ON "payment_transfer_reference" \(upper\("reference"\)\)/,
    );
  });

  it("has a rollback that drops the index and the table", () => {
    expect(rollback).toMatch(/DROP INDEX IF EXISTS "payment_transfer_reference_reference_idx"/);
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "payment_transfer_reference"/);
  });

  it("matches the schema; the worker never reads it, and the API role gets the default grants", () => {
    const columns = getTableColumns(paymentTransferReference);
    expect(Object.keys(columns).sort()).toEqual(
      ["createdAt", "paymentGroupId", "paymentId", "reference", "stripePaymentIntentId"].sort(),
    );
    expect(columns.reference.notNull).toBe(true);
    expect(columns.paymentId.notNull).toBe(false);
    expect(WORKER_READ_TABLES).not.toContain("payment_transfer_reference");
  });
});
