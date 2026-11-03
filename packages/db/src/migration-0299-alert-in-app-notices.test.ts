import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES } from "./schema/notifications.js";

const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) => readFileSync(join(drizzleDir, name), "utf8");
const migration = read("0299_alert_in_app_notices.sql");
const rollback = read("0299_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

const NEW_TYPES = ["artist_lots_listed", "search_lots_listed"];

const typesIn = (sql: string) => {
  const at = sql.lastIndexOf("ADD CONSTRAINT notification_type_check");
  const list = sql.slice(at, sql.indexOf(")", sql.indexOf("IN (", at)));
  return [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
};

describe("migration 0299 alert in-app notices", () => {
  it("is journal entry 299, dated after the entry before it", () => {
    const at = journal.entries.findIndex((e) => e.tag === "0299_alert_in_app_notices");
    expect(journal.entries[at]?.idx).toBe(299);
    expect(journal.entries[at]?.when).toBe(1801382400000);
    const previous = journal.entries.find((e) => e.tag === "0290_alert_followers");
    expect(journal.entries[at]?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("allows every type the schema lists, the two new ones included", () => {
    expect(typesIn(migration)).toEqual([...NOTIFICATION_TYPES]);
    for (const type of [...NEW_TYPES, "sale_announced", "buyer_default_notice", "outbid"]) {
      expect(typesIn(migration)).toContain(type);
    }
  });

  it("rolls back to the previous list and deletes the notices the old constraint refuses", () => {
    expect(typesIn(rollback)).toEqual(NOTIFICATION_TYPES.filter((t) => !NEW_TYPES.includes(t)));
    expect(rollback).toContain(
      "DELETE FROM notification WHERE type IN ('artist_lots_listed', 'search_lots_listed')",
    );
    expect(rollback.indexOf("DELETE FROM notification")).toBeLessThan(
      rollback.indexOf("ADD CONSTRAINT notification_type_check"),
    );
  });

  it("adds the two app switches on by default, and drops them on rollback", () => {
    for (const column of ["artist_alerts_in_app", "search_alerts_in_app"]) {
      expect(migration).toContain(`"${column}" boolean DEFAULT true NOT NULL`);
      expect(rollback).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    }
  });

  it("keeps one notice per digest and type in the database, and only site paths as links", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "notification_alert_digest_type_uid"\n  ON "notification" ("alert_digest_id", "type") WHERE "alert_digest_id" IS NOT NULL',
    );
    expect(migration).toContain(`"link_path" LIKE '/%' AND "link_path" NOT LIKE '//%'`);
    expect(rollback).toContain('DROP INDEX IF EXISTS "notification_alert_digest_type_uid"');
  });

  it("is rerunnable", () => {
    expect(migration).not.toMatch(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/);
    expect(migration.match(/ADD COLUMN/g)?.length).toBe(4);
    expect(migration.match(/ADD COLUMN IF NOT EXISTS/g)?.length).toBe(4);
  });
});
