import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { WORKER_READ_TABLES } from "./migrate-roles.js";
import { paymentCheckoutSession } from "./schema/payment-checkout-session.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0351_payment_checkout_session_parameters.sql");
const rollback = read("0351_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0351 payment checkout session parameters", () => {
  it("is journalled as entry 345, right after 0350", () => {
    const index = journal.entries.findIndex(
      (e) => e.tag === "0351_payment_checkout_session_parameters",
    );
    expect(journal.entries[index]?.idx).toBe(345);
    expect(journal.entries[index]?.when).toBe(1805356800000);
    expect(journal.entries[index - 1]?.tag).toBe("0350_email_outbox_stray_snapshot_index");
  });

  it("only adds nullable columns, idempotently", () => {
    expect(migration).not.toMatch(/\bDROP\b|NOT NULL/);
    for (const column of ["rail", "parameters_fingerprint", "closed_at"]) {
      expect(migration).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`);
    }
  });

  it("has a rollback that drops each column", () => {
    for (const column of ["rail", "parameters_fingerprint", "closed_at"]) {
      expect(rollback).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    }
  });

  it("matches the schema; the table's existing worker read grant covers the new columns", () => {
    const columns = getTableColumns(paymentCheckoutSession);
    expect(columns.rail.notNull).toBe(false);
    expect(columns.parametersFingerprint.notNull).toBe(false);
    expect(columns.closedAt.notNull).toBe(false);
    expect(WORKER_READ_TABLES).toContain("payment_checkout_session");
  });
});
