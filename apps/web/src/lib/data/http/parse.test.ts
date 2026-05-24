import { describe, expect, it } from "vitest";
import { parseBid } from "./parse";

describe("parseBid", () => {
  it("maps placedByUserId and autoBidStepAmount from API rows", () => {
    const bid = parseBid({
      id: "bid-1",
      lotId: "lot-1",
      placedByUserId: "user-1",
      amount: "110.00",
      isWinning: true,
      isAutoBid: true,
      maxAutoBidAmount: "500.00",
      autoBidStepAmount: "10.00",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(bid.placedByUserId).toBe("user-1");
    expect(bid.bidderId).toBe("user-1");
    expect(bid.autoBidStepAmount).toBe("10.00");
  });
});
