import { describe, expect, it } from "vitest";
import {
  SALES_CHANNEL_LISTINGS,
  type SalesChannelListingCandidate,
  isListedOnSalesChannel,
} from "./sales-channel-listing.js";

const original: SalesChannelListingCandidate = {
  salesChannel: "art",
  eligibleForEditionAllocation: false,
  rarity: "unique",
};
const shopEdition: SalesChannelListingCandidate = {
  salesChannel: "shop",
  eligibleForEditionAllocation: true,
  rarity: "limited_edition",
};

describe("isListedOnSalesChannel", () => {
  it("lists a unique original on lax.art only", () => {
    expect(isListedOnSalesChannel(original, "art")).toBe(true);
    expect(isListedOnSalesChannel(original, "shop")).toBe(false);
  });

  it("lists an original with no recorded rarity on lax.art", () => {
    expect(isListedOnSalesChannel({ ...original, rarity: null }, "art")).toBe(true);
  });

  it("never lists an editioned work on lax.art", () => {
    expect(isListedOnSalesChannel({ ...original, rarity: "limited_edition" }, "art")).toBe(false);
    expect(isListedOnSalesChannel({ ...original, rarity: "open_edition" }, "art")).toBe(false);
  });

  it("never lists an edition run on lax.art, whatever its channel says", () => {
    expect(isListedOnSalesChannel({ ...original, eligibleForEditionAllocation: true }, "art")).toBe(
      false,
    );
  });

  it("lists an edition run on LAX Shop only", () => {
    expect(isListedOnSalesChannel(shopEdition, "shop")).toBe(true);
    expect(isListedOnSalesChannel(shopEdition, "art")).toBe(false);
  });

  it("never lists an original on LAX Shop", () => {
    expect(
      isListedOnSalesChannel({ ...shopEdition, eligibleForEditionAllocation: false }, "shop"),
    ).toBe(false);
  });

  it("describes lax.art as originals with editioned rarities excluded", () => {
    expect(SALES_CHANNEL_LISTINGS.art).toEqual({
      kind: "original",
      excludedRarities: ["limited_edition", "open_edition"],
    });
    expect(SALES_CHANNEL_LISTINGS.shop.kind).toBe("edition_run");
  });
});
