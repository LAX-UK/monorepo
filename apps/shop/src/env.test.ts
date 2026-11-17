import { describe, expect, it } from "vitest";
import { loadShopEnv } from "./env";

describe("loadShopEnv", () => {
  it("requires LAX_BID_PUBLIC_URL or WEB_ORIGIN in production runtime", () => {
    expect(() => loadShopEnv({ NODE_ENV: "production" })).toThrow(/LAX_BID_PUBLIC_URL|WEB_ORIGIN/);
    expect(
      loadShopEnv({
        NODE_ENV: "production",
        WEB_ORIGIN: "https://test.lax.bid",
      }).WEB_ORIGIN,
    ).toBe("https://test.lax.bid");
  });

  it("allows missing LAX_BID_PUBLIC_URL during Next production build", () => {
    expect(
      loadShopEnv({
        NODE_ENV: "production",
        NEXT_PHASE: "phase-production-build",
      }).LAX_BID_PUBLIC_URL,
    ).toBeUndefined();
  });

  it("keeps express checkout off unless SHOP_EXPRESS_CHECKOUT is true", () => {
    expect(loadShopEnv({}).SHOP_EXPRESS_CHECKOUT).toBe(false);
    expect(loadShopEnv({ SHOP_EXPRESS_CHECKOUT: "false" }).SHOP_EXPRESS_CHECKOUT).toBe(false);
    expect(loadShopEnv({ SHOP_EXPRESS_CHECKOUT: " " }).SHOP_EXPRESS_CHECKOUT).toBe(false);
    expect(loadShopEnv({ SHOP_EXPRESS_CHECKOUT: "true" }).SHOP_EXPRESS_CHECKOUT).toBe(true);
  });

  it("refuses any other SHOP_EXPRESS_CHECKOUT value", () => {
    expect(() => loadShopEnv({ SHOP_EXPRESS_CHECKOUT: "1" })).toThrow();
    expect(() => loadShopEnv({ SHOP_EXPRESS_CHECKOUT: "TRUE" })).toThrow();
  });
});
