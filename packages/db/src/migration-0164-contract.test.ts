import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { shopArtwork, shopCategory, shopHomePlacement } from "./schema/shop-commerce.js";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0164 contract", () => {
  it("adds storefront curation tables without owner-party exposure", async () => {
    const forward = await readFile(resolve(drizzle, "0164_shop_storefront_curation.sql"), "utf8");

    expect(shopCategory.slug.notNull).toBe(true);
    expect(shopHomePlacement.slot.notNull).toBe(true);
    expect(shopArtwork.saleState.notNull).toBe(true);
    expect(forward).toContain("shop_home_placement_target_arc");
    expect(forward).toContain("shop_home_placement_position_nonnegative");
    expect(forward).toContain(`"slot" = 'featured_categories'`);
    expect(forward).toContain(`"slot" = 'featured_artists'`);
    expect(forward).toContain("shop_placement_slot");
    expect(forward).not.toContain("owner_party");
  });
});
