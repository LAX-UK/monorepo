import { describe, expect, it } from "vitest";
import { type LotCardLineSource, lotCardLineModel } from "./lot-card-line";

const NOW = new Date("2026-11-02T12:00:00Z");

function lot(over: Partial<LotCardLineSource> = {}): LotCardLineSource {
  return {
    id: "l1",
    status: "active",
    winnerId: null,
    currentPrice: "4200.00",
    startingPrice: "1000.00",
    auctionType: "english",
    buyNowPrice: null,
    marketingDetails: {},
    startTime: "2026-11-01T09:00:00Z",
    endTime: "2026-11-04T21:00:00Z",
    ...over,
  };
}

describe("lotCardLineModel", () => {
  it("says what the lot page says: a live lot with bids shows the current bid and a closing clock", () => {
    expect(lotCardLineModel(lot(), NOW)).toMatchObject({
      label: "Current bid",
      value: "£4,200.00",
      time: "closes",
      endsAt: "2026-11-04T21:00:00.000Z",
    });
  });

  it("shows the starting bid before the first bid", () => {
    expect(lotCardLineModel(lot({ currentPrice: "1000.00" }), NOW)).toMatchObject({
      label: "Starting bid",
      value: "£1,000.00",
    });
  });

  it("counts to the opening of a lot that has not started", () => {
    const model = lotCardLineModel(
      lot({ status: "scheduled", startTime: "2026-11-10T09:00:00Z", currentPrice: "1000.00" }),
      NOW,
    );
    expect(model).toMatchObject({ label: "Starting bid", time: "opens" });
  });

  it("reports the hammer of a sold lot and 'Not sold' for one that did not sell", () => {
    expect(
      lotCardLineModel(
        lot({ status: "ended", winnerId: "u1", endTime: "2026-11-01T10:00:00Z" }),
        NOW,
      ),
    ).toMatchObject({ label: "Hammer price", value: "£4,200.00", time: "ended" });
    expect(
      lotCardLineModel(lot({ status: "ended", endTime: "2026-11-01T10:00:00Z" }), NOW),
    ).toMatchObject({ label: "Not sold", value: null });
  });
});
