import { describe, expect, it } from "vitest";
import {
  SHOP_ROBOTS_DISALLOW,
  composeShopRobots,
  isShopIndexingAllowedForHost,
  publicRequestHost,
} from "./shop-indexing";

describe("isShopIndexingAllowedForHost", () => {
  it("indexes only the launch host unless overridden", () => {
    expect(isShopIndexingAllowedForHost("shop.lax.art", undefined)).toBe(true);
    expect(isShopIndexingAllowedForHost("SHOP.LAX.ART:443", undefined)).toBe(true);
    expect(isShopIndexingAllowedForHost("test-shop.lax.bid", undefined)).toBe(false);
    expect(isShopIndexingAllowedForHost("localhost:3020", undefined)).toBe(false);
    expect(isShopIndexingAllowedForHost("test-shop.lax.bid", "true")).toBe(true);
    expect(isShopIndexingAllowedForHost("shop.lax.art", "false")).toBe(false);
  });
});

describe("publicRequestHost", () => {
  it("prefers the first forwarded host", () => {
    const headers = new Headers({ "x-forwarded-host": "shop.lax.art, edge", host: "origin" });
    expect(publicRequestHost(headers)).toBe("shop.lax.art");
    expect(publicRequestHost(new Headers({ host: "origin:8080" }))).toBe("origin:8080");
  });
});

describe("composeShopRobots", () => {
  const baseUrl = new URL("https://shop.lax.art/");

  it("blocks every crawler off the launch host", () => {
    expect(composeShopRobots(baseUrl, false)).toEqual({
      rules: { userAgent: "*", disallow: "/" },
    });
  });

  it("publishes the sitemap and keeps private routes out on the launch host", () => {
    expect(composeShopRobots(baseUrl, true)).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: [...SHOP_ROBOTS_DISALLOW] },
      sitemap: "https://shop.lax.art/sitemap.xml",
      host: "https://shop.lax.art",
    });
  });
});
