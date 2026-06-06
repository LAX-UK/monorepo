import { describe, expect, it } from "vitest";
import { parseBid, parseItemSubmission } from "./parse";

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

describe("parseItemSubmission", () => {
  it("maps legalEntityId from API rows for admin seller resolution", () => {
    const submission = parseItemSubmission({
      id: "sub-1",
      legalEntityId: "00000000-0000-4000-8000-000000000010",
      title: "Blue vase",
      description: null,
      images: [],
      categoryId: "cat-1",
      status: "submitted",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(submission.legalEntityId).toBe("00000000-0000-4000-8000-000000000010");
    expect(submission.sellerId).toBeUndefined();
  });
});
