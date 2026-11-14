import { describe, expect, it } from "vitest";
import { LAX_FAMILY_NAMES, LAX_FAMILY_ORDER } from "../src/family-names.js";
import { LAX_PRODUCT_NAMES } from "../src/legal-entity.js";

describe("LAX family names", () => {
  it("writes lax.art and lax.bid as domain names and the Shop and Account as product names", () => {
    expect(LAX_FAMILY_ORDER.map((id) => LAX_FAMILY_NAMES[id])).toEqual([
      "lax.art",
      "LAX Shop",
      "lax.bid",
      "LAX Account",
    ]);
  });

  it("leaves the names used in sentences and legal copy alone", () => {
    expect(LAX_PRODUCT_NAMES.bid).toBe("LAX Bid");
    expect(LAX_PRODUCT_NAMES.shop).toBe("LAX Shop");
  });
});
