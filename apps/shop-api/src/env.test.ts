import { describe, expect, it } from "vitest";
import { loadShopApiEnv } from "./env.js";

function productionNodeBase(overrides: Record<string, string> = {}) {
  return {
    NODE_ENV: "production",
    DATABASE_URL_SHOP: "postgres://localhost/shop",
    SHOP_API_BFF_TOKEN: "b".repeat(32),
    STRIPE_SECRET_KEY: "sk_test_key",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    ...overrides,
  };
}

describe("loadShopApiEnv Connect platform", () => {
  it("allows bid_sandbox payouts on test when NODE_ENV is production", () => {
    expect(() =>
      loadShopApiEnv(
        productionNodeBase({
          APP_ENV: "test",
          SHOP_PAYOUTS_ENABLED: "true",
          STRIPE_SHOP_CONNECT_PLATFORM_KEY: "bid_sandbox",
        }),
      ),
    ).not.toThrow();
  });

  it("requires lax_art when deployment tier is production and payouts are enabled", () => {
    expect(() =>
      loadShopApiEnv(
        productionNodeBase({
          SHOP_PAYOUTS_ENABLED: "true",
          STRIPE_SHOP_CONNECT_PLATFORM_KEY: "bid_sandbox",
        }),
      ),
    ).toThrow(/STRIPE_SHOP_CONNECT_PLATFORM_KEY=lax_art/);
  });

  it("allows lax_art on production payouts", () => {
    expect(() =>
      loadShopApiEnv(
        productionNodeBase({
          APP_ENV: "production",
          SHOP_PAYOUTS_ENABLED: "true",
          STRIPE_SHOP_CONNECT_PLATFORM_KEY: "lax_art",
        }),
      ),
    ).not.toThrow();
  });
});
