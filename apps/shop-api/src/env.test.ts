import { describe, expect, it } from "vitest";
import { loadShopApiEnv } from "./env.js";

describe("loadShopApiEnv", () => {
  it("rejects missing database URL", () => {
    expect(() =>
      loadShopApiEnv({
        NODE_ENV: "test",
        DATABASE_URL_SHOP: "",
      }),
    ).toThrow(/Invalid Shop API environment/);
  });

  it("requires Stripe configuration in production", () => {
    expect(() =>
      loadShopApiEnv({
        NODE_ENV: "production",
        DATABASE_URL_SHOP: "postgresql://shop:shop@localhost:5432/auction",
        SHOP_API_BFF_TOKEN: "test-bff-token-minimum-32-characters-long",
      }),
    ).toThrow(/STRIPE_SECRET_KEY is required in production/);
  });

  it("accepts minimal valid configuration", () => {
    const env = loadShopApiEnv({
      NODE_ENV: "test",
      DATABASE_URL_SHOP: "postgresql://shop:shop@localhost:5432/auction",
    });
    expect(env.PORT).toBe(3011);
  });
});
