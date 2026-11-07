import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { bidAlertMatch, shopAlertMatch } from "./schema/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0321_alert_match_matched_at_idx.sql");
const rollback = read("0321_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0321 alert match matched_at index", () => {
  it("is the last journal entry, one day after the entry before it", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0321_alert_match_matched_at_idx");
    expect(index).toBe(journal.entries.length - 1);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 24 * 60 * 60 * 1000);
  });

  it("only adds one index per match table, with a short lock timeout and no CONCURRENTLY", () => {
    expect(migration).not.toMatch(/\bDROP\b|\bALTER TABLE\b/);
    expect(migration).not.toMatch(/CREATE INDEX CONCURRENTLY/);
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS "bid_alert_match_matched_at_idx" ON "bid_alert_match" USING btree ("matched_at");',
    );
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS "shop_alert_match_matched_at_idx" ON "shop_alert_match" USING btree ("matched_at");',
    );
  });

  it("has a rollback that drops both indexes", () => {
    expect(rollback).toContain('DROP INDEX IF EXISTS "bid_alert_match_matched_at_idx"');
    expect(rollback).toContain('DROP INDEX IF EXISTS "shop_alert_match_matched_at_idx"');
  });

  it("matches the schema", () => {
    for (const [table, name] of [
      [bidAlertMatch, "bid_alert_match_matched_at_idx"],
      [shopAlertMatch, "shop_alert_match_matched_at_idx"],
    ] as const) {
      const index = getTableConfig(table).indexes.find((i) => i.config.name === name);
      expect(index, name).toBeDefined();
      expect(index?.config.columns.map((c) => (c as { name: string }).name)).toEqual([
        "matched_at",
      ]);
    }
  });
});
