import { describe, expect, it } from "vitest";
import {
  type CatalogueImageOrigins,
  type CatalogueImageViewer,
  createCatalogueImageResolver,
} from "./catalogue-image-url.js";

const origins: CatalogueImageOrigins = {
  shop: "https://test-shop.lax.bid/",
  art: "https://test-art.lax.bid",
};

const SHOP_SEED = "/shop/home/artwork-warm-basket.webp";
const ART_SEED = "/art/seed/artist-juno.webp";
const CDN = "https://lax-media.lon1.cdn.digitaloceanspaces.com/artworks/a.webp";

describe("createCatalogueImageResolver", () => {
  const cases: Array<[CatalogueImageViewer, string, string]> = [
    ["shop", SHOP_SEED, SHOP_SEED],
    ["shop", ART_SEED, ART_SEED],
    ["art", ART_SEED, ART_SEED],
    ["art", SHOP_SEED, `https://test-shop.lax.bid${SHOP_SEED}`],
    ["staff", SHOP_SEED, `https://test-shop.lax.bid${SHOP_SEED}`],
    ["staff", ART_SEED, `https://test-art.lax.bid${ART_SEED}`],
    ["shop", CDN, CDN],
    ["art", CDN, CDN],
    ["staff", CDN, CDN],
    ["staff", "/images/other.webp", "/images/other.webp"],
  ];

  it.each(cases)("%s viewer resolves %s", (viewer, input, expected) => {
    expect(createCatalogueImageResolver(viewer, origins)(input)).toBe(expected);
  });

  it("returns null for empty values", () => {
    const resolve = createCatalogueImageResolver("staff", origins);
    expect(resolve(null)).toBeNull();
    expect(resolve(undefined)).toBeNull();
    expect(resolve("  ")).toBeNull();
  });

  it("leaves a path relative when its owner's origin is not configured", () => {
    expect(createCatalogueImageResolver("staff", {})(SHOP_SEED)).toBe(SHOP_SEED);
    expect(createCatalogueImageResolver("art", { art: origins.art })(SHOP_SEED)).toBe(SHOP_SEED);
  });
});
