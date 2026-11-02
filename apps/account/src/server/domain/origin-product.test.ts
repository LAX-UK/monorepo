import { describe, expect, it } from "vitest";
import { buildBackToProduct, detectOriginProduct, productForOrigin } from "./origin-product";

const config = { bid: "https://lax.bid", shop: "https://shop.lax.bid", art: "https://lax.art" };

describe("productForOrigin", () => {
  it("matches the configured origins, whatever the path", () => {
    expect(productForOrigin("https://lax.bid/lots/1?x=1", config)).toBe("bid");
    expect(productForOrigin("https://shop.lax.bid/", config)).toBe("shop");
    expect(productForOrigin("https://lax.art/artists", config)).toBe("art");
  });

  it("rejects foreign, lookalike, credentialed and malformed origins", () => {
    expect(productForOrigin("https://evil.example/", config)).toBeNull();
    expect(productForOrigin("https://lax.bid.evil.example/", config)).toBeNull();
    expect(productForOrigin("https://user:pw@lax.bid/", config)).toBeNull();
    expect(productForOrigin("http://lax.bid/", config)).toBeNull();
    expect(productForOrigin("javascript:alert(1)", config)).toBeNull();
    expect(productForOrigin("not a url", config)).toBeNull();
    expect(productForOrigin(null, config)).toBeNull();
  });
});

describe("detectOriginProduct", () => {
  it("takes an explicit product name first", () => {
    expect(detectOriginProduct({ from: "shop", referrer: "https://lax.bid/" }, config)).toBe(
      "shop",
    );
  });

  it("ignores a from value that is not a product, and falls back to the referrer", () => {
    expect(detectOriginProduct({ from: "https://evil.example" }, config)).toBeNull();
    expect(detectOriginProduct({ from: "admin", referrer: "https://lax.art/" }, config)).toBe(
      "art",
    );
  });

  it("knows nothing for a product that is not configured", () => {
    expect(detectOriginProduct({ from: "art" }, { ...config, art: undefined })).toBe(null);
  });

  it("knows nothing without a hint", () => {
    expect(detectOriginProduct({}, config)).toBeNull();
  });
});

describe("buildBackToProduct", () => {
  it("labels each product and links to its configured origin", () => {
    expect(buildBackToProduct("bid", config)).toEqual({
      id: "bid",
      label: "Back to LAX Bid",
      href: "https://lax.bid",
    });
    expect(buildBackToProduct("shop", config)?.label).toBe("Back to LAX Shop");
    expect(buildBackToProduct("art", config)?.label).toBe("Back to lax.art");
  });

  it("shows nothing for an unknown, tampered or unconfigured value", () => {
    expect(buildBackToProduct(undefined, config)).toBeNull();
    expect(buildBackToProduct("https://evil.example", config)).toBeNull();
    expect(buildBackToProduct("account", config)).toBeNull();
    expect(buildBackToProduct("art", { ...config, art: undefined })).toBeNull();
  });
});
