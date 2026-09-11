import { describe, expect, it } from "vitest";
import {
  shopIdentityBaseUrl,
  shopIdentityCookieHeader,
  shopIdentityUrl,
} from "./shop-identity.server.js";

describe("shopIdentityBaseUrl", () => {
  it("normalizes configured base URL", () => {
    process.env.SHOP_IDENTITY_BASE_URL = "https://test-shop.lax.bid/";
    expect(shopIdentityBaseUrl()).toBe("https://test-shop.lax.bid");
  });
});

describe("shopIdentityUrl", () => {
  it("joins configured base URL with BFF paths", () => {
    process.env.SHOP_IDENTITY_BASE_URL = "https://test-shop.lax.bid";
    expect(shopIdentityUrl("/me")).toBe("https://test-shop.lax.bid/me");
  });
});

describe("shopIdentityCookieHeader", () => {
  it("serializes browser cookies for server-side BFF requests", () => {
    expect(
      shopIdentityCookieHeader([
        { name: "shop_session", value: "abc" },
        { name: "oidc_id_token", value: "def" },
      ]),
    ).toBe("shop_session=abc; oidc_id_token=def");
  });
});
