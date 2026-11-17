import { afterEach, describe, expect, it, vi } from "vitest";
import { shopExpressCheckoutPublishableKey } from "./shop-runtime-flags";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shopExpressCheckoutPublishableKey", () => {
  it("is null while SHOP_EXPRESS_CHECKOUT is off, even with a key", () => {
    vi.stubEnv("SHOP_EXPRESS_CHECKOUT", "false");
    vi.stubEnv("SHOP_STRIPE_PUBLISHABLE_KEY", "pk_test_abc123");
    expect(shopExpressCheckoutPublishableKey()).toBeNull();
  });

  it("is the key when the flag is on and the key is a publishable key", () => {
    vi.stubEnv("SHOP_EXPRESS_CHECKOUT", "true");
    vi.stubEnv("SHOP_STRIPE_PUBLISHABLE_KEY", "pk_test_abc123");
    expect(shopExpressCheckoutPublishableKey()).toBe("pk_test_abc123");
  });

  it("keeps the row off without a key, or with anything but a publishable key", () => {
    vi.stubEnv("SHOP_EXPRESS_CHECKOUT", "true");
    vi.stubEnv("SHOP_STRIPE_PUBLISHABLE_KEY", "");
    expect(shopExpressCheckoutPublishableKey()).toBeNull();
    vi.stubEnv("SHOP_STRIPE_PUBLISHABLE_KEY", "sk_test_secret");
    expect(shopExpressCheckoutPublishableKey()).toBeNull();
  });
});
