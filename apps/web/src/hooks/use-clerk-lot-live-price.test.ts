import { minNextBidAmount, resolveLeaderLabel } from "@/hooks/use-clerk-lot-live-price";
import { describe, expect, it } from "vitest";

describe("minNextBidAmount", () => {
  it("adds increment to current price", () => {
    expect(minNextBidAmount("100.00", "10.00")).toBe(110);
  });

  it("falls back to 0.01 increment when invalid", () => {
    expect(minNextBidAmount("50.00", "bad")).toBeCloseTo(50.01, 2);
  });
});

describe("resolveLeaderLabel", () => {
  const userId = "9de00000-1111-4222-8333-444455556666";

  it("uses the paddle number and name from the roster", () => {
    const label = resolveLeaderLabel({
      leaderUserId: userId,
      placedVia: "web",
      paddleRoster: [{ userId, paddleNumber: 42, displayName: "A. Bidder" }] as never,
    });
    expect(label).toBe("Paddle 42 · A. Bidder");
  });

  it.each([
    ["web", "Online bidder"],
    ["telephone", "Telephone bidder"],
    [null, "Online bidder"],
  ])("never renders a raw user id when the roster has no match (%s)", (placedVia, expected) => {
    const label = resolveLeaderLabel({ leaderUserId: userId, placedVia, paddleRoster: [] });
    expect(label).toBe(expected);
    expect(label).not.toContain("9de0");
  });
});
