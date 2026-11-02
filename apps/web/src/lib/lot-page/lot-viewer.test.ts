import { describe, expect, it } from "vitest";
import { NO_LOT_VIEWER, parseLotViewerView } from "./lot-viewer";

describe("parseLotViewerView", () => {
  it("reads a bidder's standing, purchase and agent room", () => {
    expect(
      parseLotViewerView({
        lotId: "lot-1",
        registration: "approved",
        registrationRequired: true,
        position: "won",
        myHighestBid: "7000.00",
        myMaxBid: null,
        purchase: { id: "p-1", status: "overdue", dueAt: "2026-11-10T00:00:00.000Z" },
        agentLimitLeft: "1500.00",
      }),
    ).toEqual({
      registration: "approved",
      registrationRequired: true,
      position: "won",
      myHighestBid: "7000.00",
      myMaxBid: null,
      purchase: { id: "p-1", status: "overdue", dueAt: "2026-11-10T00:00:00.000Z" },
      agentLimitLeft: "1500.00",
    });
  });

  it("treats unknown values as no standing", () => {
    expect(parseLotViewerView({ registration: "vip", position: "ahead" })).toEqual(NO_LOT_VIEWER);
    expect(parseLotViewerView(undefined)).toEqual(NO_LOT_VIEWER);
  });
});
