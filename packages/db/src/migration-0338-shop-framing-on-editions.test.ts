import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { SHOP_COMMERCE_TABLES } from "./migrate-roles.js";
import { shopBasketLine } from "./schema/shop-commerce.js";
import { shopEditionFraming } from "./schema/shop-framing.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0338_shop_framing_on_editions.sql");
const rollback = read("0338_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0338 shop framing on editions", () => {
  it("follows an earlier migration in the journal, with the next index and a later time", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0338_shop_framing_on_editions");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    // Re-chained after whatever was last on main when it merged; it only has to follow it.
    expect(Number(previous?.tag.slice(0, 4))).toBeLessThan(338);
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
  });

  it("only adds a table and a nullable column, with a short lock timeout", () => {
    expect(migration).not.toMatch(/\bDROP (TABLE|COLUMN)\b/);
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS "shop_edition_framing"/);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS "framing_option_id" uuid;/);
    expect(migration.match(/ADD COLUMN[^;]*;/g)?.join("")).not.toMatch(/NOT NULL/);
  });

  it("keeps framing to prints and each edition to a known mode", () => {
    expect(migration).toContain(`CHECK ("framing_option_id" IS NULL OR "artwork_id" IS NOT NULL)`);
    expect(migration).toContain(
      `CHECK ("mode" IN ('unframed_or_framed', 'framed_only', 'framed_by_artist'))`,
    );
    expect(migration).toContain(
      `CHECK (("mode" = 'framed_by_artist') = ("framed_by_artist" IS NOT NULL))`,
    );
  });

  describe("the data step for existing frame descriptions", () => {
    const step = migration.slice(migration.indexOf('INSERT INTO "shop_edition_framing"'));

    it("copies a description as 'comes framed by the artist', once and never over staff's own", () => {
      expect(step).toContain(`'framed_by_artist', left(btrim(a."print_frame"), 500)`);
      expect(step).toContain(`btrim(a."print_frame") <> ''`);
      expect(step).toContain('ON CONFLICT ("artwork_id") DO NOTHING');
    });

    it("cuts a long description to the 500 characters a description may hold", () => {
      expect(step).toContain('left(btrim(a."print_frame"), 500)');
    });

    it("skips text that says the opposite, in any case", () => {
      const pattern = step.match(/!~\* '([^']+)'/)?.[1];
      expect(pattern).toBeDefined();
      const regex = new RegExp(
        (pattern ?? "").replaceAll("\\m", "\\b").replaceAll("\\M", "\\b"),
        "i",
      );
      for (const opposite of [
        "Unframed",
        "UNFRAMED",
        "No frame",
        "not framed",
        "Frame available",
        "Framing on request",
        "Optional",
      ]) {
        expect(regex.test(opposite), opposite).toBe(true);
      }
      for (const frame of [
        "Oak frame by the artist",
        "Framed in black wood",
        "Walnut, white mount",
      ]) {
        expect(regex.test(frame), frame).toBe(false);
      }
    });

    it("skips editions that already offer framing options", () => {
      expect(step).toContain('FROM "shop_framing_edition_offer" o WHERE o."artwork_id" = a."id"');
      expect(step).toMatch(/AND NOT EXISTS/);
    });
  });

  it("leaves the old column alone, going and coming back", () => {
    expect(migration).not.toMatch(/ALTER TABLE "shop_artwork"/);
    expect(migration).not.toMatch(/UPDATE "shop_artwork"/);
    expect(rollback).not.toMatch(/ALTER TABLE "shop_artwork"|DROP COLUMN[^;]*print_frame/);
  });

  it("is mirrored by the schema", () => {
    expect(getTableName(shopEditionFraming)).toBe("shop_edition_framing");
    expect(getTableColumns(shopBasketLine).framingOptionId.notNull).toBe(false);
    expect([...SHOP_COMMERCE_TABLES]).toContain("shop_edition_framing");
  });

  it("is undone by dropping the column, its checks and the table", () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
    expect(rollback).toMatch(/lock_timeout = '5s'/);
    expect(rollback).toContain('DROP COLUMN IF EXISTS "framing_option_id"');
    expect(rollback).toContain('DROP TABLE IF EXISTS "shop_edition_framing"');
  });
});
