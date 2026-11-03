import { describe, expect, it } from "vitest";
import { type MyBidStatus, bidNeedsYou } from "./my-bid-status";

describe("bidNeedsYou", () => {
  it("is true only for a bid that was outbid", () => {
    const waiting: MyBidStatus[] = ["outbid"];
    const rest: MyBidStatus[] = [
      "winning",
      "maximum-set",
      "absentee",
      "won",
      "not-won",
      "withdrawn",
    ];
    for (const status of waiting) expect(bidNeedsYou(status)).toBe(true);
    for (const status of rest) expect(bidNeedsYou(status)).toBe(false);
  });
});
