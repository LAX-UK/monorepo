import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  collectionBooking,
  collectionBookingLot,
  collectionException,
  collectionPlace,
  collectionWeeklyHours,
} from "./schema/collection-booking.js";
import { lotFulfilment } from "./schema/lot-fulfilment.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0334_collection_booking.sql");
const rollback = read("0334_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

const columnNames = (table: Parameters<typeof getTableColumns>[0]) =>
  Object.values(getTableColumns(table))
    .map((c) => c.name)
    .sort();

/** The column names a CREATE TABLE statement declares. */
function declaredColumns(sql: string, table: string): string[] {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS "${table}" (`);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf("\n);", start);
  return sql
    .slice(start, end)
    .split("\n")
    .map((line) => /^ {2}"([a-z_]+)" /.exec(line)?.[1])
    .filter((name): name is string => Boolean(name))
    .sort();
}

describe("migration 0334 collection booking", () => {
  it("follows the migration before it in the journal, one day later", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0334_collection_booking");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(previous?.tag).toBe("0332_shop_delivery_quote");
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 24 * 60 * 60 * 1000);
  });

  it("only adds: a sequence, five tables and one nullable column, with a short lock timeout", () => {
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).not.toMatch(/\bDROP\b|\bTRUNCATE\b|DELETE FROM|UPDATE "/);
    expect(migration.match(/CREATE TABLE IF NOT EXISTS "([a-z_]+)"/g)).toEqual([
      'CREATE TABLE IF NOT EXISTS "collection_place"',
      'CREATE TABLE IF NOT EXISTS "collection_weekly_hours"',
      'CREATE TABLE IF NOT EXISTS "collection_exception"',
      'CREATE TABLE IF NOT EXISTS "collection_booking"',
      'CREATE TABLE IF NOT EXISTS "collection_booking_lot"',
    ]);
    expect(migration).toMatch(
      /ALTER TABLE "lot_fulfilment" ADD COLUMN IF NOT EXISTS "collected_by_user_id" text;/,
    );
    expect(migration.match(/ALTER TABLE/g)).toHaveLength(2);
  });

  it("stops double booking with a partial unique index on the live place in a slot", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "collection_booking_seat_live_uidx"\s+ON "collection_booking" \("venue_id", "slot_start", "seat"\)\s+WHERE "status" = 'booked';/,
    );
  });

  it("books a request once with an idempotency key per account", () => {
    expect(migration).toMatch(
      /"collection_booking_idempotency_uidx"\s+ON "collection_booking" \("legal_entity_id", "idempotency_key"\)/,
    );
  });

  it("allows a lot in only one live booking", () => {
    expect(migration).toMatch(
      /"collection_booking_lot_active_uidx"\s+ON "collection_booking_lot" \("lot_id"\)\s+WHERE "active";/,
    );
  });

  it("numbers references COL-1000 upwards from a sequence", () => {
    expect(migration).toMatch(
      /CREATE SEQUENCE IF NOT EXISTS "collection_booking_reference_seq" AS bigint MINVALUE 1 START WITH 1000;/,
    );
    expect(migration).toMatch(
      /'COL-' \|\| lpad\(nextval\('collection_booking_reference_seq'\)::text, 4, '0'\)/,
    );
  });

  it("keeps the personal data of an unregistered collector out of any key or index", () => {
    const indexes = migration.match(/CREATE (?:UNIQUE )?INDEX[\s\S]*?;/g)?.join("\n") ?? "";
    expect(indexes).not.toMatch(/collector_(name|email|company)/);
  });

  it("is mirrored by the Drizzle tables, column for column", () => {
    // Later migrations add columns to the place: the per-account visit cap and the storage charge.
    expect(columnNames(collectionPlace)).toEqual(
      [
        ...declaredColumns(migration, "collection_place"),
        "max_active_visits",
        "storage_charge_pence",
      ].sort(),
    );
    expect(columnNames(collectionWeeklyHours)).toEqual(
      declaredColumns(migration, "collection_weekly_hours"),
    );
    expect(columnNames(collectionException)).toEqual(
      declaredColumns(migration, "collection_exception"),
    );
    expect(columnNames(collectionBooking)).toEqual(
      declaredColumns(migration, "collection_booking"),
    );
    expect(columnNames(collectionBookingLot)).toEqual(
      declaredColumns(migration, "collection_booking_lot"),
    );
    const staff = getTableColumns(lotFulfilment).collectedByUserId;
    expect(staff.name).toBe("collected_by_user_id");
    expect(staff.notNull).toBe(false);
  });

  it("starts online booking off, with the gallery's rules as defaults", () => {
    const place = getTableColumns(collectionPlace);
    expect(place.onlineBookingEnabled.default).toBe(false);
    expect(place.visitMinutes.default).toBe(30);
    expect(place.placesPerSlot.default).toBe(2);
    expect(place.noticeCutoffLocal.default).toBe("16:00");
    expect(place.noticeWorkingDays.default).toBe(1);
    expect(place.windowDays.default).toBe(28);
    expect(place.closeOnSaleDays.default).toBe(true);
    expect(place.undoHandOverMinutes.default).toBe(10);
    expect(place.freeStorageDays.notNull).toBe(false);
  });

  it("is undone by dropping what it added, after refusing while visits are booked", () => {
    expect(rollback).toMatch(/SET LOCAL lock_timeout = '30s'/);
    expect(rollback).toMatch(/'booked'[\s\S]*RAISE EXCEPTION/);
    for (const table of [
      "collection_booking_lot",
      "collection_booking",
      "collection_exception",
      "collection_weekly_hours",
      "collection_place",
    ]) {
      expect(rollback).toContain(`DROP TABLE IF EXISTS "${table}";`);
    }
    expect(rollback).toContain('DROP COLUMN IF EXISTS "collected_by_user_id"');
    expect(rollback).toContain('DROP SEQUENCE IF EXISTS "collection_booking_reference_seq"');
    // Lots first, then the bookings they point at.
    expect(rollback.indexOf('"collection_booking_lot"')).toBeLessThan(
      rollback.indexOf('DROP TABLE IF EXISTS "collection_booking";'),
    );
  });
});
