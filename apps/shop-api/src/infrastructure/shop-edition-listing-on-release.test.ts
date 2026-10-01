import { describe, expect, it } from "vitest";
import { resolveListingStatusAfterReservationRelease } from "./shop-edition-listing-on-release.js";

describe("resolveListingStatusAfterReservationRelease", () => {
  it("returns not_authorised without an owner party", async () => {
    const tx = {
      select: () => {
        throw new Error("should not query");
      },
    };
    await expect(
      resolveListingStatusAfterReservationRelease(tx, {
        artworkId: "artwork-id",
        ownerPartyId: null,
      }),
    ).resolves.toBe("not_authorised");
  });
});
