import { formatBidPlacementBadgeLabel, getBidPlacement } from "@/lib/bid/bid-placement-presenter";
import { describe, expect, it } from "vitest";

describe("getBidPlacement", () => {
  it("returns false for self-service web bids", () => {
    expect(getBidPlacement({ placedVia: "web", clerkUserId: null })).toEqual({
      onBehalf: false,
      channelLabel: "Online",
    });
  });

  it("returns true for saleroom floor bids including proxy follow-ups without clerkUserId", () => {
    expect(getBidPlacement({ placedVia: "saleroom", clerkUserId: null })).toEqual({
      onBehalf: true,
      channelLabel: "Floor",
    });
  });

  it("returns true for telephone bids", () => {
    expect(getBidPlacement({ placedVia: "telephone", clerkUserId: null })).toEqual({
      onBehalf: true,
      channelLabel: "Telephone",
    });
  });

  it("returns false for absentee bids", () => {
    expect(getBidPlacement({ placedVia: "absentee", clerkUserId: null })).toEqual({
      onBehalf: false,
      channelLabel: "Absentee",
    });
  });

  it("returns true when clerkUserId is set even for web channel", () => {
    expect(getBidPlacement({ placedVia: "web", clerkUserId: "clerk-uuid" })).toEqual({
      onBehalf: true,
      channelLabel: "Online",
    });
  });
});

describe("formatBidPlacementBadgeLabel", () => {
  it("formats on-behalf label with channel", () => {
    expect(formatBidPlacementBadgeLabel({ onBehalf: true, channelLabel: "Floor" })).toBe(
      "Bid placed for you · Floor",
    );
  });

  it("formats on-behalf label without channel", () => {
    expect(formatBidPlacementBadgeLabel({ onBehalf: true, channelLabel: null })).toBe(
      "Bid placed for you",
    );
  });

  it("returns empty string when not on behalf", () => {
    expect(formatBidPlacementBadgeLabel({ onBehalf: false, channelLabel: "Online" })).toBe("");
  });
});
