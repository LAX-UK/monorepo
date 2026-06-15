import { describe, expect, it } from "vitest";
import { computeIsOwnLot } from "./compute-is-own-lot";

describe("computeIsOwnLot", () => {
  it("returns true when acting LE matches seller LE", () => {
    expect(
      computeIsOwnLot({ sellerLegalEntityId: "le-seller" }, { id: "user-1" }, { id: "le-seller" }),
    ).toBe(true);
  });

  it("returns true when session user matches sellerId", () => {
    expect(
      computeIsOwnLot(
        { sellerLegalEntityId: "le-seller", sellerId: "user-1" },
        { id: "user-1" },
        { id: "le-buyer" },
      ),
    ).toBe(true);
  });

  it("returns false for unrelated buyer", () => {
    expect(
      computeIsOwnLot({ sellerLegalEntityId: "le-seller" }, { id: "buyer-1" }, { id: "le-buyer" }),
    ).toBe(false);
  });
});
