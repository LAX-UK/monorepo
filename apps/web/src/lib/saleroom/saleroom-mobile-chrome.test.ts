import { describe, expect, it } from "vitest";
import {
  countSaleroomLotProgress,
  formatSaleroomOnBlockLabel,
  publicSaleroomSessionToRegistryStatus,
  resolveSaleroomMobileSummaryBarMode,
  saleroomLiveNoLotCaption,
  saleroomLiveProgressLabel,
  saleroomOnBlockCaption,
  saleroomPausedCaption,
} from "./saleroom-mobile-chrome";

describe("publicSaleroomSessionToRegistryStatus", () => {
  it("maps public session statuses to registry keys", () => {
    expect(publicSaleroomSessionToRegistryStatus("live")).toBe("live");
    expect(publicSaleroomSessionToRegistryStatus("paused")).toBe("paused");
    expect(publicSaleroomSessionToRegistryStatus("ended")).toBe("closed");
    expect(publicSaleroomSessionToRegistryStatus("none")).toBe("idle");
    expect(publicSaleroomSessionToRegistryStatus("pending")).toBe("idle");
  });
});

describe("countSaleroomLotProgress", () => {
  it("counts completed lots from status", () => {
    expect(
      countSaleroomLotProgress([
        { id: "1", lotNumber: 1, title: "A", href: "/a", status: "ended" },
        { id: "2", lotNumber: 2, title: "B", href: "/b", status: "active" },
      ]),
    ).toEqual({ completedLots: 1, totalLots: 2 });
  });
});

describe("formatSaleroomOnBlockLabel", () => {
  it("prefers lot number when present", () => {
    expect(formatSaleroomOnBlockLabel({ lotNumber: 12, title: "Blue Vase" })).toBe("Lot 12");
  });

  it("falls back to title", () => {
    expect(formatSaleroomOnBlockLabel({ lotNumber: null, title: "Blue Vase" })).toBe("Blue Vase");
  });
});

describe("saleroomOnBlockCaption", () => {
  it("builds headline and progress detail", () => {
    expect(saleroomOnBlockCaption({ lotNumber: 3, title: "Vase" }, "2 of 10 lots")).toEqual({
      headline: "Lot 3 is on the block",
      detail: "2 of 10 lots",
    });
  });
});

describe("saleroomPausedCaption", () => {
  it("includes last on-block lot when present", () => {
    expect(saleroomPausedCaption({ lotNumber: 5, title: "Chair" })).toEqual({
      headline: "Auction paused",
      detail: "Lot 5 was on the block",
    });
  });

  it("omits detail when no lot was on block", () => {
    expect(saleroomPausedCaption(null)).toEqual({ headline: "Auction paused" });
  });
});

describe("saleroomLiveNoLotCaption", () => {
  it("prefixes saleroom live label", () => {
    expect(saleroomLiveNoLotCaption(1, 5)).toBe("Saleroom live · 1 of 5 lots complete");
  });
});

describe("saleroomLiveProgressLabel", () => {
  it("includes current lot in progress count", () => {
    expect(saleroomLiveProgressLabel(2, 10, true)).toBe("3 of 10 lots");
    expect(saleroomLiveProgressLabel(2, 10, false)).toBe("2 of 10 lots");
  });

  it("returns null when no lots", () => {
    expect(saleroomLiveProgressLabel(0, 0, false)).toBeNull();
  });
});

describe("resolveSaleroomMobileSummaryBarMode", () => {
  const lots = [
    {
      id: "lot-1",
      lotNumber: 1,
      title: "First",
      href: "/lot/first/lot-1",
      status: "ended",
    },
    {
      id: "lot-2",
      lotNumber: 2,
      title: "Second",
      href: "/lot/second/lot-2",
      status: "active",
    },
  ] as const;

  it("returns on_block when live session has resolved current lot", () => {
    expect(resolveSaleroomMobileSummaryBarMode("live", "lot-2", lots)).toEqual({
      kind: "on_block",
      lot: lots[1],
      progressLabel: "2 of 2 lots",
    });
  });

  it("returns paused mode without bid CTA path", () => {
    expect(resolveSaleroomMobileSummaryBarMode("paused", "lot-2", lots)).toEqual({
      kind: "paused",
      onBlockLot: lots[1],
    });
  });

  it("returns live_no_lot when session is live without current lot", () => {
    expect(resolveSaleroomMobileSummaryBarMode("live", null, lots)).toEqual({
      kind: "live_no_lot",
      progressLabel: "1 of 2 lots complete",
    });
  });

  it("returns null when session is inactive", () => {
    expect(resolveSaleroomMobileSummaryBarMode("none", null, lots)).toBeNull();
  });
});
