import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES } from "./schema/notifications.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const TAG = "0392_collection_notification_types";
const migration = read(`${TAG}.sql`);
const rollback = read("0392_rollback.sql");
const previousList = read("0354_lot_reoffer.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

const COLLECTION_NOTICES = [
  "collection_booked",
  "collection_changed",
  "collection_cancelled",
  "collection_reminder",
];

/** The quoted types of the last `notification_type_check` a script adds. */
function checkTypes(sql: string): string[] {
  const at = sql.lastIndexOf("ADD CONSTRAINT notification_type_check");
  const list = sql.slice(at, sql.indexOf(")", sql.indexOf("IN (", at)));
  return [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string);
}

describe("migration 0392 collection notification types", () => {
  it("is journalled right after 0391, in a journal that stays ordered", () => {
    const entry = journal.entries.find((e) => e.tag === TAG);
    const previous = journal.entries.find((e) => e.tag === "0391_consignment_agreement_versions");
    expect(entry?.idx).toBe((previous?.idx ?? Number.NaN) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("rebuilds the check under a lock timeout with the earlier list and the new types after its tail", () => {
    expect(migration.indexOf("SET LOCAL lock_timeout")).toBeLessThan(
      migration.indexOf("DROP CONSTRAINT IF EXISTS notification_type_check"),
    );
    expect(checkTypes(migration)).toEqual([...checkTypes(previousList), ...COLLECTION_NOTICES]);
    expect(migration).not.toMatch(/\b(UPDATE|DELETE|INSERT)\b/);
  });

  it("allows every type the schema declares up to its own", () => {
    const allowed = new Set(checkTypes(migration));
    // Later migrations add their own types; 0399's test keeps the final list whole.
    const LATER = ["sale_registration_decided", "bidding_limit_changed"];
    expect(
      NOTIFICATION_TYPES.filter((type) => !allowed.has(type) && !LATER.includes(type)),
    ).toEqual([]);
  });

  it("rolls back by deleting the collection notices, restoring the 0354 list and its ledger row", () => {
    for (const type of COLLECTION_NOTICES) expect(rollback).toContain(`'${type}'`);
    expect(rollback.indexOf("DELETE FROM notification")).toBeLessThan(
      rollback.indexOf("ADD CONSTRAINT notification_type_check"),
    );
    expect(checkTypes(rollback)).toEqual(checkTypes(previousList));
    const entry = journal.entries.find((e) => e.tag === TAG);
    expect(rollback).toContain(`created_at = ${entry?.when}`);
  });
});
