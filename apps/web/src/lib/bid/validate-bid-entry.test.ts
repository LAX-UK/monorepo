import { describe, expect, it } from "vitest";
import {
  validateBidConfirmAmount,
  validateBidReview,
  validateLiveBiddingConnectionBlocked,
} from "./validate-bid-entry";

describe("validateBidReview", () => {
  it("rejects amounts below minimum with formatted message", () => {
    const result = validateBidReview({
      amount: "50",
      minNumeric: 110,
      includeAutoBidOnManualBid: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Enter at least £110.00");
    }
  });

  it("rejects amounts above approved registration limit", () => {
    const result = validateBidReview({
      amount: "600",
      minNumeric: 110,
      approvedBidLimit: 500,
      includeAutoBidOnManualBid: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe(
        "Your approved limit for this sale is £500.00. Enter a lower amount.",
      );
    }
  });

  it("rejects max auto-bid below bid amount when active auto-bid is included", () => {
    const result = validateBidReview({
      amount: "200",
      minNumeric: 110,
      includeAutoBidOnManualBid: true,
      activeAutoBidMax: "150",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Max auto-bid must be greater than or equal to your bid.");
    }
  });

  it("accepts valid review input", () => {
    expect(
      validateBidReview({
        amount: "110",
        minNumeric: 110,
        includeAutoBidOnManualBid: false,
      }).ok,
    ).toBe(true);
  });
});

describe("validateBidConfirmAmount", () => {
  it("rejects invalid amount strings", () => {
    const result = validateBidConfirmAmount({ amount: "nope", minNumeric: 110 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("Invalid amount");
  });
});

describe("validateLiveBiddingConnectionBlocked", () => {
  it("blocks when live bidding is unavailable", () => {
    const result = validateLiveBiddingConnectionBlocked(true, false);
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error.message).toMatch(/connection to the saleroom is restored/i);
    }
  });

  it("allows when connection is healthy", () => {
    expect(validateLiveBiddingConnectionBlocked(true, true)).toBeNull();
  });
});
