import { describe, expect, it } from "vitest";
import { deviceProductNames } from "./device-product-names.js";

describe("deviceProductNames", () => {
  it("names the public products in the fixed order whatever order they were used in", () => {
    expect(deviceProductNames(["lax-art-web", "lax-bid-web", "lax-account-web"])).toEqual([
      "LAX Account",
      "LAX Bid",
      "lax.art",
    ]);
  });

  it("leaves out staff and mobile clients and unknown ids", () => {
    expect(deviceProductNames(["lax-shop-admin", "ws-mobile", "other"])).toEqual([]);
  });
});
