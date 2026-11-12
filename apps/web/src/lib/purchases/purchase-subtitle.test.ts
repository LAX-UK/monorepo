import { describe, expect, it } from "vitest";
import { purchaseSubtitle } from "./purchase-subtitle";

const base = {
  lotLabel: "Lot 2",
  saleTitle: "Modern & Contemporary: Online",
  endedAt: new Date("2026-10-29T17:00:00Z"),
  boughtOn: null,
  buyer: "Alex",
};

describe("purchaseSubtitle", () => {
  it("says who won a lot at its sale", () => {
    expect(purchaseSubtitle(base)).toBe(
      "Lot 2 · Modern & Contemporary: Online · 29 Oct 2026 · won by Alex",
    );
  });

  it("says a lot bought after the auction was bought, never won", () => {
    const subtitle = purchaseSubtitle({ ...base, boughtOn: "2026-11-12T10:30:00.000Z" });
    expect(subtitle).toBe(
      "Lot 2 · Modern & Contemporary: Online · Bought after the auction at your bid · 12 Nov 2026 · bought by Alex",
    );
    expect(subtitle).not.toContain("won");
  });

  it("leaves out the parts it does not have", () => {
    expect(purchaseSubtitle({ ...base, lotLabel: null, saleTitle: null, buyer: null })).toBe(
      "29 Oct 2026",
    );
  });
});
