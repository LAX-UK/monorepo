import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES } from "./schema/notifications.js";

const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) => readFileSync(join(drizzleDir, name), "utf8");
const TAG = "0406_delivery_quote_decline";
/** The migration before this one on main. If 0405 lands first, this PR is renumbered after it. */
const PREVIOUS = "0404_artwork_stock_location";
const migration = read(`${TAG}.sql`);
const rollback = read("0406_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

/** The types a rebuilt `notification_type_check` in `sql` allows. */
function typeCheckList(sql: string): string[] {
  const at = sql.lastIndexOf("ADD CONSTRAINT notification_type_check");
  const list = sql.slice(at, sql.indexOf(")", sql.indexOf("IN (", at)));
  return [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string);
}

describe("migration 0406 delivery quote decline", () => {
  it("is the next journal entry, and its rollback removes its own ledger row", () => {
    const entry = journal.entries.find((e) => e.tag === TAG);
    const previous = journal.entries.find((e) => e.tag === PREVIOUS);
    expect(entry?.idx).toBe((previous?.idx ?? Number.NaN) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    expect(rollback).toContain(`WHERE created_at = ${entry?.when};`);
  });

  it("adds a nullable decline_reason with no default, under a lock timeout", () => {
    expect(migration.indexOf("SET LOCAL lock_timeout")).toBeLessThan(
      migration.indexOf("ALTER TABLE"),
    );
    expect(migration).toContain(
      'ALTER TABLE "delivery_quote" ADD COLUMN IF NOT EXISTS "decline_reason" text;',
    );
    // Nothing is rewritten: no NOT NULL, no default, no row updated or removed.
    expect(migration).not.toMatch(/NOT NULL|DEFAULT|\bUPDATE\b|\bDELETE\b|DROP COLUMN|DROP TABLE/);
  });

  it("allows a reason only on a withdrawn quote, trimmed and at most 500 characters", () => {
    expect(migration).toMatch(/"decline_reason" IS NULL OR \(\s*"status" = 'withdrawn'/);
    expect(migration).toContain('char_length("decline_reason") BETWEEN 1 AND 500');
    expect(migration).toContain('"decline_reason" = btrim("decline_reason")');
    expect(migration).toContain('VALIDATE CONSTRAINT "delivery_quote_decline_reason_check"');
  });

  it("adds delivery_quote_declined to the notification types and keeps every earlier one", () => {
    const before = typeCheckList(read("0402_notice_delivery_preferences.sql"));
    const after = typeCheckList(migration);
    expect(after).toEqual([...before, "delivery_quote_declined"]);
    expect(NOTIFICATION_TYPES).toContain("delivery_quote_declined");
  });

  it("rolls back to the 0402 list, removing only what it added", () => {
    expect(typeCheckList(rollback)).toEqual(
      typeCheckList(read("0402_notice_delivery_preferences.sql")),
    );
    expect(rollback).toContain("DELETE FROM notification WHERE type = 'delivery_quote_declined';");
    expect(rollback).toContain('DROP CONSTRAINT IF EXISTS "delivery_quote_decline_reason_check"');
    expect(rollback).toContain('DROP COLUMN IF EXISTS "decline_reason"');
    expect(rollback.indexOf("SET LOCAL lock_timeout")).toBeLessThan(
      rollback.indexOf("ALTER TABLE"),
    );
    expect(rollback).toMatch(/^BEGIN;$/m);
    expect(rollback).toMatch(/^COMMIT;$/m);
  });
});
