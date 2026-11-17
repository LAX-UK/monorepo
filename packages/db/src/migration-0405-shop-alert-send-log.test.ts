import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { shopAlertAnnouncement, shopAlertMatch } from "./schema/index.js";

const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) => readFileSync(join(drizzleDir, name), "utf8");
const TAG = "0405_shop_alert_send_log";
const migration = read(`${TAG}.sql`);
const rollback = read("0405_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const COLUMNS = [
  "kind",
  "announced_by",
  "matched_count",
  "emailed_count",
  "dropped_count",
  "dropped_reasons",
];

describe("migration 0405 shop alert send log", () => {
  it("is the last journal entry, and its rollback removes its own ledger row", () => {
    const at = journal.entries.findIndex((e) => e.tag === TAG);
    const entry = journal.entries[at];
    const previous = journal.entries[at - 1];
    expect(at).toBe(journal.entries.length - 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
    expect(rollback).toContain(`WHERE created_at = ${entry?.when};`);
  });

  it("adds nullable columns under a lock timeout, and gives the counters defaults only afterwards", () => {
    expect(migration.indexOf("SET LOCAL lock_timeout")).toBeLessThan(
      migration.indexOf("ALTER TABLE"),
    );
    for (const column of COLUMNS) {
      const add = new RegExp(`ADD COLUMN IF NOT EXISTS "${column}" [a-z]+;`);
      expect(migration, column).toMatch(add);
      expect(rollback).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    }
    expect(migration).not.toMatch(/NOT NULL/);
    // Rows from before 0405 must keep NULL counters, so the defaults come after the columns exist.
    for (const column of ["emailed_count", "dropped_count", "dropped_reasons"]) {
      expect(migration.indexOf(`ALTER COLUMN "${column}" SET DEFAULT`), column).toBeGreaterThan(
        migration.indexOf(`ADD COLUMN IF NOT EXISTS "${column}"`),
      );
    }
    expect(rollback).toMatch(/^BEGIN;$/m);
    expect(rollback).toMatch(/^COMMIT;$/m);
  });

  it("indexes matches by item for the send log, and the rollback drops the index", () => {
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS "shop_alert_match_item_key_idx" ON "shop_alert_match" USING btree ("item_key", "topic");',
    );
    expect(rollback).toContain('DROP INDEX IF EXISTS "shop_alert_match_item_key_idx"');
  });

  it("matches the schema", () => {
    const announcement = getTableConfig(shopAlertAnnouncement);
    const names = announcement.columns.map((c) => c.name);
    for (const column of COLUMNS) expect(names, column).toContain(column);
    const defaults = Object.fromEntries(
      announcement.columns.map((c) => [c.name, { notNull: c.notNull, hasDefault: c.hasDefault }]),
    );
    for (const column of COLUMNS) expect(defaults[column]?.notNull, column).toBe(false);
    expect(defaults.emailed_count?.hasDefault).toBe(true);
    expect(defaults.matched_count?.hasDefault).toBe(false);
    const index = getTableConfig(shopAlertMatch).indexes.find(
      (i) => i.config.name === "shop_alert_match_item_key_idx",
    );
    expect(index?.config.columns.map((c) => (c as { name: string }).name)).toEqual([
      "item_key",
      "topic",
    ]);
  });
});
