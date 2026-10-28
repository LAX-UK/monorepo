import { describe, expect, it } from "vitest";
import { selectHostedBrand, selectHostedBrandFromClientName } from "./brand.js";

describe("selectHostedBrand", () => {
  it.each([
    ["lax-bid-web", "LAX Bid", "bid"],
    ["lax-shop-web", "LAX Shop", "shop"],
    ["lax-art-web", "lax.art", "art"],
    ["lax-shop-admin", "LAX Shop Admin", "shop"],
  ])("names the destination of %s as %s, in the %s colour", (clientId, label, product) => {
    const brand = selectHostedBrand(clientId);
    expect(brand.productName).toBe(label);
    expect(brand.chip).toEqual({ label, product });
  });

  it("keeps the Shop Admin tagline", () => {
    expect(selectHostedBrand("lax-shop-admin").tagline).toBe("Shop Admin");
  });

  it("shows no chip for Account itself or for unknown clients", () => {
    for (const clientId of ["lax-account-web", "ws-mobile", "nope", "", null, undefined]) {
      const brand = selectHostedBrand(clientId);
      expect(brand.productName).toBe("LAX Account");
      expect(brand.chip).toBeNull();
      expect(brand.tagline).toBeNull();
    }
  });

  it("does not treat Object prototype keys as clients", () => {
    expect(selectHostedBrand("constructor").chip).toBeNull();
  });

  it("maps a registry display name back to its brand", () => {
    expect(selectHostedBrandFromClientName("LAX Bid Web").chip?.label).toBe("LAX Bid");
    expect(selectHostedBrandFromClientName("Somebody Else").chip).toBeNull();
    expect(selectHostedBrandFromClientName(null).chip).toBeNull();
  });
});
