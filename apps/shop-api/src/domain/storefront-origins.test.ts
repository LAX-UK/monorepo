import { describe, expect, it } from "vitest";
import {
  artworkPublicUrl,
  assertStorefrontReturnUrlAllowed,
  resolveStorefrontOrigins,
} from "./storefront-origins.js";

describe("resolveStorefrontOrigins", () => {
  it("falls back art origin to shop when LAX art URL is unset", () => {
    expect(
      resolveStorefrontOrigins({
        shopStorefrontUrl: "https://shop.lax.art/",
        laxArtPublicUrl: undefined,
      }),
    ).toEqual({ shop: "https://shop.lax.art", art: "https://shop.lax.art" });
  });

  it("builds artwork URLs on the matching channel origin", () => {
    const origins = resolveStorefrontOrigins({
      shopStorefrontUrl: "https://shop.lax.art",
      laxArtPublicUrl: "https://lax.art",
    });
    expect(artworkPublicUrl(origins, "art", "demo-piece")).toBe(
      "https://lax.art/artworks/demo-piece",
    );
    expect(artworkPublicUrl(origins, "shop", "demo-print")).toBe(
      "https://shop.lax.art/artworks/demo-print",
    );
  });
});

describe("assertStorefrontReturnUrlAllowed", () => {
  const origins = resolveStorefrontOrigins({
    shopStorefrontUrl: "https://shop.lax.art",
    laxArtPublicUrl: "https://lax.art",
  });

  it("accepts return URLs on shop or art origins", () => {
    expect(() =>
      assertStorefrontReturnUrlAllowed("https://lax.art/account/payouts", origins),
    ).not.toThrow();
    expect(() =>
      assertStorefrontReturnUrlAllowed("https://shop.lax.art/account/payouts", origins),
    ).not.toThrow();
  });

  it("rejects untrusted origins", () => {
    expect(() => assertStorefrontReturnUrlAllowed("https://evil.example/return", origins)).toThrow(
      /connect_url_origin_not_allowed/,
    );
  });

  it("rejects look-alike hosts and scheme downgrades", () => {
    for (const url of [
      "https://lax.art.evil.example/account/payouts",
      "http://lax.art/account/payouts",
      "https://lax.art:8443/account/payouts",
    ]) {
      expect(() => assertStorefrontReturnUrlAllowed(url, origins)).toThrow(
        /connect_url_origin_not_allowed/,
      );
    }
  });

  it("compares by origin when a configured storefront URL carries a path", () => {
    const withPath = resolveStorefrontOrigins({
      shopStorefrontUrl: "https://lax.bid/shop/",
      laxArtPublicUrl: "https://test-art.lax.bid",
    });
    expect(() =>
      assertStorefrontReturnUrlAllowed("https://lax.bid/account/payouts", withPath),
    ).not.toThrow();
  });
});
