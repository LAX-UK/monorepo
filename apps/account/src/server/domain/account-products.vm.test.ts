import { describe, expect, it } from "vitest";
import { buildAccountProducts } from "./account-products.vm";

describe("buildAccountProducts", () => {
  it("lists lax.art, LAX Shop and LAX Bid in family order with their configured URLs", () => {
    const products = buildAccountProducts({
      bidPublicUrl: "https://lax.bid",
      shopPublicUrl: "https://shop.lax.bid",
      laxArtPublicUrl: "https://lax.art",
    });
    expect(products.map((p) => [p.id, p.name, p.href])).toEqual([
      ["art", "lax.art", "https://lax.art"],
      ["shop", "LAX Shop", "https://shop.lax.bid"],
      ["bid", "LAX Bid", "https://lax.bid"],
    ]);
  });

  it("skips products without a configured URL", () => {
    expect(buildAccountProducts({ laxArtPublicUrl: "https://lax.art" }).map((p) => p.id)).toEqual([
      "art",
    ]);
    expect(buildAccountProducts({})).toEqual([]);
  });
});
