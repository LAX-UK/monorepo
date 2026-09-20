import { describe, expect, it } from "vitest";
import { shopIdentityProxyUrl } from "./shop-identity-proxy.server.js";

describe("shopIdentityProxyUrl", () => {
  it("maps commerce paths onto the storefront proxy", () => {
    expect(shopIdentityProxyUrl("/commerce/basket")).toBe("/api/shop-identity/commerce/basket");
    expect(shopIdentityProxyUrl("commerce/csrf")).toBe("/api/shop-identity/commerce/csrf");
  });
});
