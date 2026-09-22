import { describe, expect, it } from "vitest";
import { loadShopEnv } from "./env.js";

describe("loadShopEnv", () => {
  it("normalizes blank optional settings", () => {
    expect(
      loadShopEnv({
        SHOP_API_BASE_URL: " ",
        SHOP_IDENTITY_BASE_URL: "",
      }),
    ).toEqual({});
  });

  it("reads all Shop server URLs through one validated boundary", () => {
    expect(
      loadShopEnv({
        SHOP_API_BASE_URL: " https://api.shop.example ",
        SHOP_IDENTITY_BASE_URL: " https://identity-bff.shop.example ",
        IDENTITY_PUBLIC_BASE_URL: " https://identity.example ",
        LAX_BID_PUBLIC_URL: " https://bid.example ",
        SHOP_STOREFRONT_URL: " https://shop.example ",
      }),
    ).toMatchObject({
      SHOP_API_BASE_URL: "https://api.shop.example",
      SHOP_IDENTITY_BASE_URL: "https://identity-bff.shop.example",
      IDENTITY_PUBLIC_BASE_URL: "https://identity.example",
      LAX_BID_PUBLIC_URL: "https://bid.example",
      SHOP_STOREFRONT_URL: "https://shop.example",
    });
  });

  it("rejects malformed server URLs", () => {
    expect(() => loadShopEnv({ SHOP_API_BASE_URL: "not-a-url" })).toThrow();
  });
});
