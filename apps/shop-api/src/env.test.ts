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

describe("loadShopApiEnv LAX_ART_PUBLIC_URL", () => {
  it("is optional and treats an empty value as unset", () => {
    expect(loadShopApiEnv(productionNodeBase()).LAX_ART_PUBLIC_URL).toBeUndefined();
    expect(
      loadShopApiEnv(productionNodeBase({ LAX_ART_PUBLIC_URL: "" })).LAX_ART_PUBLIC_URL,
    ).toBeUndefined();
  });

  it("accepts an absolute URL", () => {
    expect(
      loadShopApiEnv(productionNodeBase({ LAX_ART_PUBLIC_URL: "https://test-art.lax.bid" }))
        .LAX_ART_PUBLIC_URL,
    ).toBe("https://test-art.lax.bid");
  });

  it("rejects a non-URL value", () => {
    expect(() => loadShopApiEnv(productionNodeBase({ LAX_ART_PUBLIC_URL: "lax.art" }))).toThrow();
  });
});

describe("loadShopApiEnv SHOP_EDITION_ORDER_LIMIT", () => {
  it("defaults to two copies of an edition per order", () => {
    expect(loadShopApiEnv(productionNodeBase()).SHOP_EDITION_ORDER_LIMIT).toBe(2);
  });

  it("takes a whole number, or none to leave only the stock", () => {
    expect(
      loadShopApiEnv(productionNodeBase({ SHOP_EDITION_ORDER_LIMIT: "4" }))
        .SHOP_EDITION_ORDER_LIMIT,
    ).toBe(4);
    expect(
      loadShopApiEnv(productionNodeBase({ SHOP_EDITION_ORDER_LIMIT: "none" }))
        .SHOP_EDITION_ORDER_LIMIT,
    ).toBeNull();
  });

  it("rejects anything else", () => {
    for (const value of ["0", "-1", "two", "1.5"]) {
      expect(() =>
        loadShopApiEnv(productionNodeBase({ SHOP_EDITION_ORDER_LIMIT: value })),
      ).toThrow();
    }
  });
});

describe("loadShopApiEnv lax.art revalidation", () => {
  const secret = "r".repeat(32);

  it("is optional as a pair", () => {
    const env = loadShopApiEnv(productionNodeBase());
    expect(env.ART_REVALIDATE_URL).toBeUndefined();
    expect(env.ART_REVALIDATE_SECRET).toBeUndefined();
  });

  it("accepts the URL and secret together", () => {
    const env = loadShopApiEnv(
      productionNodeBase({
        ART_REVALIDATE_URL: "https://lax.art/api/revalidate",
        ART_REVALIDATE_SECRET: secret,
      }),
    );
    expect(env.ART_REVALIDATE_URL).toBe("https://lax.art/api/revalidate");
  });

  it("rejects one without the other", () => {
    expect(() =>
      loadShopApiEnv(productionNodeBase({ ART_REVALIDATE_URL: "https://lax.art/api/revalidate" })),
    ).toThrow("must be set together");
    expect(() => loadShopApiEnv(productionNodeBase({ ART_REVALIDATE_SECRET: secret }))).toThrow(
      "must be set together",
    );
  });
});

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

describe("loadShopApiEnv editorial", () => {
  it("requires a preview secret when editorial is enabled on a production build", () => {
    expect(() => loadShopApiEnv(productionNodeBase({ SHOP_EDITORIAL_ENABLED: "true" }))).toThrow(
      /SHOP_EDITORIAL_PREVIEW_SECRET is required/,
    );
    expect(() =>
      loadShopApiEnv(
        productionNodeBase({
          SHOP_EDITORIAL_ENABLED: "true",
          SHOP_EDITORIAL_PREVIEW_SECRET: "p".repeat(32),
        }),
      ),
    ).not.toThrow();
    expect(() => loadShopApiEnv(productionNodeBase())).not.toThrow();
  });
});

describe("loadShopApiEnv SHOP_FINANCIAL_YEAR_END", () => {
  it("defaults to 30 September and reads a configured MM-DD", () => {
    expect(loadShopApiEnv(productionNodeBase()).SHOP_FINANCIAL_YEAR_END).toEqual({
      month: 9,
      day: 30,
    });
    expect(
      loadShopApiEnv(productionNodeBase({ SHOP_FINANCIAL_YEAR_END: "03-31" }))
        .SHOP_FINANCIAL_YEAR_END,
    ).toEqual({ month: 3, day: 31 });
  });

  it("refuses a date that is not a day of the year", () => {
    expect(() =>
      loadShopApiEnv(productionNodeBase({ SHOP_FINANCIAL_YEAR_END: "09-31" })),
    ).toThrow();
  });
});
