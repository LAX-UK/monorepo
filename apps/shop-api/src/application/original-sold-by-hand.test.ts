import { describe, expect, it } from "vitest";
import { becameSoldByHand } from "./original-sold-by-hand.js";

describe("becameSoldByHand", () => {
  it.each(["for_sale", "price_on_application", null] as const)(
    "is true from %s to sold",
    (before) => {
      expect(becameSoldByHand(before, "sold")).toBe(true);
    },
  );

  it("is false when it was already sold", () => {
    expect(becameSoldByHand("sold", "sold")).toBe(false);
  });

  it.each(["for_sale", "price_on_application"] as const)("is false for a save to %s", (after) => {
    expect(becameSoldByHand("sold", after)).toBe(false);
    expect(becameSoldByHand("for_sale", after)).toBe(false);
  });
});
