import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0345_shop_order_reaper_deferrals.sql");
const rollback = read("0345_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0345 shop order reaper deferrals", () => {
  it("follows 0341 in the journal, one day later", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0345_shop_order_reaper_deferrals");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(previous?.tag).toBe("0341_shop_framing_price_trigger_lock");
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBe((previous?.when ?? 0) + 24 * 60 * 60 * 1000);
  });

  it("is in the journal, one day after the entry before it", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0345_shop_order_reaper_deferrals");
    expect(index).toBeGreaterThan(0);
    // Later migrations chain after it, so only its own place is checked.
    expect(journal.entries[index]?.idx).toBe((journal.entries[index - 1]?.idx ?? 0) + 1);
  });

  it("only adds one column with a constant default, with a short lock timeout", () => {
    expect(migration).not.toMatch(/\bDROP\b|\bDELETE\b|\bUPDATE\b/);
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS "reaper_deferrals" integer DEFAULT 0 NOT NULL/,
    );
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
  });

  it("has a rollback that drops the column", () => {
    expect(rollback).toMatch(/DROP COLUMN IF EXISTS "reaper_deferrals"/);
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
  });
});
