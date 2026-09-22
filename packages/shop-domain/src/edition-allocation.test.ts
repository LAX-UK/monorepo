import { describe, expect, it } from "vitest";
import {
  ARTIST_ALLOCATION_COUNT,
  BUYER_ENTITLEMENT_COUNT,
  LAX_ALLOCATION_COUNT,
  SHOP_EDITION_COUNT,
  assertValidEditionPlan,
  planEditionsForArtwork,
  publicEditionAvailability,
} from "./edition-allocation.js";

describe("planEditionsForArtwork", () => {
  it("returns zero editions when ineligible", () => {
    expect(planEditionsForArtwork(false)).toEqual([]);
  });

  it("allocates 10/10/4 across editions 1–24 when eligible", () => {
    const plan = planEditionsForArtwork(true);
    expect(plan).toHaveLength(SHOP_EDITION_COUNT);
    assertValidEditionPlan(plan);
    const buyer = plan.filter((row) => row.allocation === "original_buyer_entitlement");
    const artist = plan.filter((row) => row.allocation === "artist");
    const lax = plan.filter((row) => row.allocation === "lax");
    expect(buyer).toHaveLength(BUYER_ENTITLEMENT_COUNT);
    expect(artist).toHaveLength(ARTIST_ALLOCATION_COUNT);
    expect(lax).toHaveLength(LAX_ALLOCATION_COUNT);
    expect(buyer[0]?.editionNumber).toBe(1);
    expect(artist[0]?.editionNumber).toBe(BUYER_ENTITLEMENT_COUNT + 1);
    expect(lax[0]?.editionNumber).toBe(BUYER_ENTITLEMENT_COUNT + ARTIST_ALLOCATION_COUNT + 1);
  });
});

describe("publicEditionAvailability", () => {
  it("reports zero when ineligible", () => {
    expect(
      publicEditionAvailability({
        eligibleForEditionAllocation: false,
        totalEditionCount: 0,
        availableEditionCount: 0,
      }),
    ).toEqual({ totalEditions: 0, editionsAvailable: 0 });
  });

  it("reports total and unowned availability independently", () => {
    expect(
      publicEditionAvailability({
        eligibleForEditionAllocation: true,
        totalEditionCount: 24,
        availableEditionCount: 18,
      }),
    ).toEqual({ totalEditions: 24, editionsAvailable: 18 });
  });
});
