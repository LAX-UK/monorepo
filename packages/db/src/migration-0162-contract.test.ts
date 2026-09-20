import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { shopArtwork, shopEdition } from "./schema/shop-commerce.js";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0162 contract", () => {
  it("creates Shop commerce catalogue tables and can roll them back", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0162_shop_commerce_catalogue.sql"), "utf8"),
      readFile(resolve(drizzle, "0162_rollback.sql"), "utf8"),
    ]);

    expect(getTableName(shopArtwork)).toBe("shop_artwork");
    expect(getTableName(shopEdition)).toBe("shop_edition");
    expect(forward).toContain('"shop_artwork_import_key_uid"');
    expect(forward).toContain('"shop_edition_artwork_number_uid"');
    expect(forward).toContain("shop_edition_allocation");
    expect(rollback).toContain('DROP TABLE IF EXISTS "shop_edition"');
    expect(rollback.indexOf('"shop_edition"')).toBeLessThan(rollback.indexOf('"shop_artwork"'));
  });
});
