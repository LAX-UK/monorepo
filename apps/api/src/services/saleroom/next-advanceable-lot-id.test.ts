import { describe, expect, it } from "vitest";
import { nextAdvanceableLotId } from "./next-advanceable-lot-id.js";

const lot = (id: string, lotNumber: number, status: "active" | "scheduled" | "ended" = "active") =>
  ({ id, lotNumber, title: `Lot ${lotNumber}`, status }) as const;

describe("nextAdvanceableLotId", () => {
  it("returns first advanceable lot when between lots", () => {
    const lots = [lot("lot-1", 1), lot("lot-2", 2, "scheduled"), lot("lot-3", 3, "ended")];
    expect(nextAdvanceableLotId(lots, null)).toBe("lot-1");
  });

  it("returns first advanceable lot after ended lots in run order when between lots", () => {
    const lots = [lot("lot-1", 1, "ended"), lot("lot-2", 2), lot("lot-3", 3, "scheduled")];
    expect(nextAdvanceableLotId(lots, null)).toBe("lot-2");
  });

  it("returns lot after currentLotId in full run order, skipping ended lots", () => {
    const lots = [
      lot("lot-1", 1),
      lot("lot-2", 2),
      lot("lot-3", 3, "ended"),
      lot("lot-4", 4, "scheduled"),
    ];
    expect(nextAdvanceableLotId(lots, "lot-2")).toBe("lot-4");
  });

  it("finds next after hammered lot even when hammered lot is ended in the list", () => {
    const lots = [
      lot("lot-1", 1),
      lot("lot-2", 2),
      lot("lot-3", 3, "ended"),
      lot("lot-4", 4, "scheduled"),
    ];
    expect(nextAdvanceableLotId(lots, "lot-3")).toBe("lot-4");
  });

  it("skips ended and cancelled lots", () => {
    const lots = [
      lot("lot-1", 1, "ended"),
      lot("lot-2", 2),
      { id: "lot-3", lotNumber: 3, title: "Lot 3", status: "cancelled" as const },
      lot("lot-4", 4, "scheduled"),
    ];
    expect(nextAdvanceableLotId(lots, null)).toBe("lot-2");
    expect(nextAdvanceableLotId(lots, "lot-2")).toBe("lot-4");
  });

  it("returns null when no advanceable lots remain after current", () => {
    const lots = [lot("lot-1", 1), lot("lot-2", 2, "ended")];
    expect(nextAdvanceableLotId(lots, "lot-1")).toBeNull();
  });

  it("falls back to first advanceable when currentLotId is stale", () => {
    const lots = [lot("lot-1", 1), lot("lot-2", 2)];
    expect(nextAdvanceableLotId(lots, "missing-lot")).toBe("lot-1");
  });
});
