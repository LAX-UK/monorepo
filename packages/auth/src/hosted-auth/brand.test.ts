import { describe, expect, it } from "vitest";
import { selectHostedBrand, selectHostedBrandFromClientName } from "./brand.js";

describe("selectHostedBrand", () => {
  it("names Bid in the chip", () => {
    const brand = selectHostedBrand("lax-bid-web");
    expect(brand.productName).toBe("LAX Bid");
    expect(brand.chip).toEqual({ label: "LAX Bid" });
  });

  it("names Shop in the chip", () => {
    expect(selectHostedBrand("lax-shop-web").chip).toEqual({ label: "LAX Shop" });
  });

  it("names lax.art, not the Shop", () => {
    const brand = selectHostedBrand("lax-art-web");
    expect(brand.productName).toBe("lax.art");
    expect(brand.chip).toEqual({ label: "lax.art" });
  });

  it("keeps the Shop Admin tagline", () => {
    const brand = selectHostedBrand("lax-shop-admin");
    expect(brand.tagline).toBe("Shop Admin");
    expect(brand.chip).toEqual({ label: "LAX Shop Admin" });
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
