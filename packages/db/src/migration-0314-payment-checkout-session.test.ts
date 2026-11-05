import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { WORKER_READ_TABLES } from "./migrate-roles.js";
import { paymentCheckoutSession } from "./schema/payment-checkout-session.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0314_payment_checkout_session.sql");
const rollback = read("0314_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0314 payment checkout session", () => {
  it("is journalled as entry 309, after 0313", () => {
    const entry = journal.entries.find((e) => e.tag === "0314_payment_checkout_session");
    expect(entry?.idx).toBe(309);
    expect(entry?.when).toBe(1802246400000);
    expect(journal.entries.at(-1)?.tag).toBe("0314_payment_checkout_session");
  });

  it("only adds one table and its index, idempotently", () => {
    expect(migration).not.toMatch(/\bDROP\b|\bALTER\b/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "payment_checkout_session"/);
    expect(migration).toMatch(/REFERENCES "payment"\("id"\) ON DELETE CASCADE/);
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS "payment_checkout_session_payment_id_idx"/,
    );
  });

  it("has a rollback that drops the table", () => {
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "payment_checkout_session";/);
  });

  it("matches the schema, and the worker's expiry job may read it", () => {
    const columns = getTableColumns(paymentCheckoutSession);
    expect(columns.stripeSessionId.primary).toBe(true);
    expect(columns.paymentId.notNull).toBe(true);
    expect(WORKER_READ_TABLES).toContain("payment_checkout_session");
  });
});
