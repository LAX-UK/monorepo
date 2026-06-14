import { formatBidChannelLabel } from "@/lib/bid/bid-channel-label";
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
