import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { collectionPlace } from "./schema/collection-booking.js";
import { lotFulfilment } from "./schema/lot-fulfilment.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0347_collection_storage_reminders.sql");
const rollback = read("0347_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0347 collection storage reminders", () => {
  it("follows an earlier migration in the journal, with the next index and a later time", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0347_collection_storage_reminders");
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(index).toBeGreaterThan(0);
    expect(Number(previous?.tag.slice(0, 4))).toBeLessThan(347);
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
  });

  it("only adds nullable columns and one check, with a short lock timeout", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toContain('"lot_fulfilment" ADD COLUMN IF NOT EXISTS "payment_cleared_at"');
    expect(migration).toContain(
      '"collection_place" ADD COLUMN IF NOT EXISTS "storage_charge_pence" integer;',
    );
    expect(migration).not.toMatch(/ADD COLUMN[^;]*NOT NULL|DROP COLUMN|UPDATE /);
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS "lot_fulfilment_payment_cleared_at_idx"',
    );
  });

  it("is reversed by a rollback that drops what it adds", () => {
    expect(rollback).toContain('DROP COLUMN IF EXISTS "storage_charge_pence"');
    expect(rollback).toContain('DROP COLUMN IF EXISTS "payment_cleared_at"');
    expect(rollback).toContain('DROP INDEX IF EXISTS "lot_fulfilment_payment_cleared_at_idx"');
  });

  it("is mirrored by the Drizzle tables", () => {
    expect(getTableColumns(collectionPlace).storageChargePence.name).toBe("storage_charge_pence");
    expect(getTableColumns(collectionPlace).storageChargePence.notNull).toBe(false);
    expect(getTableColumns(lotFulfilment).paymentClearedAt.name).toBe("payment_cleared_at");
    expect(getTableColumns(lotFulfilment).paymentClearedAt.notNull).toBe(false);
  });
});
