import { describe, expect, it } from "vitest";
import { evaluateManualBidEligibility } from "./evaluate-lot-bid-eligibility";

describe("evaluateManualBidEligibility", () => {
  it("blocks seller own lot", () => {
    const result = evaluateManualBidEligibility({
      isOwnLot: true,
      sessionUserId: "user-1",
      leadingBidderId: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("seller_cannot_bid");
      expect(result.presentation.severity).toBe("warning");
    }
  });

  it("blocks manual bid when already leading", () => {
    const result = evaluateManualBidEligibility({
      isOwnLot: false,
      sessionUserId: "buyer-1",
      leadingBidderId: "buyer-1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("already_leading");
      expect(result.presentation.actionKey).toBe("switch-to-auto-bid");
    }
  });

  it("allows manual bid when behind", () => {
    expect(
      evaluateManualBidEligibility({
        isOwnLot: false,
        sessionUserId: "buyer-1",
        leadingBidderId: "buyer-2",
      }).ok,
    ).toBe(true);
  });
});
