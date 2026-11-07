import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { paymentGroup } from "./schema/payment-group.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0322_payment_group_received.sql");
const rollback = read("0322_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0322 payment group received", () => {
  it("is a journal entry after the one before it, in order", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0322_payment_group_received");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
  });

  it("only adds columns and a check, with a short lock timeout", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS "amount_received" numeric\(18, 2\) DEFAULT '0' NOT NULL/,
    );
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS "received_event_at" timestamp with time zone;/,
    );
    expect(migration).toMatch(/CHECK \("payment_group"\."amount_received" >= 0/);
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN)/);
  });

  it("has a rollback that drops the check and both columns", () => {
    expect(rollback).toMatch(/DROP CONSTRAINT IF EXISTS "payment_group_amount_received_check"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "received_event_at"/);
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "amount_received"/);
  });

  it("matches the schema", () => {
    const columns = getTableColumns(paymentGroup);
    expect(columns.amountReceived.notNull).toBe(true);
    expect(columns.receivedEventAt.notNull).toBe(false);
  });
});
