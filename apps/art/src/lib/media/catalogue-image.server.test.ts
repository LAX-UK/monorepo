import { afterEach, describe, expect, it, vi } from "vitest";
import { artCatalogueImageSrcResolver } from "./catalogue-image.server";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("artCatalogueImageSrcResolver", () => {
  it("keeps lax.art seed images relative and loads Shop seed images from Shop", () => {
    vi.stubEnv("SHOP_STOREFRONT_URL", "https://test-shop.lax.bid");
    vi.stubEnv("LAX_ART_PUBLIC_URL", "https://test-art.lax.bid");
    const resolve = artCatalogueImageSrcResolver();

    expect(resolve("/art/seed/artist-juno.webp")).toBe("/art/seed/artist-juno.webp");
    expect(resolve("/shop/home/artwork-warm-basket.webp")).toBe(
      "https://test-shop.lax.bid/shop/home/artwork-warm-basket.webp",
    );
    expect(resolve("https://lax-media.lon1.cdn.digitaloceanspaces.com/a.webp")).toBe(
      "https://lax-media.lon1.cdn.digitaloceanspaces.com/a.webp",
    );
  });
});
