import { afterEach, describe, expect, it, vi } from "vitest";
import { checkoutReturnUrls } from "./checkout-return-urls.server";

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubEnv(env: Record<string, string>) {
  vi.stubEnv("LAX_SHOP_STOREFRONT_URL", "");
  vi.stubEnv("SHOP_STOREFRONT_URL", "");
  vi.stubEnv("NEXT_PHASE", "");
  vi.stubEnv("LAX_BID_PUBLIC_URL", "https://lax.bid");
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
}

describe("checkoutReturnUrls", () => {
  it("returns the shopper to the configured storefront", () => {
    stubEnv({ NODE_ENV: "production", LAX_SHOP_STOREFRONT_URL: "https://shop.lax.art" });
    expect(checkoutReturnUrls()).toEqual({
      successUrl: "https://shop.lax.art/checkout/confirmation?orderId={ORDER_ID}",
      cancelUrl: "https://shop.lax.art/checkout/cancel?orderId={ORDER_ID}",
    });
  });

  it("uses localhost in development, where no URL is configured", () => {
    stubEnv({ NODE_ENV: "development" });
    expect(checkoutReturnUrls().cancelUrl).toBe(
      "http://localhost:3020/checkout/cancel?orderId={ORDER_ID}",
    );
  });

  it("refuses to build a return URL in production without a configured storefront", () => {
    stubEnv({ NODE_ENV: "production" });
    expect(() => checkoutReturnUrls()).toThrow(/LAX_SHOP_STOREFRONT_URL is required/);
  });
});
