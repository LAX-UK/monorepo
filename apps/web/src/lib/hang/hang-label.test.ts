import { describe, expect, it } from "vitest";
import { hangLot, hangSale } from "./hang-fixtures";
import { hangLabelModel, soldPriceWithPremium } from "./hang-label";
import { formatHangMoney } from "./hang-money";

const NOW = new Date("2026-11-01T12:00:00.000Z");
const ctx = { sale: hangSale(), now: NOW };

describe("formatHangMoney", () => {
  it("drops pennies that are not there, and keeps those that are", () => {
    expect(formatHangMoney("4200.00", "GBP")).toBe("£4,200");
    expect(formatHangMoney("4200.50", "GBP")).toBe("£4,200.50");
  });
});

describe("soldPriceWithPremium", () => {
  it("adds the lot's flat buyer's premium to the hammer", () => {
    expect(soldPriceWithPremium({ currentPrice: "6200.00", buyerPremiumRate: "0.25" }, null)).toBe(
      "7750.00",
    );
  });

  it("uses the sale's bands in preference to the lot's rate", () => {
    const sale = {
      buyerPremiumTiers: [
        { hammerThresholdMinor: 0, rate: "0.30" },
        { hammerThresholdMinor: 1_000_000, rate: "0.20" },
      ],
    };
    expect(soldPriceWithPremium({ currentPrice: "1000.00", buyerPremiumRate: "0.25" }, sale)).toBe(
      "1300.00",
    );
    expect(soldPriceWithPremium({ currentPrice: "10000.00", buyerPremiumRate: "0.25" }, sale)).toBe(
      "12000.00",
    );
  });
});

describe("hangLabelModel", () => {
  it("leads a live lot with its current bid and when it closes, and marks it live", () => {
    const model = hangLabelModel(hangLot({ currentPrice: "4200.00" }), ctx);
    expect(model).toMatchObject({
      eyebrow: "Lot 1",
      title: "Harbour at First Light",
      price: { qualifier: "Current bid", value: "£4,200" },
      notes: ["Closes 3 Nov 21:00"],
      live: { lotId: "lot-1", currency: "GBP" },
    });
  });

  it("says Starting bid until a bid is placed", () => {
    expect(hangLabelModel(hangLot(), ctx).price).toEqual({
      qualifier: "Starting bid",
      value: "£1,000",
    });
  });

  it("leads an upcoming lot with its estimate, else its opening bid, and does not follow bids", () => {
    const upcoming = hangLot({ status: "scheduled" });
    const withEstimate = hangLabelModel(
      {
        ...upcoming,
        marketingDetails: { estimate: { low: "800", high: "1200", currency: "GBP" } },
      },
      ctx,
    );
    expect(withEstimate.price?.qualifier).toBe("Estimate");
    expect(withEstimate.live).toBeUndefined();
    expect(hangLabelModel(upcoming, ctx).price).toEqual({
      qualifier: "Starting bid",
      value: "£1,000",
    });
    expect(hangLabelModel(upcoming, ctx).notes[0]).toMatch(/^Opens /);
  });

  it("shows a sold lot at what the buyer paid, premium included", () => {
    const sold = hangLot({
      status: "ended",
      winnerId: "u1",
      currentPrice: "6200.00",
    });
    const model = hangLabelModel(sold, ctx);
    expect(model.price).toEqual({ qualifier: "Sold for", value: "£7,750" });
    expect(model.live).toBeUndefined();
  });

  it("reads Not sold for a lot that found no buyer", () => {
    const model = hangLabelModel(
      hangLot({ status: "ended", winnerId: null, hasWinner: false }),
      ctx,
    );
    expect(model.price).toEqual({ value: "Not sold" });
  });

  it("adds Shown framed when the photograph shows a frame we have no size for", () => {
    expect(hangLabelModel(hangLot(), { ...ctx, shownFramed: true }).notes).toContain(
      "Shown framed",
    );
  });

  it("falls back to a short code when the lot has no number", () => {
    expect(hangLabelModel(hangLot({ lotNumber: null, id: "abcd-ef01-2345" }), ctx).eyebrow).toBe(
      "Lot ABCDEF",
    );
  });
});
