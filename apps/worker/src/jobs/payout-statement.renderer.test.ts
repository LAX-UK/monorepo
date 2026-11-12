import { describe, expect, it } from "vitest";
import { buyerPhrase } from "./payout-statement.renderer.js";

describe("buyerPhrase", () => {
  it("names the buyer on an ordinary sale", () => {
    expect(buyerPhrase({ buyerName: " A. Collector ", soldAfterAuction: false })).toBe(
      "buyer: A. Collector",
    );
  });

  it("shows a dash when the buyer has no name on record", () => {
    expect(buyerPhrase({ buyerName: null, soldAfterAuction: false })).toBe("buyer: —");
  });

  it("says a sale sold on after a default was sold after the auction, without the next bidder's name", () => {
    const phrase = buyerPhrase({ buyerName: "Zed Quincy", soldAfterAuction: true });
    expect(phrase).toBe("sold after the auction to the next bidder");
    expect(phrase).not.toContain("Quincy");
  });
});
