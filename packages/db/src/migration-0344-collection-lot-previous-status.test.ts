import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { collectionBookingLot } from "./schema/collection-booking.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0344_collection_lot_previous_status.sql");
const rollback = read("0344_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0344 collection lot previous status", () => {
  it("follows an earlier migration in the journal, with the next index and a later time", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0344_collection_lot_previous_status");
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(index).toBeGreaterThan(0);
    expect(Number(previous?.tag.slice(0, 4))).toBeLessThan(344);
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
  });

  it("adds one nullable column with a short lock timeout", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "previous_fulfilment_status" text;');
    expect(migration).not.toMatch(/NOT NULL|DROP /);
  });

  it("is mirrored by the schema and undone by the rollback", () => {
    expect(getTableColumns(collectionBookingLot).previousFulfilmentStatus.notNull).toBe(false);
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toContain('DROP COLUMN IF EXISTS "previous_fulfilment_status"');
    expect(rollback).toMatch(/COMMIT;/);
  });
});
