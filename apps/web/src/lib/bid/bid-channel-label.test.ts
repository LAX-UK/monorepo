import {
  formatBidChannelLabel,
  formatChannelBidderLabel,
  formatPaddleBidderLabel,
} from "@/lib/bid/bid-channel-label";
import { describe, expect, it } from "vitest";

describe("formatBidChannelLabel", () => {
  it("maps known placement channels", () => {
    expect(formatBidChannelLabel("web")).toBe("Online");
    expect(formatBidChannelLabel("saleroom")).toBe("Floor");
    expect(formatBidChannelLabel("telephone")).toBe("Telephone");
    expect(formatBidChannelLabel("absentee")).toBe("Absentee");
  });

  it("returns null for unknown or empty values", () => {
    expect(formatBidChannelLabel(null)).toBeNull();
    expect(formatBidChannelLabel(undefined)).toBeNull();
    expect(formatBidChannelLabel("")).toBeNull();
  });
});

describe("clerk bidder labels", () => {
  it("names a bidder off the roster by channel", () => {
    expect(formatChannelBidderLabel("Telephone")).toBe("Telephone bidder");
    expect(formatChannelBidderLabel(null)).toBe("Online bidder");
  });

  it("names a roster bidder by paddle, with the name when there is one", () => {
    expect(formatPaddleBidderLabel(42, " A. Bidder ")).toBe("Paddle 42 · A. Bidder");
    expect(formatPaddleBidderLabel(42, "  ")).toBe("Paddle 42");
    expect(formatPaddleBidderLabel(42)).toBe("Paddle 42");
  });
});
