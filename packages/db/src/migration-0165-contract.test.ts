import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { shopArtist, shopArtwork } from "./schema/shop-commerce.js";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0165 contract", () => {
  it("adds indexes for active catalogue cursor orderings", async () => {
    const forward = await readFile(
      resolve(drizzle, "0165_shop_catalogue_cursor_indexes.sql"),
      "utf8",
    );
    const artworkIndexes = getTableConfig(shopArtwork).indexes.map((index) => index.config.name);
    const artistIndexes = getTableConfig(shopArtist).indexes.map((index) => index.config.name);

    expect(artworkIndexes).toContain("shop_artwork_created_id_idx");
    expect(artistIndexes).toContain("shop_artist_created_id_idx");
    expect(forward).toContain('"shop_artwork" ("created_at" DESC, "id" DESC)');
    expect(forward).toContain('"shop_artist" ("created_at" DESC, "id" DESC)');
  });
});
