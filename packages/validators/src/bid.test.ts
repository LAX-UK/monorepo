import { describe, expect, it } from "vitest";
import { placeBidSchema } from "./bid.js";

describe("placeBidSchema", () => {
  it("accepts amounts with at most two decimal places", () => {
    const r = placeBidSchema.safeParse({
      lotId: "00000000-0000-4000-8000-000000000001",
      amount: 100.5,
    });
    expect(r.success).toBe(true);
  });

  it("rejects amounts with more than two decimal places", () => {
    const r = placeBidSchema.safeParse({
      lotId: "00000000-0000-4000-8000-000000000001",
      amount: 100.999,
    });
    expect(r.success).toBe(false);
  });

  it("rejects maxAutoBidAmount with sub-cent precision", () => {
    const r = placeBidSchema.safeParse({
      lotId: "00000000-0000-4000-8000-000000000001",
      amount: 100,
      maxAutoBidAmount: 200.001,
    });
    expect(r.success).toBe(false);
  });

  it("accepts the next bid the bidder was shown", () => {
    const r = placeBidSchema.safeParse({
      lotId: "00000000-0000-4000-8000-000000000001",
      amount: 110,
      seenNextBid: "110.00",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a seen next bid that is not money", () => {
    for (const seenNextBid of ["ten", "-5.00", "110.001", ""]) {
      const r = placeBidSchema.safeParse({
        lotId: "00000000-0000-4000-8000-000000000001",
        amount: 110,
        seenNextBid,
      });
      expect(r.success).toBe(false);
    }
  });
});
