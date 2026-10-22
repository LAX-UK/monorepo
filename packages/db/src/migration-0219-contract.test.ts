import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0219 editorial content fields", () => {
  it("is additive so an older shop-api keeps reading and writing editorial rows", async () => {
    const forward = await readFile(
      resolve(drizzle, "0219_shop_editorial_content_fields.sql"),
      "utf8",
    );
    expect(forward).toContain("lock_timeout");
    expect(forward).not.toMatch(/\bDROP\s+(COLUMN|TABLE|TYPE)\b/i);
    expect(forward).not.toMatch(/\bRENAME\b/i);
    expect(forward).not.toMatch(/\bSET\s+NOT\s+NULL\b/i);
    for (const match of forward.matchAll(/ADD COLUMN IF NOT EXISTS "(\w+)" ([^,;\n]+)/g)) {
      const [, column, definition] = match;
      if (/NOT NULL/i.test(definition ?? "")) {
        expect(definition, `${column} is NOT NULL without a default`).toMatch(/DEFAULT/i);
      }
    }
  });

  it("adds the podcast kind and the home and Art hub placement slots", async () => {
    const forward = await readFile(
      resolve(drizzle, "0219_shop_editorial_content_fields.sql"),
      "utf8",
    );
    expect(forward).toContain(`"shop_editorial_story_kind" ADD VALUE IF NOT EXISTS 'podcast'`);
    for (const slot of [
      "home_promo_bid",
      "home_promo_shop",
      "art_hub_now_on",
      "art_hub_podcast",
      "art_hub_films",
      "art_hub_press",
      "art_hub_feature",
    ]) {
      expect(forward).toContain(`ADD VALUE IF NOT EXISTS '${slot}'`);
    }
  });

  it("rolls back columns and the category type but documents the irreversible enum labels", async () => {
    const rollback = await readFile(resolve(drizzle, "0219_rollback.sql"), "utf8");
    expect(rollback).toContain("Irreversible");
    expect(rollback).toContain(`DROP TYPE IF EXISTS "public"."shop_editorial_story_category"`);
    expect(rollback).toContain(`DROP COLUMN IF EXISTS "position"`);
  });
});
