import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { shopArtwork } from "./schema/shop-commerce.js";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0163 contract", () => {
  it("adds nullable primary artwork media without changing ownership boundaries", async () => {
    const forward = await readFile(resolve(drizzle, "0163_shop_artwork_media.sql"), "utf8");

    expect(shopArtwork.primaryImageUrl.notNull).toBe(false);
    expect(forward).toContain('"primary_image_url" text');
    expect(forward).not.toContain("owner_party");
  });
});
