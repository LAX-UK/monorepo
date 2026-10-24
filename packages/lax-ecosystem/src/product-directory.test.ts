import { describe, expect, it } from "vitest";
import {
  buildCrossProductFooterLinks,
  buildProductDirectoryLinks,
  isLocalProductFallbackAllowed,
  resolveProductDirectoryConfig,
} from "./product-directory.js";

describe("product-directory", () => {
  it("builds switcher links with current product marked", () => {
    const resolved = resolveProductDirectoryConfig({
      currentProductId: "bid",
      bidPublicUrl: "http://localhost:3000",
      shopStorefrontUrl: "http://localhost:3020",
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const links = buildProductDirectoryLinks(resolved.config);
    expect(links).toHaveLength(3);
    const bid = links.find((l) => l.id === "bid");
    const shop = links.find((l) => l.id === "shop");
    expect(bid?.current).toBe(true);
    expect(shop?.external).toBe(true);
    expect(shop?.href).toBe("http://localhost:3020");
  });

  it("returns only cross-product footer links", () => {
    const resolved = resolveProductDirectoryConfig({
      currentProductId: "shop",
      bidPublicUrl: "https://lax.bid",
      shopStorefrontUrl: "https://shop.lax.art",
    });
    if (!resolved.ok) throw new Error("expected ok");
    const footer = buildCrossProductFooterLinks(resolved.config);
    expect(footer).toHaveLength(2);
    expect(footer.map((l) => l.id).sort()).toEqual(["art", "bid"]);
  });
});

describe("product-directory localhost fallback", () => {
  it("falls back to local dev ports by default", () => {
    const resolved = resolveProductDirectoryConfig({ currentProductId: "shop" });
    if (!resolved.ok) throw new Error("expected ok");
    expect(resolved.config.artPublicUrl).toBe("http://localhost:3050");
  });

  it("omits an unset product instead of linking to localhost when the fallback is off", () => {
    const resolved = resolveProductDirectoryConfig({
      currentProductId: "shop",
      bidPublicUrl: "https://lax.bid",
      shopStorefrontUrl: "https://shop.lax.art",
      allowLocalFallback: false,
    });
    if (!resolved.ok) throw new Error("expected ok");
    const links = buildProductDirectoryLinks(resolved.config);
    expect(links.map((l) => l.id)).toEqual(["bid", "shop"]);
    expect(JSON.stringify(links)).not.toContain("localhost");
  });

  it("keeps a configured product when the fallback is off", () => {
    const resolved = resolveProductDirectoryConfig({
      currentProductId: "shop",
      bidPublicUrl: "https://lax.bid",
      shopStorefrontUrl: "https://shop.lax.art",
      artPublicUrl: "https://www.thelax.art/",
      allowLocalFallback: false,
    });
    if (!resolved.ok) throw new Error("expected ok");
    expect(buildCrossProductFooterLinks(resolved.config).find((l) => l.id === "art")?.href).toBe(
      "https://www.thelax.art",
    );
  });

  it("allows the fallback outside production and during the Next build only", () => {
    expect(isLocalProductFallbackAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(isLocalProductFallbackAllowed({})).toBe(true);
    expect(
      isLocalProductFallbackAllowed({
        NODE_ENV: "production",
        NEXT_PHASE: "phase-production-build",
      }),
    ).toBe(true);
    expect(isLocalProductFallbackAllowed({ NODE_ENV: "production" })).toBe(false);
  });
});
