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
  it("follows the framing catalogue in the journal, with the next index and a later time", () => {
    const index = journal.entries.findIndex((e) => e.tag === "0338_shop_framing_on_editions");
    expect(index).toBeGreaterThan(0);
    const entry = journal.entries[index];
    const previous = journal.entries[index - 1];
    expect(previous?.tag).toBe("0331_shop_framing_catalogue");
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

  it("turns existing frame descriptions into 'comes framed by the artist', once and never over staff's own", () => {
    expect(migration).toContain('INSERT INTO "shop_edition_framing"');
    expect(migration).toContain(`'framed_by_artist', btrim(a."print_frame")`);
    expect(migration).toContain(`btrim(a."print_frame") <> ''`);
    expect(migration).toContain('ON CONFLICT ("artwork_id") DO NOTHING');
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
