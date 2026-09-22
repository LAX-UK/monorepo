import { describe, expect, it } from "vitest";
import {
  buildCrossProductFooterLinks,
  buildProductDirectoryLinks,
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
    expect(links).toHaveLength(2);
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
    expect(footer).toHaveLength(1);
    expect(footer[0]?.id).toBe("bid");
  });
});
