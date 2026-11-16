import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES } from "./schema/notifications.js";

const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) => readFileSync(join(drizzleDir, name), "utf8");
const TAG = "0402_notice_delivery_preferences";
const migration = read(`${TAG}.sql`);
const rollback = read("0402_rollback.sql");
const previousList = read("0392_collection_notification_types.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

const NEW_TYPES = ["sale_registration_decided", "bidding_limit_changed"];
const COLUMNS = ["identity_in_app", "registration_in_app"];

function checkTypes(sql: string): string[] {
  const at = sql.lastIndexOf("ADD CONSTRAINT notification_type_check");
  const list = sql.slice(at, sql.indexOf(")", sql.indexOf("IN (", at)));
  return [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string);
}

describe("migration 0402 notice delivery preferences", () => {
  it("is the next journal entry after 0401, in a journal that stays ordered", () => {
    const entry = journal.entries.find((e) => e.tag === TAG);
    const previous = journal.entries.find((e) => e.tag === "0401_enquiry_inbound_review");
    expect(entry?.idx).toBe((previous?.idx ?? Number.NaN) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    expect(journal.entries.at(-1)?.tag).toBe(TAG);
  });

  it("adds the two switches on by default, under a lock timeout", () => {
    expect(migration.indexOf("SET LOCAL lock_timeout")).toBeLessThan(
      migration.indexOf("ALTER TABLE"),
    );
    for (const column of COLUMNS) {
      expect(migration).toMatch(
        new RegExp(`ADD COLUMN IF NOT EXISTS "${column}" boolean DEFAULT true NOT NULL`),
      );
    }
  });

  it("writes only the artist and saved-search app switches, and deletes nothing", () => {
    expect(migration).not.toMatch(/\bDELETE\b/);
    expect(migration.match(/\b(INSERT|UPDATE)\b/g)).toEqual(["INSERT", "UPDATE"]);
    expect(migration).toContain('INSERT INTO "notification_preference"');
    expect(migration).toContain('ON CONFLICT ("user_id") DO UPDATE SET');
  });

  it("adds the rebuilt type check without scanning the table", () => {
    expect(migration).toMatch(/'bidding_limit_changed'\s*\)\s*\)\s*NOT VALID;/);
  });

  it("rebuilds the type check with the 0392 list and the two new types after its tail", () => {
    expect(checkTypes(migration)).toEqual([...checkTypes(previousList), ...NEW_TYPES]);
  });

  it("allows every type the schema declares", () => {
    const allowed = new Set(checkTypes(migration));
    expect(NOTIFICATION_TYPES.filter((type) => !allowed.has(type))).toEqual([]);
  });

  it("rolls back by deleting the two notices, dropping the columns and restoring the 0392 list", () => {
    for (const type of NEW_TYPES) expect(rollback).toContain(`'${type}'`);
    for (const column of COLUMNS) expect(rollback).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    expect(rollback.indexOf("DELETE FROM notification")).toBeLessThan(
      rollback.indexOf("ADD CONSTRAINT notification_type_check"),
    );
    expect(checkTypes(rollback)).toEqual(checkTypes(previousList));
    const entry = journal.entries.find((e) => e.tag === TAG);
    expect(rollback).toContain(`created_at = ${entry?.when}`);
  });
});
