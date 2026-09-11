import { describe, expect, it } from "vitest";
import { shopIdentityBaseUrl } from "./shop-identity.server.js";

describe("shopIdentityBaseUrl", () => {
  it("normalizes configured base URL", () => {
    process.env.SHOP_IDENTITY_BASE_URL = "https://test-shop.lax.bid/";
    expect(shopIdentityBaseUrl()).toBe("https://test-shop.lax.bid");
  });
});
