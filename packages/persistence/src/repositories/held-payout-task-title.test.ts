import { describe, expect, it } from "vitest";
import { heldPayoutTaskTitle } from "./drizzle-held-seller-terms-work-items.reader.js";

describe("heldPayoutTaskTitle", () => {
  it("leads with the reason, then the lot, its title and the seller", () => {
    expect(
      heldPayoutTaskTitle({
        reason: "no_agreement",
        lotNumber: 21,
        lotTitle: "The Lock Keeper's House",
        sellerName: "Northbank Gallery Ltd",
      }),
    ).toBe(
      "Payout held: no signed agreement — Lot 21 · The Lock Keeper's House · Northbank Gallery Ltd",
    );
  });

  it("leaves out what is not known", () => {
    expect(
      heldPayoutTaskTitle({
        reason: "not_accepted",
        lotNumber: null,
        lotTitle: "Study of Reeds",
        sellerName: null,
      }),
    ).toBe("Payout held: the seller hasn't accepted the agreement yet — Study of Reeds");
  });
});
