import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { SHOP_COMMERCE_TABLES } from "./migrate-roles.js";
import {
  shopFramingEditionOffer,
  shopFramingOption,
  shopFramingOptionPrice,
} from "./schema/shop-framing.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0331_shop_framing_catalogue.sql");
const rollback = read("0331_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

describe("migration 0331 shop framing catalogue", () => {
  it("follows 0330 in the journal, with the next index and a later time", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0331_shop_framing_catalogue");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(previous?.tag).toMatch(/^0330_/);
    expect(entry?.idx).toBe((previous?.idx ?? 0) + 1);
    expect(entry?.when).toBeGreaterThan(previous?.when ?? 0);
  });

  it("only adds tables and seeds, with a short lock timeout", () => {
    expect(migration).not.toMatch(/\bDROP (TABLE|COLUMN)\b/);
    expect(migration).not.toMatch(/\bALTER TABLE\b/);
    expect(migration).toMatch(/SET LOCAL lock_timeout = '5s'/);
    for (const table of [
      "shop_framing_option",
      "shop_framing_option_price",
      "shop_framing_edition_offer",
    ]) {
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`));
    }
  });

  it("seeds the launch options as drafts with placeholder prices, and can be re-applied", () => {
    const seeded = (migration.split('INSERT INTO "shop_framing_option"\n')[1] ?? "").split(
      "--> statement-breakpoint",
    )[0] as string;
    for (const code of ["black-wood", "white-wood", "natural-oak", "natural-oak-float"]) {
      expect(seeded).toContain(`'${code}'`);
    }
    expect(seeded).toContain("'float_conservation'");
    expect(seeded.match(/'draft', [0-9]+\)/g)?.length).toBe(4);
    expect(seeded).not.toContain("'active'");
    expect(migration.match(/\(('[a-z-]+'), 'up_to_[0-9x]+', [0-9]+\)/g)?.length).toBe(12);
    // Every seeded price is a placeholder, band by band.
    expect(migration).toContain('SELECT o."id", v."band", v."price_pence", true');
    expect(migration.match(/ON CONFLICT/g)?.length).toBe(2);
  });

  it("keeps an option from being active while any band's price is a placeholder, from either table", () => {
    expect(migration).toContain('"is_placeholder" boolean DEFAULT false NOT NULL');
    expect(migration).not.toContain("prices_placeholder");
    expect(migration).toMatch(
      /BEFORE INSERT OR UPDATE OF "status" ON "shop_framing_option"\s+FOR EACH ROW/,
    );
    expect(migration).toMatch(
      /BEFORE INSERT OR UPDATE OF "is_placeholder" ON "shop_framing_option_price"\s+FOR EACH ROW/,
    );
    expect(
      migration.match(/shop_framing_option_placeholder_not_offered_ck/g)?.length,
    ).toBeGreaterThan(1);
  });

  it("is mirrored by the schema tables", () => {
    expect(getTableName(shopFramingOption)).toBe("shop_framing_option");
    expect(Object.keys(getTableColumns(shopFramingOption))).toEqual(
      expect.arrayContaining([
        "code",
        "name",
        "frame",
        "mount",
        "glazing",
        "hanging",
        "leadTimeMinDays",
        "leadTimeMaxDays",
        "status",
        "sortOrder",
      ]),
    );
    expect(getTableName(shopFramingOptionPrice)).toBe("shop_framing_option_price");
    expect(getTableColumns(shopFramingOptionPrice).isPlaceholder.notNull).toBe(true);
    expect(Object.keys(getTableColumns(shopFramingOption))).not.toContain("pricesPlaceholder");
    expect(getTableColumns(shopFramingEditionOffer).priceOverridePence.notNull).toBe(false);
  });

  it("is granted to the shop role", () => {
    for (const table of [
      "shop_framing_option",
      "shop_framing_option_price",
      "shop_framing_edition_offer",
    ]) {
      expect([...SHOP_COMMERCE_TABLES]).toContain(table);
    }
  });

  it("is undone by dropping the three tables, children first, and the trigger function", () => {
    expect(rollback).toMatch(/^BEGIN;/m);
    expect(rollback).toMatch(/COMMIT;/);
    expect(rollback).toMatch(/lock_timeout = '5s'/);
    const drops = [...rollback.matchAll(/DROP TABLE IF EXISTS "([a-z_]+)"/g)].map((m) => m[1]);
    expect(drops).toEqual([
      "shop_framing_edition_offer",
      "shop_framing_option_price",
      "shop_framing_option",
    ]);
    expect(rollback).toContain('DROP FUNCTION IF EXISTS "shop_framing_no_placeholder_offer"()');
  });
});
