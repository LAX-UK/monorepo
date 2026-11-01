import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0270_sale_cover_slots.sql");
const rollback = read("0270_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0270 sale cover slots", () => {
  it("is journal entry 270, after 0268", () => {
    const entry = journal.entries.find((e) => e.tag === "0270_sale_cover_slots");
    const previous = journal.entries.find((e) => e.tag === "0268_watchlist_reminders");
    expect(entry?.idx).toBe(270);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? Number.POSITIVE_INFINITY);
  });

  it("adds the sale and lot columns and the analysis table", () => {
    for (const column of [
      '"cover_slots" jsonb',
      '"subtitle" text',
      '"featured_lot_ids" uuid[]',
      '"home_pin_order" smallint',
      '"consignment_deadline" timestamp with time zone',
      '"photo_includes_frame" boolean',
      '"framed_width_cm" numeric(7, 1)',
      '"framed_height_cm" numeric(7, 1)',
    ]) {
      expect(migration).toContain(column);
    }
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "cover_analysis"');
  });

  it("limits the pins to three places, each held by one sale", () => {
    expect(migration).toContain('"home_pin_order" BETWEEN 1 AND 3');
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "sale_home_pin_order_uid"/);
  });

  it("removes everything it added on rollback", () => {
    expect(rollback).toContain('DROP TABLE IF EXISTS "cover_analysis"');
    for (const column of [
      "cover_slots",
      "subtitle",
      "featured_lot_ids",
      "home_pin_order",
      "consignment_deadline",
      "photo_includes_frame",
      "framed_width_cm",
      "framed_height_cm",
    ]) {
      expect(rollback).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    }
  });
});
