import { describe, expect, it } from "vitest";
import { type LotViewerFacts, readLotViewerState, registrationState } from "./viewer-state.js";

function facts(over: Partial<LotViewerFacts> = {}): LotViewerFacts {
  return {
    lotStatus: "active",
    currentPrice: "7000.00",
    registration: null,
    leading: false,
    won: false,
    hasBid: false,
    highestBid: null,
    maxBid: null,
    ...over,
  };
}

describe("registrationState", () => {
  it.each([
    [null, "none"],
    ["pending", "pending"],
    ["approved", "approved"],
    ["rejected", "declined"],
    ["withdrawn", "none"],
  ] as const)("%s reads as %s", (stored, expected) => {
    expect(registrationState(stored)).toBe(expected);
  });
});

describe("readLotViewerState", () => {
  it("has no position on a lot the viewer has not bid on", () => {
    expect(readLotViewerState(facts()).position).toBe("none");
  });

  it("leading and outbid on a live lot", () => {
    expect(
      readLotViewerState(facts({ hasBid: true, leading: true, highestBid: "7000.00" })).position,
    ).toBe("leading");
    expect(
      readLotViewerState(facts({ hasBid: true, leading: false, highestBid: "6500.00" })).position,
    ).toBe("outbid");
  });

  it("a maximum is shown only while it can still bid", () => {
    const leadingWithMax = readLotViewerState(
      facts({ hasBid: true, leading: true, maxBid: "9000.00", highestBid: "7000.00" }),
    );
    expect(leadingWithMax.myMaxBid).toBe("9000.00");
    const spent = readLotViewerState(
      facts({ hasBid: true, leading: false, maxBid: "6800.00", highestBid: "6800.00" }),
    );
    expect(spent).toMatchObject({ position: "outbid", myMaxBid: null });
    const exhaustedWhileLeading = readLotViewerState(
      facts({ hasBid: true, leading: true, maxBid: "7000.00" }),
    );
    expect(exhaustedWhileLeading.myMaxBid).toBeNull();
  });

  it("a maximum on an upcoming lot is a maximum set", () => {
    expect(readLotViewerState(facts({ lotStatus: "scheduled", maxBid: "9000.00" }))).toMatchObject({
      position: "maximum_set",
      myMaxBid: "9000.00",
    });
    expect(readLotViewerState(facts({ lotStatus: "scheduled" })).position).toBe("none");
  });

  it("won and lost on an ended lot", () => {
    expect(
      readLotViewerState(facts({ lotStatus: "ended", hasBid: true, won: true })).position,
    ).toBe("won");
    expect(readLotViewerState(facts({ lotStatus: "ended", hasBid: true })).position).toBe("lost");
    expect(readLotViewerState(facts({ lotStatus: "ended" })).position).toBe("none");
  });

  it("a win with no stored bid (placed by the room) is still a win", () => {
    expect(readLotViewerState(facts({ lotStatus: "ended", won: true })).position).toBe("won");
  });

  it("withdrawn and cancelled lots have no position", () => {
    for (const lotStatus of ["voided", "cancelled"] as const) {
      expect(readLotViewerState(facts({ lotStatus, hasBid: true, leading: true })).position).toBe(
        "none",
      );
    }
  });

  it("carries the registration state", () => {
    expect(readLotViewerState(facts({ registration: "rejected" })).registration).toBe("declined");
  });
});
