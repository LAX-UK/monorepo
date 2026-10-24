import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadShopCrossProductFooterLinks,
  loadShopStorefrontBaseUrl,
} from "./product-directory.server";

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubShopEnv(env: Record<string, string>) {
  vi.stubEnv("LAX_SHOP_STOREFRONT_URL", "");
  vi.stubEnv("SHOP_STOREFRONT_URL", "");
  vi.stubEnv("NEXT_PHASE", "");
  vi.stubEnv("LAX_BID_PUBLIC_URL", "https://lax.bid");
  vi.stubEnv("LAX_ART_PUBLIC_URL", "");
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
}

describe("loadShopStorefrontBaseUrl", () => {
  it("uses the configured storefront URL", () => {
    stubShopEnv({ NODE_ENV: "production", LAX_SHOP_STOREFRONT_URL: "https://shop.lax.art" });
    expect(loadShopStorefrontBaseUrl().toString()).toBe("https://shop.lax.art/");
  });

  it("refuses to fall back to localhost at production runtime", () => {
    stubShopEnv({ NODE_ENV: "production" });
    expect(() => loadShopStorefrontBaseUrl()).toThrow(/LAX_SHOP_STOREFRONT_URL is required/);
  });

  it("falls back to localhost during the build and in development", () => {
    stubShopEnv({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" });
    expect(loadShopStorefrontBaseUrl().origin).toBe("http://localhost:3020");
    stubShopEnv({ NODE_ENV: "development" });
    expect(loadShopStorefrontBaseUrl().origin).toBe("http://localhost:3020");
  });
});

describe("loadShopCrossProductFooterLinks", () => {
  it("links LAX Art to the configured Art URL", () => {
    stubShopEnv({
      NODE_ENV: "production",
      LAX_SHOP_STOREFRONT_URL: "https://shop.lax.art",
      LAX_ART_PUBLIC_URL: "https://test-art.lax.bid",
    });
    const art = loadShopCrossProductFooterLinks().find((l) => l.id === "art");
    expect(art?.href).toBe("https://test-art.lax.bid");
  });

  it("omits LAX Art rather than linking to localhost when it is unset in production", () => {
    stubShopEnv({ NODE_ENV: "production", LAX_SHOP_STOREFRONT_URL: "https://shop.lax.art" });
    const links = loadShopCrossProductFooterLinks();
    expect(links.map((l) => l.id)).toEqual(["bid"]);
    expect(JSON.stringify(links)).not.toContain("localhost");
  });
});
